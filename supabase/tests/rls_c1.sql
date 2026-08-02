-- C1 受け入れテスト: クロステナント遮断の証明（roots-concierge#2 / Epic roots-concierge#1）
--
-- 実行方法（supabase db reset で seed 適用後）:
--   psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/rls_c1.sql
-- すべての assert が通れば最後に「RLS C1: ALL PASSED」が出る。1つでも破れば例外で停止する。
--
-- 検証内容:
--   1. テナントA管理者は自社の顧客/式場だけが見え、B社の行は不可視
--   2. テナントA管理者はB社の式場を更新できない（0行更新）
--   3. GUC 未設定（未認証）では is_admin=false・顧客0行
--   4. 旧 customers.is_admin=true の LINE ユーザーはもう管理者ではない（D4 廃止の証明）
--   5. カップルは自分の行のみ。他テナントのカップル行は不可視

set role app_couple;

-- ─── 1. テナントA管理者のスコープ ───────────────────────────────────────
begin;
select set_config('request.admin_id', '00000000-0000-0000-0000-00000000ad01', true);

do $$
begin
  if not app.is_admin() then
    raise exception 'FAIL(1a): admin A should be admin';
  end if;
  if (select count(*) from customers where line_id = 'UdevB123') <> 0 then
    raise exception 'FAIL(1b): admin A must NOT see tenant B customers';
  end if;
  if (select count(*) from customers where line_id = 'Udev123') <> 1 then
    raise exception 'FAIL(1c): admin A should see own tenant customers';
  end if;
  if (select count(*) from venues where code = 'RB001') <> 0 then
    raise exception 'FAIL(1d): admin A must NOT see tenant B venues (write policy scope)';
  end if;
end $$;

-- ─── 2. 他社リソースへの書き込みは0行 ───────────────────────────────────
do $$
declare v_count int;
begin
  update venues set venue_name = 'のっとり' where code = 'RB001';
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL(2): admin A must NOT update tenant B venue';
  end if;
end $$;
rollback;

-- ─── 3. 未認証（GUC 無し）────────────────────────────────────────────────
begin;
do $$
begin
  if app.is_admin() then
    raise exception 'FAIL(3a): no GUC should not be admin';
  end if;
  if (select count(*) from customers) <> 0 then
    raise exception 'FAIL(3b): no GUC should see zero customers';
  end if;
end $$;
rollback;

-- ─── 4. 旧 LINE 管理者（customers.is_admin）は廃止済み ──────────────────
begin;
select set_config('request.line_id', 'Uadmin123', true);
do $$
begin
  if app.is_admin() then
    raise exception 'FAIL(4): legacy customers.is_admin must no longer grant admin';
  end if;
end $$;
rollback;

-- ─── 5. カップルは自分のテナント/行だけ ─────────────────────────────────
begin;
select set_config('request.line_id', 'Udev123', true);
do $$
begin
  if (select count(*) from customers where line_id <> 'Udev123') <> 0 then
    raise exception 'FAIL(5a): couple must see only own customer row';
  end if;
  if (select count(*) from task_progress where line_id <> 'Udev123') <> 0 then
    raise exception 'FAIL(5b): couple must see only own progress';
  end if;
end $$;
rollback;

reset role;
select 'RLS C1: ALL PASSED' as result;
