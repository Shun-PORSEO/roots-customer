import "server-only";
import type postgres from "postgres";
import { stripeEnabled } from "./stripe";

// 課金状態の解決（SaaS化 C4）。subscriptions 行から「管理画面を使えるか」を判定する。
//
// 判定ルール（roots-concierge#5 の受け入れ条件）:
//   - 行なし（status="none"）      → 許可。オンボーディング途中 or C4 以前の既存テナント。
//     新規テナントはオンボーディング完了時に必ず行が作られるため、定常状態では
//     「trialing/active 以外はブロック」が仕様どおりに効く。
//   - trialing                     → 許可。ただし Stripe 管理外（ローカルトライアル =
//     stripe_subscription_id が空）で trial_end を過ぎていたら expired としてブロック。
//     Stripe 管理下のトライアルは Stripe が Webhook で状態遷移させるので期限は見ない。
//   - active                       → 許可。
//   - それ以外（past_due/canceled/unpaid/incomplete...）→ ブロック（データは保持）。

export type BillingInfo = {
  // "none" | "trialing" | "active" | "past_due" | "canceled" | ... | "expired"
  status: string;
  // 管理画面を利用できるか（trialing/active のみ true）
  active: boolean;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  has_stripe_customer: boolean;
  has_stripe_subscription: boolean;
  // サーバーに Stripe が構成されているか（UI が Checkout/Portal 導線を出す判断に使う）
  stripe_enabled: boolean;
};

type Tx = postgres.TransactionSql;

export async function readBilling(tx: Tx): Promise<BillingInfo> {
  const [row] = await tx`
    select status, stripe_customer_id, stripe_subscription_id,
           trial_end, current_period_end, cancel_at_period_end
    from subscriptions where company_id = app.current_company_id()`;

  if (!row) {
    return {
      status: "none",
      active: true,
      trial_end: null,
      current_period_end: null,
      cancel_at_period_end: false,
      has_stripe_customer: false,
      has_stripe_subscription: false,
      stripe_enabled: stripeEnabled(),
    };
  }

  const hasStripeSub = (row.stripe_subscription_id as string) !== "";
  let status = row.status as string;
  let active = status === "trialing" || status === "active";
  // ローカルトライアル（Stripe 管理外）の期限切れ判定
  if (status === "trialing" && !hasStripeSub) {
    const trialEnd = row.trial_end as Date | null;
    if (trialEnd && trialEnd.getTime() < Date.now()) {
      status = "expired";
      active = false;
    }
  }

  return {
    status,
    active,
    trial_end: row.trial_end ? (row.trial_end as Date).toISOString() : null,
    current_period_end: row.current_period_end
      ? (row.current_period_end as Date).toISOString()
      : null,
    cancel_at_period_end: !!row.cancel_at_period_end,
    has_stripe_customer: (row.stripe_customer_id as string) !== "",
    has_stripe_subscription: hasStripeSub,
    stripe_enabled: stripeEnabled(),
  };
}
