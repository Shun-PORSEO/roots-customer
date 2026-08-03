import { NextRequest } from "next/server";
import { z } from "zod";
import { readAdminSession } from "@/lib/server/session";
import { withAdminScope } from "@/lib/server/db";
import { ok, fail, newRequestId } from "@/lib/server/http";
import { readBilling } from "@/lib/server/billing";
import {
  stripeEnabled,
  StripeError,
  createStripeCustomer,
  createCheckoutSession,
  getCheckoutSession,
  subscriptionPeriodEnd,
  subscriptionPriceId,
  epochToIso,
} from "@/lib/server/stripe";

export const runtime = "nodejs";

// POST /api/stripe/checkout — Stripe Checkout（14日トライアル付き月額サブスク）。SaaS化 C4。
//   {mode:"start", return_to?}          → Checkout Session を作成して URL を返す（クライアントがリダイレクト）
//   {mode:"confirm", session_id}        → Checkout 完了後の戻りで呼ぶ。Stripe に実状態を照会して
//                                         subscriptions 行を同期し、オンボーディングを完了させる。
//                                         Webhook と二重に同期するのは「戻った瞬間に使える」ため
//                                         （Webhook の遅延に画面遷移を依存させない）。
// 認可: テナント管理者セッション必須。company_id はセッション由来のみ（body からは受けない）。

const Body = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("start"),
    // 戻り先（既定は onboarding。期限切れ後の再契約は billing から呼ぶ）
    return_to: z.enum(["onboarding", "billing"]).default("onboarding"),
  }),
  z.object({ mode: z.literal("confirm"), session_id: z.string().min(1) }),
]);

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

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return fail("VALIDATION", rid);
  }

  try {
    if (body.mode === "start") {
      // 自社の company_id と既存の Stripe customer を解決（RLS で自社行のみ）
      const { companyId, customerId } = await withAdminScope(session.adminId, async (tx) => {
        const [me] = await tx`select app.is_admin() as is_admin,
                                     app.current_company_id() as company_id`;
        if (!me?.is_admin || !me.company_id) throw new Error("forbidden");
        const [sub] = await tx`
          select stripe_customer_id from subscriptions
          where company_id = app.current_company_id()`;
        return {
          companyId: me.company_id as string,
          customerId: (sub?.stripe_customer_id as string) || "",
        };
      });

      // Stripe customer が無ければ作成し、subscriptions 行に保存（以後使い回す）
      let customer = customerId;
      if (!customer) {
        customer = await createStripeCustomer(session.email, companyId);
        await withAdminScope(session.adminId, async (tx) => {
          await tx`
            insert into subscriptions (company_id, stripe_customer_id)
            values (app.current_company_id(), ${customer})
            on conflict (company_id) do update set
              stripe_customer_id = case when subscriptions.stripe_customer_id = ''
                                        then excluded.stripe_customer_id
                                        else subscriptions.stripe_customer_id end,
              updated_at = now()`;
        });
      }

      const origin = req.nextUrl.origin;
      const backPath = body.return_to === "billing" ? "/admin/billing" : "/onboarding";
      const checkout = await createCheckoutSession({
        customerId: customer,
        companyId,
        successUrl: `${origin}${backPath}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}${backPath}?checkout=cancel`,
      });
      return ok({ status: "ok", url: checkout.url }, rid);
    }

    // ── confirm: Checkout の実結果を Stripe に照会して同期 ──
    const cs = await getCheckoutSession(body.session_id);
    const result = await withAdminScope(session.adminId, async (tx) => {
      const [me] = await tx`select app.is_admin() as is_admin,
                                   app.current_company_id() as company_id`;
      if (!me?.is_admin || !me.company_id) throw new Error("forbidden");

      // 自社の Checkout であることを metadata で検証（他社 session_id の流用防止）
      if (cs.metadata.company_id !== (me.company_id as string)) {
        return { forbidden: true as const };
      }
      const sub = cs.subscription;
      if (cs.status !== "complete" || !sub) {
        return { incomplete: true as const };
      }

      await tx`
        insert into subscriptions (company_id, stripe_customer_id, stripe_subscription_id,
                                   status, price_id, trial_end, current_period_end, cancel_at_period_end)
        values (app.current_company_id(), ${sub.customer}, ${sub.id},
                ${sub.status}, ${subscriptionPriceId(sub)},
                ${epochToIso(sub.trial_end)}, ${epochToIso(subscriptionPeriodEnd(sub))},
                ${!!sub.cancel_at_period_end})
        on conflict (company_id) do update set
          stripe_customer_id     = excluded.stripe_customer_id,
          stripe_subscription_id = excluded.stripe_subscription_id,
          status                 = excluded.status,
          price_id               = excluded.price_id,
          trial_end              = excluded.trial_end,
          current_period_end     = excluded.current_period_end,
          cancel_at_period_end   = excluded.cancel_at_period_end,
          updated_at             = now()`;

      // 決済まで済んだらオンボーディングを完了扱いにする（接続テスト全緑はここでも必須。
      // saveOnboarding と同じサーバー側ゲートで、Checkout だけ先に済ませても Step3 は飛ばせない）
      await tx`
        update onboarding_progress
        set completed_at = now(), current_step = 4, updated_at = now()
        where company_id = app.current_company_id()
          and completed_at is null
          and line_test_passed_at is not null`;

      return { billing: await readBilling(tx) };
    });

    if ("forbidden" in result) return fail("FORBIDDEN_IDOR", rid);
    if ("incomplete" in result) {
      return fail("VALIDATION", rid, {
        message: "決済が完了していません",
        hint: "Checkout を最後まで完了してから再度お試しください。",
      });
    }
    return ok({ status: "ok", billing: result.billing }, rid);
  } catch (e) {
    if (e instanceof StripeError) {
      return fail("STRIPE_UPSTREAM", rid, { cause: e });
    }
    if ((e as Error)?.message === "forbidden") return fail("FORBIDDEN_IDOR", rid);
    return fail("INTERNAL", rid, { cause: e });
  }
}
