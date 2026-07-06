-- Phase A 縦スライス #1 用スキーマ（getTasksAndUser フロー）
-- 設計: shun-main-design-20260705-230937.md / autoplan Eng レビュー訂正反映
--
-- 認可モデル（カップル経路）:
--   アプリは非特権ロール app_couple で接続（NOBYPASSRLS）。
--   各リクエストはトランザクション内で SET LOCAL request.line_id を注入し、
--   RLS ポリシーが current_setting('request.line_id') で行スコープする。
--   → service_role を使わないので「WHERE 絞り込み忘れ」も RLS が捕捉する多層防御。

create schema if not exists app;

-- リクエストスコープの line_id を返す（未設定なら空文字→どのポリシーにも一致しない）
create or replace function app.current_line_id() returns text
  language sql stable
  as $$ select coalesce(current_setting('request.line_id', true), '') $$;

-- ─── テーブル ───────────────────────────────────────────────────────────
create table companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table venues (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  venue_name  text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table customers (
  line_id     text primary key,
  company_id  uuid not null references companies(id) on delete cascade,
  venue_id    uuid references venues(id) on delete set null,
  wedding_date date,
  name1_kana  text not null default '',
  name2_kana  text not null default '',
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- 共有タスク雛形（プロダクトコンテンツ。company 単位。target なし）
create table task_master (
  task_id       text primary key,
  company_id    uuid not null references companies(id) on delete cascade,
  category      text not null default '',
  task_content  text not null default '',
  due_formula   text not null default '',
  due_estimate  text not null default '',
  memo          text not null default '',
  manual_url    text not null default '',
  is_active     boolean not null default true
);

-- カップル固有のカスタムタスク（Eng レビュー: 共有雛形と混ぜず別テーブルに正規化）
create table custom_tasks (
  task_id         text primary key,
  company_id      uuid not null references companies(id) on delete cascade,
  target_line_id  text not null references customers(line_id) on delete cascade,
  category        text not null default '',
  task_content    text not null default '',
  due_formula     text not null default '',
  due_estimate    text not null default '',
  memo            text not null default '',
  manual_url      text not null default '',
  is_active       boolean not null default true
);

create table task_progress (
  line_id     text not null references customers(line_id) on delete cascade,
  task_id     text not null,
  is_done     boolean not null default false,
  comment     text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (line_id, task_id)
);

-- 表示/非表示（Eng レビュー: task_master と混ぜず別テーブルに）
create table task_visibility (
  line_id  text not null references customers(line_id) on delete cascade,
  task_id  text not null,
  hidden   boolean not null default false,
  primary key (line_id, task_id)
);

-- ─── RLS ────────────────────────────────────────────────────────────────
alter table companies      enable row level security;
alter table venues         enable row level security;
alter table customers      enable row level security;
alter table task_master    enable row level security;
alter table custom_tasks   enable row level security;
alter table task_progress  enable row level security;
alter table task_visibility enable row level security;

-- 非特権ロール。LOGIN + NOBYPASSRLS（RLS を必ず通す）。パスワードは migration 後に別途設定。
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_couple') then
    create role app_couple login noinherit;
  end if;
end $$;

grant usage on schema public, app to app_couple;
grant execute on function app.current_line_id() to app_couple;
grant select on companies, venues, task_master, custom_tasks, customers to app_couple;
grant select, insert, update on task_progress to app_couple;
grant select, insert, update on task_visibility to app_couple;

-- deny-by-default: ポリシーに一致した行だけ見える。
-- 自分の customer 行のみ
create policy couple_self_customer on customers
  for select to app_couple
  using (line_id = app.current_line_id());

-- 自社の共有タスク雛形（自分の company のもの）
create policy couple_company_task_master on task_master
  for select to app_couple
  using (company_id = (select c.company_id from customers c where c.line_id = app.current_line_id()));

-- 自分に割り当てられたカスタムタスク
create policy couple_own_custom_tasks on custom_tasks
  for select to app_couple
  using (target_line_id = app.current_line_id());

-- 自社の venue（参照用）
create policy couple_company_venues on venues
  for select to app_couple
  using (company_id = (select c.company_id from customers c where c.line_id = app.current_line_id()));

-- 自社の company 行（参照用）
create policy couple_own_company on companies
  for select to app_couple
  using (id = (select c.company_id from customers c where c.line_id = app.current_line_id()));

-- 自分の進捗（読み書き）
create policy couple_own_progress on task_progress
  for all to app_couple
  using (line_id = app.current_line_id())
  with check (line_id = app.current_line_id());

-- 自分の表示制御（読み書き）
create policy couple_own_visibility on task_visibility
  for all to app_couple
  using (line_id = app.current_line_id())
  with check (line_id = app.current_line_id());

-- インデックス
create index on customers (company_id);
create index on task_master (company_id) where is_active;
create index on custom_tasks (target_line_id) where is_active;
create index on task_progress (line_id);
