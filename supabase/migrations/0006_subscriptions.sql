-- SaaS化 C4 — Stripe 課金の状態同期（roots-concierge#5）
--
-- subscriptions は company ↔ Stripe customer/subscription/status を 1:1 で持つ。
-- Stripe が課金状態の正であり、この行は Webhook / Checkout 確認 API が同期する
-- 読み取り用キャッシュ。trialing/active 以外の company は管理画面がブロックされる
-- （データは保持。Customer Portal から復帰すると Webhook で行が更新され解除される）。
--
-- Stripe 未設定環境（ローカル開発）ではオンボーディング完了時に
-- stripe_* が空の「ローカルトライアル」行（status='trialing', trial_end=+14日）を作る。
-- この場合の期限判定はアプリ側（trial_end 経過で expired 扱い）。
--
-- 認可モデル:
--   読み書きはテナント管理者本人のみ（既存の管理者ポリシーと同型）。
--   Stripe Webhook だけは「検証済みセッションが無い」経路のため、C2 の
--   venue_line_config と同じく security definer 関数 1 個
--   （app.sync_stripe_subscription）に RLS の例外を限定する。
--   呼び出しは Webhook 署名検証（STRIPE_WEBHOOK_SECRET）を通過した後のみ。

create table subscriptions (
  company_id  uuid primary key references companies(id) on delete cascade,
  stripe_customer_id     text not null default '',
  stripe_subscription_id text not null default '',
  -- Stripe の subscription.status（trialing/active/past_due/canceled/unpaid/...）。
  -- ローカルトライアルも 'trialing' を使う（stripe_subscription_id が空で区別）。
  status      text not null default 'incomplete',
  price_id    text not null default '',
  trial_end            timestamptz,
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Webhook が customer id から company を逆引きする（空文字は照合しない）
create unique index subscriptions_stripe_customer_key
  on subscriptions (stripe_customer_id) where stripe_customer_id <> '';

alter table subscriptions enable row level security;
grant select, insert, update on subscriptions to app_couple;

create policy subscriptions_admin_all on subscriptions
  for all to app_couple
  using (app.is_admin() and company_id = app.current_company_id())
  with check (app.is_admin() and company_id = app.current_company_id());

-- ─── Stripe Webhook 用の同期関数（未認証経路・署名検証済み前提）────────────
-- company の解決: 既存行の stripe_customer_id 一致 → それが正。
-- 無ければ p_company_id（Checkout 作成時に customer/subscription の metadata に
-- 埋めた company_id）で新規作成。どちらでも解決できなければ false（呼び出し側でログ）。
create or replace function app.sync_stripe_subscription(
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_status text,
  p_company_id uuid default null,
  p_price_id text default '',
  p_trial_end timestamptz default null,
  p_current_period_end timestamptz default null,
  p_cancel_at_period_end boolean default false
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_company uuid;
begin
  if coalesce(p_stripe_customer_id, '') = '' then
    return false;
  end if;

  select company_id into v_company
  from subscriptions where stripe_customer_id = p_stripe_customer_id;
  if v_company is null then
    v_company := p_company_id;
  end if;
  if v_company is null then
    return false;
  end if;

  insert into subscriptions (company_id, stripe_customer_id, stripe_subscription_id,
                             status, price_id, trial_end, current_period_end, cancel_at_period_end)
  values (v_company, p_stripe_customer_id, coalesce(p_stripe_subscription_id, ''),
          coalesce(nullif(p_status, ''), 'incomplete'), coalesce(p_price_id, ''),
          p_trial_end, p_current_period_end, coalesce(p_cancel_at_period_end, false))
  on conflict (company_id) do update set
    stripe_customer_id     = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    status                 = excluded.status,
    price_id               = case when excluded.price_id <> '' then excluded.price_id
                                  else subscriptions.price_id end,
    trial_end              = excluded.trial_end,
    current_period_end     = excluded.current_period_end,
    cancel_at_period_end   = excluded.cancel_at_period_end,
    updated_at             = now();
  return true;
end
$$;

revoke all on function app.sync_stripe_subscription(text, text, text, uuid, text, timestamptz, timestamptz, boolean) from public;
grant execute on function app.sync_stripe_subscription(text, text, text, uuid, text, timestamptz, timestamptz, boolean) to app_couple;
