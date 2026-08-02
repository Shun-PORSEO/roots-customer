-- C3 受け入れテスト: オンボーディング進捗の保存と分離（roots-concierge#4 / Epic roots-concierge#1）
--
-- 実行方法（supabase db reset で seed 適用後）:
--   psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/onboarding_c3.sql
-- すべての assert が通れば最後に「ONBOARDING C3: ALL PASSED」が出る。1つでも破れば例外で停止する。
--
-- 検証内容:
--   1. 未認証（GUC 未設定）では onboarding_progress を読めず、insert も拒否される
--   2. テナントA管理者は自社の進捗行を upsert・更新でき、読み戻せる（中断→再開の実体）
--   3. テナントA管理者は他社（B社）の company_id で行を作れない（with check 違反）
--   4. テナントB管理者からはA社の進捗行が不可視
--   5. current_step は 1..4 のみ（check 制約）

set role app_couple;

-- ─── 1. 未認証は読めない・書けない ──────────────────────────────────────
begin;
do $$
begin
  if (select count(*) from onboarding_progress) <> 0 then
    raise exception 'FAIL(1a): unauthenticated request must not read onboarding_progress';
  end if;
  begin
    insert into onboarding_progress (company_id)
    values ('00000000-0000-0000-0000-000000000001');
    raise exception 'FAIL(1b): unauthenticated insert must be rejected';
  exception
    when insufficient_privilege then null; -- RLS 違反（期待どおり）
  end;
end $$;
rollback;

-- ─── 2. テナントA管理者: upsert → 読み戻し（再開）→ 完了 ────────────────
begin;
select set_config('request.admin_id', '00000000-0000-0000-0000-00000000ad01', true);
do $$
declare
  r record;
begin
  insert into onboarding_progress (company_id, current_step, venue_code)
  values (app.current_company_id(), 2, 'RC001')
  on conflict (company_id) do update set
    current_step = excluded.current_step, venue_code = excluded.venue_code, updated_at = now();

  select * into r from onboarding_progress where company_id = app.current_company_id();
  if not found or r.current_step <> 2 or r.venue_code <> 'RC001' then
    raise exception 'FAIL(2a): admin A should read back own onboarding progress (resume)';
  end if;

  -- 接続テスト合格の記録 → 完了（API サーバーが行う更新と同じ経路が RLS を通ること）
  update onboarding_progress
  set line_test_passed_at = now(), current_step = 4, completed_at = now()
  where company_id = app.current_company_id();

  select * into r from onboarding_progress where company_id = app.current_company_id();
  if r.completed_at is null or r.line_test_passed_at is null then
    raise exception 'FAIL(2b): admin A should update own progress to completed';
  end if;
end $$;
rollback;

-- ─── 3. 他社の company_id では行を作れない ──────────────────────────────
begin;
select set_config('request.admin_id', '00000000-0000-0000-0000-00000000ad01', true);
do $$
begin
  begin
    insert into onboarding_progress (company_id)
    values ('00000000-0000-0000-0000-000000000002'); -- B社
    raise exception 'FAIL(3): admin A must not create onboarding row for tenant B';
  exception
    when insufficient_privilege then null; -- with check 違反（期待どおり）
  end;
end $$;
rollback;

-- ─── 4. B社管理者からA社の進捗は不可視 ──────────────────────────────────
begin;
select set_config('request.admin_id', '00000000-0000-0000-0000-00000000ad01', true);
insert into onboarding_progress (company_id, current_step, venue_code)
values (app.current_company_id(), 3, 'RC001');
-- 同一トランザクション内で B 社管理者に切り替える（GUC は上書き）
select set_config('request.admin_id', '00000000-0000-0000-0000-00000000ad02', true);
do $$
begin
  if (select count(*) from onboarding_progress) <> 0 then
    raise exception 'FAIL(4): admin B must not see tenant A onboarding progress';
  end if;
end $$;
rollback;

-- ─── 5. current_step は 1..4 のみ ───────────────────────────────────────
begin;
select set_config('request.admin_id', '00000000-0000-0000-0000-00000000ad01', true);
do $$
begin
  begin
    insert into onboarding_progress (company_id, current_step)
    values (app.current_company_id(), 5);
    raise exception 'FAIL(5): current_step > 4 must violate check constraint';
  exception
    when check_violation then null; -- 期待どおり
  end;
end $$;
rollback;

reset role;
select 'ONBOARDING C3: ALL PASSED' as result;
