-- Phase A 縦スライス #3 — 管理（プランナー）経路 + 登録経路の全アクション移行
--
-- 認可モデルの拡張:
--   管理者 = customers.is_admin = true の行を持つ LINE ユーザー（GAS と同じモデル）。
--   接続ロールは引き続き app_couple のみ（service_role 不使用）。
--   管理者ポリシーは app.is_admin() + app.current_company_id()（security definer）で
--   「自社(company)内」の行だけに読み書きを許す。couple ポリシーとは独立に追加される
--   （RLS はポリシーの OR 結合なので、couple の自分スコープはそのまま生きる）。
--
--   登録（register）だけは「customer 行がまだ無い」状態で venue 解決・行作成が必要なため、
--   security definer 関数 app.register_customer() に閉じ込める（RLS の例外を関数1個に限定）。

-- ─── venues 拡張 ─────────────────────────────────────────────────────────
-- code = 人間可読の式場ID（GAS の venue_id "RC001" 形式）。API では venue_id として露出する。
alter table venues add column code text not null default '';
alter table venues add column planner_line_user_id text not null default '';
alter table venues add column line_liff_id text not null default '';
-- LINE Messaging API のチャネルトークン。クライアントには絶対返さない（サーバー送信専用）。
alter table venues add column line_channel_access_token text not null default '';

create unique index venues_company_code_key on venues (company_id, code) where code <> '';

-- ─── task_master 拡張 ────────────────────────────────────────────────────
-- venue_id: null = base（全式場共通の雛形）、非 null = その式場専用タスク。
alter table task_master add column venue_id uuid references venues(id) on delete cascade;
alter table task_master add column reminder_message text not null default '';

create index on task_master (venue_id) where venue_id is not null;

-- ─── task_items（手配物）────────────────────────────────────────────────
-- line_id = null はテンプレ（タスク雛形に紐づく標準手配物）。API では '' として返す（GAS 互換）。
create table task_items (
  item_id     text primary key default ('ITEM-' || gen_random_uuid()),
  company_id  uuid not null references companies(id) on delete cascade,
  task_id     text not null,
  line_id     text references customers(line_id) on delete cascade,
  item_name   text not null,
  quantity    integer not null default 1 check (quantity >= 1),
  is_done     boolean not null default false,
  memo        text not null default '',
  created_at  timestamptz not null default now()
);

create index on task_items (line_id);
create index on task_items (company_id, task_id) where line_id is null;

-- ─── message_drafts（リマインド配信ログ）────────────────────────────────
-- リマインドエンジン移行前でも管理画面（配信ログ）の読み取り経路を先に通しておく。
create table message_drafts (
  draft_id      text primary key default ('DRAFT-' || gen_random_uuid()),
  company_id    uuid not null references companies(id) on delete cascade,
  venue_id      uuid references venues(id) on delete set null,
  couple_id     text not null default '',
  task_id       text not null default '',
  draft_message text not null default '',
  status        text not null default 'pending',
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);

create index on message_drafts (company_id, created_at desc);

-- ─── RLS ヘルパー（security definer: policy から customers を再帰なしで参照）──
create or replace function app.is_admin() returns boolean
  language sql stable security definer set search_path = public
  as $$
    select coalesce(
      (select is_admin from customers where line_id = app.current_line_id()),
      false)
  $$;

create or replace function app.current_company_id() returns uuid
  language sql stable security definer set search_path = public
  as $$ select company_id from customers where line_id = app.current_line_id() $$;

revoke all on function app.is_admin() from public;
revoke all on function app.current_company_id() from public;
grant execute on function app.is_admin() to app_couple;
grant execute on function app.current_company_id() to app_couple;

-- ─── RLS 有効化 + grant ──────────────────────────────────────────────────
alter table task_items     enable row level security;
alter table message_drafts enable row level security;

grant select, insert, update, delete on task_items to app_couple;
grant select, insert, update on message_drafts to app_couple;
grant insert, update on venues to app_couple;
grant insert, update on task_master to app_couple;
grant insert, update, delete on custom_tasks to app_couple;

-- ─── 管理者ポリシー（すべて「自社内」限定）───────────────────────────────
-- 自社の顧客一覧（getUsers / getUsersWithProgress / getAdminUserTasks の対象解決）
create policy admin_company_customers on customers
  for select to app_couple
  using (app.is_admin() and company_id = app.current_company_id());

-- 自社顧客の進捗を閲覧（書き込みはカップル本人のみのまま）
create policy admin_company_progress on task_progress
  for select to app_couple
  using (app.is_admin() and exists (
    select 1 from customers c
    where c.line_id = task_progress.line_id
      and c.company_id = app.current_company_id()));

-- 自社顧客の表示/非表示を読み書き（toggleTaskVisibility）
create policy admin_company_visibility on task_visibility
  for all to app_couple
  using (app.is_admin() and exists (
    select 1 from customers c
    where c.line_id = task_visibility.line_id
      and c.company_id = app.current_company_id()))
  with check (app.is_admin() and exists (
    select 1 from customers c
    where c.line_id = task_visibility.line_id
      and c.company_id = app.current_company_id()));

