-- C5 受け入れテスト: Cron リマインドの冪等化と ai_usage の分離（roots-concierge#6 / Epic roots-concierge#1）
--
-- 実行方法（supabase db reset で seed 適用後）:
--   psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/cron_ai_c5.sql
-- すべての assert が通れば最後に「CRON/AI C5: ALL PASSED」が出る。1つでも破れば例外で停止する。
--
-- 検証内容:
--   1. cron_reminder_data は GUC 無し（Cron 経路）で全 company の venue/customer を返す
--   2. cron_claim_reminder は同日同 (couple, task) の 2 回目で null（重複送信ゼロの根拠）
--   3. 翌日は再び claim できる（日次リマインドは日付でリセット）
--   4. cron_mark_failed で claim 済み行を failed にできる
--   5. ai_usage はテナント間で不可視・他社行は作れない・自社はインクリメントできる

set role app_couple;

-- ─── 1. Cron データ取得（GUC 無し・security definer）───────────────────
begin;
do $$
declare d jsonb;
begin
  select app.cron_reminder_data(current_date) into d;
  -- seed には A社 RC001 / B社 RB001 の 2 venue がある（両方 active）
  if jsonb_array_length(d->'venues') < 2 then
    raise exception 'FAIL(1a): cron data must span all companies (venues=%)',
      jsonb_array_length(d->'venues');
  end if;
  if jsonb_array_length(d->'customers') < 1 then
    raise exception 'FAIL(1b): cron data must include customers with wedding_date';
  end if;
  if jsonb_array_length(d->'tasks') < 1 then
    raise exception 'FAIL(1c): cron data must include active tasks';
  end if;
end $$;
rollback;

-- ─── 2. claim の冪等性（同日 2 回目は null）─────────────────────────────
begin;
do $$
declare
  d1 text;
  d2 text;
begin
  select app.cron_claim_reminder(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-0000000000a1',
    'Udev123', 'T005', 'リマインド本文', current_date) into d1;
  if d1 is null then
    raise exception 'FAIL(2a): first claim must return draft_id';
  end if;

  select app.cron_claim_reminder(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-0000000000a1',
    'Udev123', 'T005', 'リマインド本文', current_date) into d2;
  if d2 is not null then
    raise exception 'FAIL(2b): second claim on same day must return null (dedup)';
  end if;

  -- ─── 3. 翌日は再び claim できる ───────────────────────────────────────
  select app.cron_claim_reminder(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-0000000000a1',
    'Udev123', 'T005', 'リマインド本文', current_date + 1) into d2;
  if d2 is null then
    raise exception 'FAIL(3): claim must succeed again on the next day';
  end if;

  -- ─── 4. 送信失敗の記録 ───────────────────────────────────────────────
  perform app.cron_mark_failed(d1);
  set local role postgres;
  if (select status from message_drafts where draft_id = d1) <> 'failed' then
    raise exception 'FAIL(4): claimed draft must be markable as failed';
  end if;
end $$;
rollback;

-- ─── 5. ai_usage のテナント分離とインクリメント ─────────────────────────
begin;
select set_config('request.admin_id', '00000000-0000-0000-0000-00000000ad01', true);
do $$
declare c int;
begin
  insert into ai_usage (company_id, used_on, count)
  values (app.current_company_id(), current_date, 1)
  on conflict (company_id, used_on) do update set count = ai_usage.count + 1
  returning count into c;
  if c <> 1 then
    raise exception 'FAIL(5a): first usage must be 1 (got %)', c;
  end if;

  insert into ai_usage (company_id, used_on, count)
  values (app.current_company_id(), current_date, 1)
  on conflict (company_id, used_on) do update set count = ai_usage.count + 1
  returning count into c;
  if c <> 2 then
    raise exception 'FAIL(5b): second usage must increment to 2 (got %)', c;
  end if;

  begin
    insert into ai_usage (company_id, used_on, count)
    values ('00000000-0000-0000-0000-000000000002', current_date, 1); -- B社
    raise exception 'FAIL(5c): admin A must not write ai_usage for tenant B';
  exception
    when insufficient_privilege then null; -- with check 違反（期待どおり）
  end;
end $$;
-- B社管理者からはA社の使用量が不可視
select set_config('request.admin_id', '00000000-0000-0000-0000-00000000ad02', true);
do $$
begin
  if (select count(*) from ai_usage) <> 0 then
    raise exception 'FAIL(5d): admin B must not see tenant A ai_usage';
  end if;
end $$;
rollback;

reset role;
select 'CRON/AI C5: ALL PASSED' as result;
