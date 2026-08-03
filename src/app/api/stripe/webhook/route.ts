import { NextRequest } from "next/server";
import { sql } from "@/lib/server/db";
import { ok, fail, newRequestId } from "@/lib/server/http";
import {
  verifyStripeSignature,
  subscriptionPeriodEnd,
  subscriptionPriceId,
  epochToIso,
  type StripeSubscription,
} from "@/lib/server/stripe";

export const runtime = "nodejs";

// POST /api/stripe/webhook — Stripe からの状態通知（SaaS化 C4）。
// customer.subscription.{created,updated,deleted} を subscriptions テーブルに同期する。
// trialing → active → past_due → canceled 等の遷移は全てここを通る（Portal での復帰も同様）。
//
// 認可: セッションは無い。署名検証（STRIPE_WEBHOOK_SECRET, 生ボディに対する HMAC）を
// 通過したリクエストのみ、security definer 関数 app.sync_stripe_subscription で書き込む
// （RLS の例外を関数1個に限定。LINE Webhook / C2 と同じ構造）。
export async function POST(req: NextRequest) {
  const rid = newRequestId();

  // 署名は「受信した生のボディ」に対して検証する（JSON parse 後の再構成は不可）
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!verifyStripeSignature(rawBody, signature)) {
    return fail("AUTH_REQUIRED", rid, {
      message: "Stripe Webhook の署名検証に失敗しました",
      hint: "STRIPE_WEBHOOK_SECRET がこのエンドポイント用の signing secret と一致しているか確認してください。",
    });
  }

  let event: { id?: string; type?: string; data?: { object?: unknown } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return fail("VALIDATION", rid);
  }

  const type = event.type ?? "";
  if (!type.startsWith("customer.subscription.")) {
    // 契約状態に関係ないイベントは受領だけ返す（購読イベントを絞っていない環境への保険）
    return ok({ status: "ignored" }, rid);
  }

  const sub = event.data?.object as StripeSubscription | undefined;
  if (!sub?.id || !sub.customer) return fail("VALIDATION", rid);

  try {
    const companyId = sub.metadata?.company_id || null;
    const [row] = await sql()`
      select app.sync_stripe_subscription(
        ${sub.customer}, ${sub.id}, ${sub.status},
        ${companyId}::uuid, ${subscriptionPriceId(sub)},
        ${epochToIso(sub.trial_end)}::timestamptz,
        ${epochToIso(subscriptionPeriodEnd(sub))}::timestamptz,
        ${!!sub.cancel_at_period_end}
      ) as synced`;
    if (!row?.synced) {
      // company を解決できない customer（別環境の Stripe アカウント等）。
      // Stripe に再送させても解決しないので 200 で受領し、ログにだけ残す。
      console.warn(`[${rid}] stripe webhook: company 未解決 customer=${sub.customer} event=${event.id}`);
      return ok({ status: "unresolved" }, rid);
    }
    console.log(`[${rid}] stripe webhook synced: ${type} customer=${sub.customer} status=${sub.status}`);
    return ok({ status: "ok" }, rid);
  } catch (e) {
    // DB 障害時は 500 を返して Stripe に再送させる
    return fail("INTERNAL", rid, { cause: e });
  }
}