-- 自社のカスタムタスクを読み書き（addCustomTask / deleteCustomTask）
create policy admin_company_custom_tasks on custom_tasks
  for all to app_couple
  using (app.is_admin() and company_id = app.current_company_id())
  with check (app.is_admin() and company_id = app.current_company_id());

-- 自社のタスク雛形を追加・編集（addTaskMaster / updateTaskMaster / updateTaskManualUrl）
create policy admin_company_task_master_write on task_master
  for all to app_couple
  using (app.is_admin() and company_id = app.current_company_id())
  with check (app.is_admin() and company_id = app.current_company_id());

-- 自社の式場を追加・編集（createVenue / updateVenue / updateVenueStatus）
create policy admin_company_venues_write on venues
  for all to app_couple
  using (app.is_admin() and company_id = app.current_company_id())
  with check (app.is_admin() and company_id = app.current_company_id());

-- プランナー判定（getUser の status="planner"）: 自分が担当の式場行は読める
create policy planner_own_venue on venues
  for select to app_couple
  using (planner_line_user_id <> '' and planner_line_user_id = app.current_line_id());

-- 手配物: カップルは自分の分を閲覧、テンプレは自社分を閲覧。管理者は自社分を読み書き。
create policy couple_own_task_items on task_items
  for select to app_couple
  using (line_id = app.current_line_id());

create policy couple_company_item_templates on task_items
  for select to app_couple
  using (line_id is null and company_id = app.current_company_id());

create policy admin_company_task_items on task_items
  for all to app_couple
  using (app.is_admin() and company_id = app.current_company_id())
  with check (app.is_admin() and company_id = app.current_company_id());

-- 配信ログ: 管理者のみ（カップルには見せない）
create policy admin_company_message_drafts on message_drafts
  for all to app_couple
  using (app.is_admin() and company_id = app.current_company_id())
  with check (app.is_admin() and company_id = app.current_company_id());

-- ─── 登録（register）── security definer 関数 ───────────────────────────
-- customer 行がまだ無い匿名（検証済みセッションのみ）状態で行うため、RLS の例外を
-- この関数1個に限定する。line_id は GUC（検証済みセッション由来）からのみ取得し、
-- 引数では受け取らない（IDOR 構造根絶の維持）。
create or replace function app.register_customer(
  p_wedding_date date,
  p_name1 text,
  p_name2 text,
  p_venue_code text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_line_id  text := app.current_line_id();
  v_customer customers%rowtype;
  v_venue    venues%rowtype;
  v_company  uuid;
begin
  if coalesce(v_line_id, '') = '' then
    raise exception 'request.line_id is not set';
  end if;

  select * into v_customer from customers where line_id = v_line_id;
  if found then
    -- GAS と同じ: 既存でお名前が未登録のときだけ名前を補完する
    if (coalesce(v_customer.name1_kana, '') = '' or coalesce(v_customer.name2_kana, '') = '')
       and (coalesce(p_name1, '') <> '' or coalesce(p_name2, '') <> '') then
      update customers
        set name1_kana = coalesce(nullif(p_name1, ''), name1_kana),
            name2_kana = coalesce(nullif(p_name2, ''), name2_kana)
        where line_id = v_line_id
        returning * into v_customer;
    end if;
    select * into v_venue from venues where id = v_customer.venue_id;
    return jsonb_build_object(
      'status', 'exists',
      'venue_id', coalesce(v_venue.code, coalesce(p_venue_code, '')),
      'wedding_date', coalesce(to_char(v_customer.wedding_date, 'YYYY-MM-DD'), ''),
      'name1_kana', coalesce(v_customer.name1_kana, ''),
      'name2_kana', coalesce(v_customer.name2_kana, ''));
  end if;

  -- QR 経由の式場コードから company / venue を解決。無ければ既定 company（Phase A は単一テナント）。
  if coalesce(p_venue_code, '') <> '' then
    select * into v_venue from venues where code = p_venue_code and active limit 1;
  end if;
  if v_venue.id is not null then
    v_company := v_venue.company_id;
  else
    select id into v_company from companies order by created_at limit 1;
  end if;
  if v_company is null then
    raise exception 'no company configured';
  end if;

  -- 同じ line_id の過去進捗が残っていれば一掃（テスト/再ログインで完了済みが見える事故防止。GAS と同じ）
  delete from task_progress where line_id = v_line_id;

  insert into customers (line_id, company_id, venue_id, wedding_date, name1_kana, name2_kana)
  values (v_line_id, v_company, v_venue.id, p_wedding_date, coalesce(p_name1, ''), coalesce(p_name2, ''));

  return jsonb_build_object(
    'status', 'created',
    'venue_id', coalesce(v_venue.code, coalesce(p_venue_code, '')),
    'wedding_date', coalesce(to_char(p_wedding_date, 'YYYY-MM-DD'), ''));
end
$$;

revoke all on function app.register_customer(date, text, text, text) from public;
grant execute on function app.register_customer(date, text, text, text) to app_couple;
