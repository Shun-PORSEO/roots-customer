"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  postStripeCheckoutStart,
  postStripeCheckoutConfirm,
  postStripePortal,
} from "@/lib/api";
import { PRICING, formatJpy } from "@/lib/pricing";
import { useBilling } from "@/hooks/useBilling";
import { Spinner } from "@/components/Spinner";
import { InlineApiError } from "@/components/ErrorMessage";

// 契約・お支払い（SaaS化 C4 / roots-concierge#5）。
// - 契約状態の表示（トライアル残・次回請求日・解約予定）
// - Customer Portal 導線（支払い方法変更・解約・past_due からの復帰）
// - 未契約/期限切れからの再契約（Checkout）
// このページは BillingGate の対象外なので、ブロック中でも開ける（復帰導線のため）。

const STATUS_VIEW: Record<string, { label: string; tone: "ok" | "warn" | "error" }> = {
  none: { label: "未契約", tone: "warn" },
  trialing: { label: "無料トライアル中", tone: "ok" },
  active: { label: "ご利用中", tone: "ok" },
  expired: { label: "トライアル終了", tone: "error" },
  past_due: { label: "お支払い確認中（要対応）", tone: "error" },
  unpaid: { label: "未払い", tone: "error" },
  canceled: { label: "解約済み", tone: "error" },
  incomplete: { label: "登録未完了", tone: "warn" },
  incomplete_expired: { label: "登録未完了（期限切れ）", tone: "error" },
  paused: { label: "一時停止中", tone: "warn" },
};

const TONE_CLASS = {
  ok: "border-success/40 bg-success/5 text-success",
  warn: "border-warning/40 bg-warning/5 text-on-surface",
  error: "border-error/40 bg-error/5 text-error",
} as const;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function BillingBody() {
  const params = useSearchParams();
  const { billing, checked, error, reload } = useBilling();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string>("");

  // Checkout からの戻り（?checkout=success&session_id=...）を同期する
  const checkoutStatus = params.get("checkout");
  const sessionId = params.get("session_id");
  useEffect(() => {
    if (checkoutStatus === "success" && sessionId) {
      postStripeCheckoutConfirm(sessionId)
        .then(() => {
          setNotice("お支払いの登録が完了しました。");
          return reload();
        })
        .catch((e) => setActionError(e));
    } else if (checkoutStatus === "cancel") {
      setNotice("お支払いの登録は完了していません（キャンセルされました）。");
    }
  }, [checkoutStatus, sessionId, reload]);

  const openPortal = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      window.location.href = await postStripePortal();
    } catch (e) {
      setActionError(e);
      setBusy(false);
    }
  }, []);

  const startCheckout = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      window.location.href = await postStripeCheckoutStart("billing");
    } catch (e) {
      setActionError(e);
      setBusy(false);
    }
  }, []);

  if (!checked) return <Spinner fullScreen />;
  if (error && !billing) return <InlineApiError error={error} />;

  const view = STATUS_VIEW[billing?.status ?? "none"] ?? {
    label: billing?.status ?? "不明",
    tone: "warn" as const,
  };
  const stripeReady = !!billing?.stripe_enabled;

  return (
    <div className="max-w-2xl flex flex-col gap-lg">
      <div>
        <p className="text-label-caps text-tertiary-70">BILLING</p>
        <h1 className="font-display text-display-md text-on-surface mt-2xs">契約・お支払い</h1>
      </div>

      {notice ? (
        <p className="rounded-lg border border-primary-20 bg-primary-5 p-sm text-body-md text-on-surface">
          {notice}
        </p>
      ) : null}
      {actionError ? <InlineApiError error={actionError} /> : null}

      {/* ── 現在のご契約 ── */}
      <div className="card-base p-xl flex flex-col gap-md">
        <div className="flex items-center justify-between gap-sm flex-wrap">
          <h2 className="text-headline-lg text-on-surface">現在のご契約</h2>
          <span
            className={["rounded-full border px-sm py-1 text-body-sm font-bold", TONE_CLASS[view.tone]].join(" ")}
          >
            {view.label}
          </span>
        </div>

        <dl className="grid grid-cols-1 md:grid-cols-2 gap-sm text-body-md">
          <div>
            <dt className="text-body-sm text-neutral-50">プラン</dt>
            <dd className="text-on-surface font-bold">
              月額 {formatJpy(PRICING.monthlyPriceJpy)}円
              <span className="text-body-sm text-neutral-50 font-normal">（{PRICING.priceNote}）</span>
            </dd>
          </div>
          {billing?.trial_end ? (
            <div>
              <dt className="text-body-sm text-neutral-50">無料トライアル終了日</dt>
              <dd className="text-on-surface">{formatDate(billing.trial_end)}</dd>
            </div>
          ) : null}
          {billing?.current_period_end ? (
            <div>
              <dt className="text-body-sm text-neutral-50">
                {billing.cancel_at_period_end ? "ご利用いただける期限" : "次回のお支払い日"}
              </dt>
              <dd className="text-on-surface">{formatDate(billing.current_period_end)}</dd>
            </div>
          ) : null}
        </dl>

        {billing?.cancel_at_period_end ? (
          <p className="text-body-sm text-neutral-30">
            期間終了時に解約される予定です。継続する場合は下の「お支払い方法・解約の管理」から解約を取り消せます。
          </p>
        ) : null}
        {!billing?.active ? (
          <p className="text-body-md text-error">
            現在、管理画面のご利用が停止しています。登録済みのデータはそのまま保管されています。
          </p>
        ) : null}
      </div>

      {/* ── 操作 ── */}
      <div className="card-base p-xl flex flex-col gap-md">
        <h2 className="text-headline-md text-on-surface">お支払いの管理</h2>

        {!stripeReady ? (
          <p className="text-body-md text-neutral-50 leading-relaxed">
            この環境ではオンライン決済が構成されていません（開発・検証用のトライアル状態です）。
            本番環境では、ここからクレジットカードの登録・変更・解約が行えます。
          </p>
        ) : billing?.has_stripe_customer ? (
          <>
            <p className="text-body-md text-neutral-50 leading-relaxed">
              クレジットカードの変更、請求書の確認、解約とその取り消しは Stripe のお支払い管理ページで行えます。
            </p>
            <button type="button" onClick={openPortal} disabled={busy} className="btn-primary self-start px-xl">
              {busy ? "開いています…" : "お支払い方法・解約の管理"}
            </button>
            {!billing.active ? (
              <button
                type="button"
                onClick={startCheckout}
                disabled={busy}
                className="btn-secondary self-start px-lg"
              >
                新しくご契約する
              </button>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-body-md text-neutral-50 leading-relaxed">
              クレジットカードを登録すると、{PRICING.trialDays}日間の無料トライアルが始まります。
              トライアル期間中の解約は無料です。
            </p>
            <button type="button" onClick={startCheckout} disabled={busy} className="btn-primary self-start px-xl">
              {busy ? "処理中…" : "お支払い方法を登録する"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function BillingPage() {
  // useSearchParams は Suspense 境界が必要（Next.js App Router）
  return (
    <Suspense fallback={<Spinner fullScreen />}>
      <BillingBody />
    </Suspense>
  );
}
