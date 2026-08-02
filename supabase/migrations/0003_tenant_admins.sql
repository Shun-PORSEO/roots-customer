-- SaaS化 C1 — テナント管理者認証を Supabase Auth（メール）へ置き換え
--
-- 認可モデルの変更（D4）:
--   旧: 管理者 = customers.is_admin = true の LINE ユーザー（LIFF ログイン）
--   新: 管理者 = tenant_admins に行を持つ Supabase Auth ユーザー（auth.users ↔ companies）
--
--   接続ロールは引き続き app_couple のみ（service_role 不使用）。管理リクエストは
--   トランザクション内で SET LOCAL request.admin_id（検証済み管理者セッション由来の
--   auth.users.id）を注入し、app.is_admin() / app.current_company_id() が
--   tenant_admins 経由で「自社 company 内」へスコープする。
--   カップル経路（request.line_id）は無変更 — 既存 LIFF 認証は壊さない。
--   customers.is_admin 列はデータとして残るが、権限の根拠にはならない（deprecated）。

-- ─── tenant_admins（auth.users ↔ company）────────────────────────────────
create table tenant_admins (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  company_id   uuid not null references companies(id) on delete cascade,
  email        text not null default '',
  created_at   timestamptz not null default now()
);

create index on tenant_admins (company_id);

alter table tenant_admins enable row level security;
grant select on tenant_admins to app_couple;

-- ─── GUC ヘルパー ────────────────────────────────────────────────────────
-- 検証済み管理者セッション由来の auth.users.id。未設定なら null。
create or replace function app.current_admin_id() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.admin_id', true), '')::uuid $$;

grant execute on function app.current_admin_id() to app_couple;

-- 自分の tenant_admins 行だけは直接読める（会社解決・画面表示用）
create policy tenant_admin_self on tenant_admins
  for select to app_couple
  using (auth_user_id = app.current_admin_id());

-- ─── is_admin / current_company_id を tenant_admins 経由に置換 ───────────
-- 0002 の管理者ポリシーは全て app.is_admin() + app.current_company_id() を呼ぶため、
-- 関数の差し替えだけで全ポリシーが新モデルに切り替わる。
create or replace function app.is_admin() returns boolean
  language sql stable security definer set search_path = public
  as $$
    select exists (
      select 1 from tenant_admins where auth_user_id = app.current_admin_id())
  $$;

-- 管理者（tenant_admins）を優先し、カップル（customers）にフォールバック。
create or replace function app.current_company_id() returns uuid
  language sql stable security definer set search_path = public
  as $$
    select coalesce(
      (select company_id from tenant_admins where auth_user_id = app.current_admin_id()),
      (select company_id from customers where line_id = app.current_line_id()))
  $$;

-- ─── テナント作成（サインアップ直後の自己プロビジョニング）───────────────
-- Supabase Auth でユーザー作成済み（= request.admin_id が検証済みセッション由来）の
-- 状態で company + tenant_admins を作る。RLS の例外はこの関数1個に限定。
-- 冪等: 既に紐づいていれば既存 company を返す（再実行で重複を作らない）。
create or replace function app.provision_tenant(
  p_company_name text,
  p_email text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_admin_id uuid := app.current_admin_id();
  v_company  uuid;
begin
  if v_admin_id is null then
    raise exception 'request.admin_id is not set';
  end if;

  select company_id into v_company from tenant_admins where auth_user_id = v_admin_id;
  if found then
    return jsonb_build_object('status', 'exists', 'company_id', v_company);
  end if;

  if coalesce(trim(p_company_name), '') = '' then
    raise exception 'company_name is required';
  end if;

  insert into companies (name) values (trim(p_company_name)) returning id into v_company;
  insert into tenant_admins (auth_user_id, company_id, email)
  values (v_admin_id, v_company, coalesce(p_email, ''));

  return jsonb_build_object('status', 'created', 'company_id', v_company);
end
$$;

revoke all on function app.provision_tenant(text, text) from public;
grant execute on function app.provision_tenant(text, text) to app_couple;
