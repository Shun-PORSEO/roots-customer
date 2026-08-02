-- SaaS化 C3 — オンボーディングウィザードの進捗保存（roots-concierge#4）
--
-- サインアップ後のウィザード（/onboarding）の「どこまで進んだか」を company 単位で
-- 1 行持つ。中断→再開はこの行を読み戻すだけ（Step 内の入力値は venues 等の実体に
-- 保存済みなので、ここには保存しない）。
--
-- 認可モデル:
--   行の作成・更新はテナント管理者本人のみ（既存の管理者ポリシーと同型:
--   app.is_admin() + 自社 company_id）。security definer の例外は増やさない。
--   line_test_passed_at はクライアント申告では書かず、testLineConnection の
--   実行結果（4点全て ✓）を見て API サーバーが更新する（偽装不可のゲート）。

create table onboarding_progress (
  company_id  uuid primary key references companies(id) on delete cascade,
  -- 1=式場情報 2=LINEキー入力 3=接続テスト 4=トライアル開始（C4 で Stripe Checkout に差し替え）
  current_step int not null default 1 check (current_step between 1 and 4),
  -- Step1 で作成した式場（venues.code）。ウィザードは以降この式場を操作する
  venue_code  text not null default '',
  -- 接続テスト（testLineConnection）が4点全て ✓ になった時刻。失敗したら null に戻す
  line_test_passed_at timestamptz,
  completed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table onboarding_progress enable row level security;
grant select, insert, update on onboarding_progress to app_couple;

create policy onboarding_admin_all on onboarding_progress
  for all to app_couple
  using (app.is_admin() and company_id = app.current_company_id())
  with check (app.is_admin() and company_id = app.current_company_id());
