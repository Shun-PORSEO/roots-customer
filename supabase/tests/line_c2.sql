-- C2 受け入れテスト: LINE マルチテナント化の DB 層（roots-concierge#3 / Epic roots-concierge#1）
--
-- 実行方法（supabase db reset で seed 適用後）:
--   psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/line_c2.sql
-- すべての assert が通れば最後に「LINE C2: ALL PASSED」が出る。1つでも破れば例外で停止する。
--
-- 検証内容:
--   1. 未認証（GUC 未設定）では venues を直接 select できない（RLS deny-by-default の維持）
--   2. 未認証でも app.venue_line_config(code) で該当 venue の LINE 設定だけは解決できる（Webhook 経路）
--   3. LIFF ID でも解決できる（ログイン前の ID Token 検証経路）
--   4. 空文字・未知のコードでは 1 行も返らない（default '' の全件一致が起きない）
--   5. venue_line_config は channel_access_token を返さない（最小権限）

set role app_couple;

-- ─── 1. 未認証では venues 直読み不可 ────────────────────────────────────
begin;
do $$
begin
  if (select count(*) from venues) <> 0 then
    raise exception 'FAIL(1): unauthenticated request must not read venues directly';
  end if;
end $$;
rollback;

-- ─── 2. Webhook 経路: code で LINE 設定を解決 ───────────────────────────
begin;
do $$
declare
  r record;
begin
  select * into r from app.venue_line_config('RC001', null);
  if not found then
    raise exception 'FAIL(2a): venue_line_config by code should resolve RC001';
  end if;
  if r.line_channel_secret <> 'dev-channel-secret' then
    raise exception 'FAIL(2b): channel secret mismatch';
  end if;
  if r.line_login_channel_id <> '2001234567' then
    raise exception 'FAIL(2c): login channel id mismatch';
  end if;
end $$;
rollback;

-- ─── 3. ログイン経路: LIFF ID で解決 ────────────────────────────────────
begin;
do $$
declare
  r record;
begin
  select * into r from app.venue_line_config(null, '2001234567-abcd1234');
  if not found or r.code <> 'RC001' then
    raise exception 'FAIL(3): venue_line_config by liff_id should resolve RC001';
  end if;
end $$;
rollback;

-- ─── 4. 空文字・未知コードは 0 行 ───────────────────────────────────────
begin;
do $$
begin
  if exists (select 1 from app.venue_line_config('', '')) then
    raise exception 'FAIL(4a): empty args must not match any venue';
  end if;
  if exists (select 1 from app.venue_line_config('NO_SUCH', null)) then
    raise exception 'FAIL(4b): unknown code must not match';
  end if;
end $$;
rollback;

-- ─── 5. access token は関数から出ない（列が存在しないこと）──────────────
do $$
begin
  if exists (
    select 1 from information_schema.parameters
    where specific_schema = 'app'
      and specific_name like 'venue_line_config%'
      and parameter_name = 'line_channel_access_token'
  ) then
    raise exception 'FAIL(5): venue_line_config must not expose channel access token';
  end if;
end $$;

reset role;
select 'LINE C2: ALL PASSED' as result;
