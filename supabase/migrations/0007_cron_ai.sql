-- SaaS化 C5 — GAS廃止: リマインド Vercel Cron 化 + AI生成のレート制限（roots-concierge#6）
--
-- 1) リマインドの冪等化:
--    message_drafts を送信ログとして使うのは GAS と同じだが、「今日送ったか」を
--    created_at 文字列の前方一致でスキャンする方式をやめ、sent_date 列 + 部分
--    ユニークインデックスで DB に保証させる。Cron が同日に多重起動しても
--    on conflict do nothing の「claim → 送信」順で重複送信ゼロ。
--
-- 2) Cron 経路の認可:
--    毎朝の Cron は全 company を横断する必要があり、管理者セッションが無い。
--    C2/C4 と同じ方針で、RLS の例外を security definer 関数に限定する
--    （cron_reminder_data / cron_claim_reminder / cron_mark_failed の3個。
--    呼び出しは CRON_SECRET を検証した API ルートのみ）。
--    cron_reminder_data はチャネルアクセストークンを返すが、サーバー内でのみ
--    使用しクライアントには一切返さない（Webhook 用 venue_line_config が
--    token を返さないのは変わらない）。
--
-- 3) ai_usage:
--    AI メッセージ生成（運営者の Claude API キーで共通提供）のテナント別
--    デイリー使用量。管理者セッション経由でのみ増分するため RLS は
--    既存の管理者ポリシーと同型（definer 例外は不要）。

-- ─── message_drafts: 送信日による冪等化 ─────────────────────────────────
alter table message_drafts add column sent_date date;

create unique index message_drafts_daily_dedup_key
  on message_drafts (couple_id, task_id, sent_date)
  where sent_date is not null;

-- ─── ai_usage（テナント別 AI 使用量・日次）──────────────────────────────
create table ai_usage (
  company_id uuid not null references companies(id) on delete cascade,
  used_on    date not null,
  count      int  not null default 0,
  primary key (company_id, used_on)
);

alter table ai_usage enable row level security;
grant select, insert, update on ai_usage to app_couple;

create policy ai_usage_admin_all on ai_usage
  for all to app_couple
  using (app.is_admin() and company_id = app.current_company_id())
  with check (app.is_admin() and company_id = app.current_company_id());

-- ─── Cron 用データ取得（全 company 横断・security definer）──────────────
-- p_today は JST の「今日」（Cron ルートが計算して渡す）。
-- sent_today は表示用の事前フィルタで、最終的な重複防止は claim 側の
-- ユニークインデックスが保証する。
create or replace function app.cron_reminder_data(p_today date) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'venues', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'company_id', v.company_id, 'code', v.code,
        'venue_name', v.venue_name,
        'planner_line_user_id', v.planner_line_user_id,
        'line_channel_access_token', v.line_channel_access_token))
      from venues v where v.active and v.code <> ''), '[]'::jsonb),
    'customers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'line_id', c.line_id, 'company_id', c.company_id, 'venue_id', c.venue_id,
        'wedding_date', to_char(c.wedding_date, 'YYYY-MM-DD'),
        'name1_kana', coalesce(c.name1_kana, ''),
        'name2_kana', coalesce(c.name2_kana, '')))
      from customers c
      where c.wedding_date is not null and c.venue_id is not null), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'task_id', t.task_id, 'company_id', t.company_id, 'venue_id', t.venue_id,
        'task_content', t.task_content, 'due_formula', t.due_formula,
        'reminder_message', t.reminder_message))
      from task_master t where t.is_active), '[]'::jsonb),
    'custom_tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'task_id', ct.task_id, 'target_line_id', ct.target_line_id,
        'task_content', ct.task_content, 'due_formula', ct.due_formula))
      from custom_tasks ct where ct.is_active), '[]'::jsonb),
    'done', coalesce((
      select jsonb_agg(jsonb_build_object('line_id', p.line_id, 'task_id', p.task_id))
      from task_progress p where p.is_done), '[]'::jsonb),
    'hidden', coalesce((
      select jsonb_agg(jsonb_build_object('line_id', h.line_id, 'task_id', h.task_id))
      from task_visibility h where h.hidden), '[]'::jsonb),
    'sent_today', coalesce((
      select jsonb_agg(jsonb_build_object('couple_id', d.couple_id, 'task_id', d.task_id))
      from message_drafts d where d.sent_date = p_today), '[]'::jsonb)
  )
$$;

revoke all on function app.cron_reminder_data(date) from public;
grant execute on function app.cron_reminder_data(date) to app_couple;

-- ─── 送信の claim（冪等化の本体）────────────────────────────────────────
-- 送信「前」に claim する。取れたら draft_id を返す（→ 送信する）。
-- 既に同日の行があれば null（→ スキップ。多重起動・リトライでも二重送信しない）。
-- 送信に失敗したら cron_mark_failed で status='failed' に落とす
-- （同日の再送はしない = GAS の「1日1回」挙動と同じ）。
create or replace function app.cron_claim_reminder(
  p_company_id uuid,
  p_venue_id uuid,
  p_couple_id text,
  p_task_id text,
  p_message text,
  p_today date
) returns text
language sql security definer set search_path = public
as $$
  insert into message_drafts (company_id, venue_id, couple_id, task_id,
                              draft_message, status, sent_date, sent_at)
  values (p_company_id, p_venue_id, p_couple_id, p_task_id,
          p_message, 'sent', p_today, now())
  on conflict (couple_id, task_id, sent_date) where sent_date is not null
  do nothing
  returning draft_id
$$;

revoke all on function app.cron_claim_reminder(uuid, uuid, text, text, text, date) from public;
grant execute on function app.cron_claim_reminder(uuid, uuid, text, text, text, date) to app_couple;

create or replace function app.cron_mark_failed(p_draft_id text) returns void
language sql security definer set search_path = public
as $$
  update message_drafts set status = 'failed' where draft_id = p_draft_id
$$;

revoke all on function app.cron_mark_failed(text) from public;
grant execute on function app.cron_mark_failed(text) to app_couple;
