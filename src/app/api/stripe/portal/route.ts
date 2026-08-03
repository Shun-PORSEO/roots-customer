import { NextRequest } from "next/server";
import { readAdminSession } from "@/lib/server/session";
import { withAdminScope } from "@/lib/server/db";
import { ok, fail, newRequestId } from "@/lib/server/http";
import { stripeEnabled, StripeError, createPortalSession } from "@/lib/server/stripe";

export const runtime = "nodejs";

// POST /api/stripe/portal — Stripe Customer Portal の URL を発行する（SaaS化 C4）。
// 支払い方法の変更・解約・（past_due/canceled からの）復帰は Portal 側で行い、
// 結果は Webhook が subscriptions に同期する。
// 認可: テナント管理者セッション必須。customer は自社 subscriptions 行からのみ解決。
export async function POST(req: NextRequest) {
  const rid = newRequestId();

  const session = await readAdminSession();
  if (!session) {
    return fail("AUTH_REQUIRED", rid, {
      message: "ログインが必要です",
      hint: "/login からメールアドレスでログインしてください。",
    });
  }
  if (!stripeEnabled()) {
    return fail("VALIDATION", rid, {
      message: "この環境では Stripe 決済が構成されていません",
      hint: "STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / STRIPE_PRICE_ID を設定してください。",
    });
  }

  try {
    const customerId = await withAdminScope(session.adminId, async (tx) => {
      const [me] = await tx`select app.is_admin() as is_admin`;
      if (!me?.is_admin) throw new Error("forbidden");
      const [sub] = await tx`
        select stripe_customer_id from subscriptions
        where company_id = app.current_company_id()`;
      return (sub?.stripe_customer_id as string) || "";
    });

    if (!customerId) {
      return fail("VALIDATION", rid, {
        message: "Stripe のお客様情報がまだありません",
        hint: "先にトライアル開始（カード登録）を行ってください。",
      });
    }

    const url = await createPortalSession(customerId, `${req.nextUrl.origin}/admin/billing`);
    return ok({ status: "ok", url }, rid);
  } catch (e) {
    if (e instanceof StripeError) return fail("STRIPE_UPSTREAM", rid, { cause: e });
    if ((e as Error)?.message === "forbidden") return fail("FORBIDDEN_IDOR", rid);
    return fail("INTERNAL", rid, { cause: e });
  }
}
