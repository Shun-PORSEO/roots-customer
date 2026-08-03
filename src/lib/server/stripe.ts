import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "./env";

// Stripe REST API の薄いラッパー（SaaS化 C4）。
// supabaseAuth.ts と同じ方針で SDK は使わず fetch 直呼び（依存最小・鍵はサーバー内のみ）。
// 必要な操作は Customer 作成 / Checkout Session 作成・取得 / Billing Portal 作成 /
// Webhook 署名検証の5つだけなので、SDK を入れるほどの面は無い。

const API_BASE = "https://api.stripe.com/v1";

export class StripeError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "StripeError";
  }
}

/** Stripe（Checkout/Portal/Webhook）が構成済みか。未設定環境はローカルトライアル運用。 */
export function stripeEnabled(): boolean {
  const env = getEnv();
  return !!(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.STRIPE_PRICE_ID);
}

function secretKey(): string {
  const key = getEnv().STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("[stripe] STRIPE_SECRET_KEY が未設定です", 500);
  return key;
}

// form-encoded で Stripe API を呼ぶ。ネストは "a[b]" 形式のキーで渡す。
async function stripeRequest(
  method: "GET" | "POST",
  path: string,
  params?: Record<string, string>
): Promise<Record<string, unknown>> {
  const body = params ? new URLSearchParams(params) : undefined;
  const url =
    method === "GET" && body ? `${API_BASE}${path}?${body.toString()}` : `${API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" ? body : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = data?.error as { message?: string } | undefined;
    throw new StripeError(err?.message || `[stripe] ${path} failed (${res.status})`, res.status);
  }
  return data;
}

export async function createStripeCustomer(email: string, companyId: string): Promise<string> {
  const customer = await stripeRequest("POST", "/customers", {
    email,
    "metadata[company_id]": companyId,
  });
  return customer.id as string;
}

// 14日トライアル付きの月額サブスク Checkout。company_id を metadata に埋めて
// Webhook / 同期関数が company を解決できるようにする。
export async function createCheckoutSession(opts: {
  customerId: string;
  companyId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; url: string }> {
  const priceId = getEnv().STRIPE_PRICE_ID;
  if (!priceId) throw new StripeError("[stripe] STRIPE_PRICE_ID が未設定です", 500);
  const session = await stripeRequest("POST", "/checkout/sessions", {
    mode: "subscription",
    customer: opts.customerId,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    "subscription_data[trial_period_days]": "14",
    "subscription_data[metadata][company_id]": opts.companyId,
    "metadata[company_id]": opts.companyId,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });
  return { id: session.id as string, url: session.url as string };
}

export type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  trial_end: number | null;
  cancel_at_period_end: boolean;
  current_period_end?: number | null;
  metadata?: Record<string, string>;
  items?: { data?: Array<{ current_period_end?: number; price?: { id?: string } }> };
};

export async function getCheckoutSession(sessionId: string): Promise<{
  id: string;
  status: string;
  metadata: Record<string, string>;
  subscription: StripeSubscription | null;
}> {
  const cs = await stripeRequest("GET", `/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    "expand[]": "subscription",
  });
  return {
    id: cs.id as string,
    status: (cs.status as string) ?? "",
    metadata: (cs.metadata as Record<string, string>) ?? {},
    subscription: (cs.subscription as StripeSubscription | null) ?? null,
  };
}

export async function createPortalSession(customerId: string, returnUrl: string): Promise<string> {
  const session = await stripeRequest("POST", "/billing_portal/sessions", {
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url as string;
}

// current_period_end は Stripe API バージョンにより subscription 直下 or items 配下。
// どちらでも拾えるようにする。
export function subscriptionPeriodEnd(sub: StripeSubscription): number | null {
  return sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end ?? null;
}

export function subscriptionPriceId(sub: StripeSubscription): string {
  return sub.items?.data?.[0]?.price?.id ?? "";
}

export function epochToIso(epoch: number | null | undefined): string | null {
  return typeof epoch === "number" ? new Date(epoch * 1000).toISOString() : null;
}

// ─── Webhook 署名検証 ────────────────────────────────────────────────────
// Stripe-Signature: "t=<unix>,v1=<hmac>,..." 。HMAC-SHA256("<t>.<rawBody>") を
// 署名シークレットで検証する（lineSignature.ts と同じく timingSafeEqual）。
const SIGNATURE_TOLERANCE_SEC = 300;

export function verifyStripeSignature(rawBody: string, header: string | null): boolean {
  const secret = getEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;

  const parts = new Map<string, string[]>();
  for (const pair of header.split(",")) {
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    parts.set(k, [...(parts.get(k) ?? []), v]);
  }
  const timestamp = Number(parts.get("t")?.[0]);
  const signatures = parts.get("v1") ?? [];
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;

  // リプレイ防止（5分）
  if (Math.abs(Date.now() / 1000 - timestamp) > SIGNATURE_TOLERANCE_SEC) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  return signatures.some((sig) => {
    const buf = Buffer.from(sig, "utf8");
    return buf.length === expectedBuf.length && timingSafeEqual(buf, expectedBuf);
  });
}
