-- C4 受け入れテスト: subscriptions の分離と Stripe 同期関数（roots-concierge#5 / Epic roots-concierge#1）
--
-- 実行方法（supabase db reset で seed 適用後）:
--   psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/billing_c4.sql
-- すべての assert が通れば最後に「BILLING C4: ALL PASSED」が出る。1つでも破れば例外で停止する。
--
-- 検証内容:
--   1. 未認証（GUC 未設定）では subscriptions を読めず、insert も拒否される
--   2. テナントA管理者は自社のローカルトライアル行を作成・読み戻しできる
--   3. テナントA管理者は他社（B社）の company_id で行を作れない（with check 違反）
--   4. テナントB管理者からはA社の行が不可視
--   5. app.sync_stripe_subscription は GUC 無しで動き（Webhook 経路）、
--      metadata の company_id で新規作成 → customer id 逆引きで status を更新できる

set role app_couple;

-- ─── 1. 未認証は読めない・書けない ──────────────────────────────────────
begin;
do $$
begin
  if (select count(*) from subscriptions) <> 0 then
    raise exception 'FAIL(1a): unauthenticated request must not read subscriptions';
  end if;
  begin
    insert into subscriptions (company_id) values ('00000000-0000-0000-0000-000000000001');
    raise exception 'FAIL(1b): unauthenticated insert must be rejected';
  exception
    when insufficient_privilege then null; -- RLS 違反（期待どおり）
  end;
end $$;
rollback;

-- ─── 2. テナントA管理者: ローカルトライアル行の作成 → 読み戻し ──────────
begin;
select set_config('request.admin_id', '00000000-0000-0000-0000-00000000ad01', true);
do $$
declare r record;
begin
  insert into subscriptions (company_id, status, trial_end)
  values (app.current_company_id(), 'trialing', now() + interval '14 days')
  on conflict (company_id) do nothing;

  select * into r from subscriptions where company_id = app.current_company_id();
  if not found or r.status <> 'trialing' or r.trial_end is null then
    raise exception 'FAIL(2): admin A should create and read back own trial row';
  end if;
end $$;
rollback;

-- ─── 3. 他社の company_id では行を作れない ──────────────────────────────
begin;
select set_config('request.admin_id', '00000000-0000-0000-0000-00000000ad01', true);
do $$
begin
  begin
    insert into subscriptions (company_id) values ('00000000-0000-0000-0000-000000000002'); -- B社
    raise exception 'FAIL(3): admin A must not create subscription row for tenant B';
  exception
    when insufficient_privilege then null; -- with check 違反（期待どおり）
  end;
end $$;
rollback;

-- ─── 4. B社管理者からA社の行は不可視 ────────────────────────────────────
begin;
select set_config('request.admin_id', '00000000-0000-0000-0000-00000000ad01', true);
insert into subscriptions (company_id, status) values (app.current_company_id(), 'active');
select set_config('request.admin_id', '00000000-0000-0000-0000-00000000ad02', true);
do $$
begin
  if (select count(*) from subscriptions) <> 0 then
    raise exception 'FAIL(4): admin B must not see tenant A subscription';
  end if;
end $$;
rollback;

-- ─── 5. Webhook 同期関数（GUC 無し・security definer）──────────────────
begin;
do $$
declare
  ok boolean;
  r record;
begin
  -- customer id 未知 + company_id 無し → 解決できず false
  select app.sync_stripe_subscription('cus_unknown', 'sub_x', 'active') into ok;
  if ok then
    raise exception 'FAIL(5a): unresolvable customer must return false';
  end if;

  -- metadata の company_id で新規作成（Checkout 直後の subscription.created 相当）
  select app.sync_stripe_subscription(
    'cus_test1', 'sub_test1', 'trialing',
    '00000000-0000-0000-0000-000000000001', 'price_x',
    now() + interval '14 days', now() + interval '14 days', false) into ok;
  if not ok then
    raise exception 'FAIL(5b): sync with metadata company_id must succeed';
  end if;

  -- 以後は customer id 逆引きで更新（company_id を渡さない subscription.updated 相当）
  select app.sync_stripe_subscription('cus_test1', 'sub_test1', 'past_due') into ok;
  if not ok then
    raise exception 'FAIL(5c): re-sync by customer id must succeed';
  end if;

  -- definer なので postgres として直接検証
  set local role postgres;
  select * into r from subscriptions
  where company_id = '00000000-0000-0000-0000-000000000001';
  if not found or r.status <> 'past_due' or r.stripe_customer_id <> 'cus_test1' then
    raise exception 'FAIL(5d): synced row should have updated status (got %)', r.status;
  end if;
end $$;
rollback;

reset role;
select 'BILLING C4: ALL PASSED' as result;
