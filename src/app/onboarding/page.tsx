"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { getAdminLineId } from "@/hooks/useAdminAuth";
import { IOnboarding, ILineKeyCheck, IVenue } from "@/lib/types";
import { Spinner } from "@/components/Spinner";
import { InlineApiError } from "@/components/ErrorMessage";
import { AuthGate } from "@/components/admin/AuthGate";
import { LineSetupManual } from "@/components/onboarding/LineSetupManual";

// オンボーディングウィザード（SaaS化 C3 / roots-concierge#4）。
// サインアップ直後の式場担当者がセルフサーブで
//   Step1 式場情報 → Step2 LINEキー4点入力（マニュアル付き）→ Step3 接続テスト全緑 → Step4 利用開始
// まで完走する。進捗は onboarding_progress に保存され、中断→再開できる
// （getOnboarding が保存済みステップを返し、ここから再開する）。
// Step4 は現状「トライアル開始」の確定のみ。Stripe Checkout（C4 roots-concierge#5）が
// 入ったらこのステップの確定ボタンを Checkout リダイレクトに差し替える。

const STEPS = [
  { n: 1, label: "式場情報" },
  { n: 2, label: "LINE設定" },
  { n: 3, label: "接続テスト" },
  { n: 4, label: "利用開始" },
] as const;

function StepIndicator({
  step,
  maxReached,
  onSelect,
}: {
  step: number;
  maxReached: number;
  onSelect: (n: number) => void;
}) {
  return (
    <ol className="flex items-center justify-center gap-0 mb-xl" aria-label="オンボーディングの進行状況">
      {STEPS.map((s, i) => {
        const done = s.n < step;
        const active = s.n === step;
        const reachable = s.n <= maxReached && !active;
        return (
          <li key={s.n} className="flex items-center">
            {i > 0 ? (
              <span
                className={["h-0.5 w-6 md:w-12", done || active ? "bg-primary-70" : "bg-neutral-90"].join(" ")}
                aria-hidden="true"
              />
            ) : null}
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onSelect(s.n)}
              className={[
                "flex flex-col items-center gap-2xs px-xs",
                reachable ? "cursor-pointer" : "cursor-default",
              ].join(" ")}
            >
              <span
                className={[
                  "w-8 h-8 rounded-full flex items-center justify-center text-body-sm font-bold transition-colors",
                  active
                    ? "bg-primary-70 text-white"
                    : done
                    ? "bg-primary-10 text-primary-70"
                    : "bg-neutral-95 text-neutral-50",
                ].join(" ")}
              >
                {done ? "✓" : s.n}
              </span>
              <span
                className={[
                  "text-body-sm whitespace-nowrap",
                  active ? "text-primary-70 font-bold" : "text-neutral-50",
                ].join(" ")}
              >
                {s.label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Wizard() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // ウィザード対象の式場（Step1 で作成、以降のステップはこの式場を操作する）
  const [venueCode, setVenueCode] = useState("");
  const [venue, setVenue] = useState<IVenue | null>(null);
  const [lineTestPassed, setLineTestPassed] = useState(false);

  // Step1 フォーム
  const [form1, setForm1] = useState({ venue_id: "", venue_name: "" });
  // Step2 フォーム（secret 系はサーバーから値が返らないため常に空。has_* で設定済み表示）
  const [form2, setForm2] = useState({
    line_channel_access_token: "",
    line_channel_secret: "",
    line_login_channel_id: "",
    line_liff_id: "",
  });
  // Step3 接続テスト
  const [testResults, setTestResults] = useState<ILineKeyCheck[] | null>(null);
  const [testing, setTesting] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = venueCode ? `${origin}/api/line/webhook/${venueCode}` : "";

  useEffect(() => {
    apiClient
      .post({ action: "getOnboarding", line_id: getAdminLineId() })
      .then((res) => {
        if (res.status === "error") throw new Error(res.message);
        const ob = res.onboarding as IOnboarding;
        if (ob.completed) {
          // 完了済みテナントがブックマーク等で再訪した場合は管理画面へ
          window.location.replace("/admin");
          return;
        }
        const v = (res.venue ?? null) as IVenue | null;
        setVenueCode(ob.venue_code || "");
        setVenue(v);
        setLineTestPassed(ob.line_test_passed);
        setStep(ob.current_step || 1);
        if (v) {
          setForm1({ venue_id: v.venue_id, venue_name: v.venue_name });
          setForm2((prev) => ({
            ...prev,
            line_login_channel_id: v.line_login_channel_id || "",
            line_liff_id: v.line_liff_id || "",
          }));
        }
        setLoading(false);
      })
      .catch((e) => {
        setLoadError(e);
        setLoading(false);
      });
  }, []);

  // ステップ移動を進捗保存とセットで行う（再開ポイントを常にサーバーへ残す）
  const goTo = useCallback(async (n: number, opts?: { venue_id?: string; complete?: boolean }) => {
    await apiClient.post({
      action: "saveOnboarding",
      line_id: getAdminLineId(),
      step: n,
      ...(opts?.venue_id ? { venue_id: opts.venue_id } : {}),
      ...(opts?.complete ? { complete: true } : {}),
    });
    setStep(n);
  }, []);

  const handleBack = useCallback(
    (n: number) => {
      setError(null);
      goTo(n).catch((e) => setError(e));
    },
    [goTo]
  );

  // ── Step1: 式場情報 ──────────────────────────────────────
  async function submitStep1(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const code = form1.venue_id.trim();
      const name = form1.venue_name.trim();
      if (!code || !name) throw new Error("式場IDと式場名を入力してください");
      if (!/^[A-Za-z0-9_-]+$/.test(code)) {
        throw new Error("式場IDは半角英数字（ハイフン・アンダースコア可）で入力してください");
      }
      if (venueCode && venueCode === code) {
        // 再開時（作成済み）は名称のみ更新
        await apiClient.post({
          action: "updateVenue",
          line_id: getAdminLineId(),
          venue_id: code,
          patch: { venue_name: name },
        });
      } else {
        await apiClient.post({
          action: "createVenue",
          line_id: getAdminLineId(),
          venue_id: code,
          venue_name: name,
        });
      }
      setVenueCode(code);
      setVenue((prev) => ({ ...(prev ?? { active: true }), venue_id: code, venue_name: name }));
      await goTo(2, { venue_id: code });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  // ── Step2: LINE キー4点 ──────────────────────────────────
  async function submitStep2(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // 空欄は「未変更」扱い（updateVenue の coalesce で既存値を保持）。
      // 設定済みの secret 系を空のまま送っても消えない。
      const patch = Object.fromEntries(
        Object.entries(form2)
          .map(([k, v]) => [k, v.trim()])
          .filter(([, v]) => v !== "")
      );
      if (Object.keys(patch).length > 0) {
        await apiClient.post({
          action: "updateVenue",
          line_id: getAdminLineId(),
          venue_id: venueCode,
          patch,
        });
        setVenue((prev) =>
          prev
            ? {
                ...prev,
                line_liff_id: (patch.line_liff_id as string) ?? prev.line_liff_id,
                line_login_channel_id:
                  (patch.line_login_channel_id as string) ?? prev.line_login_channel_id,
                has_channel_access_token:
                  prev.has_channel_access_token || !!patch.line_channel_access_token,
                has_channel_secret: prev.has_channel_secret || !!patch.line_channel_secret,
              }
            : prev
        );
      }
      // キーを変更したら前回のテスト結果は古いので破棄
      setTestResults(null);
      await goTo(3);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  // ── Step3: 接続テスト ────────────────────────────────────
  async function runTest() {
    setTesting(true);
    setError(null);
    try {
      const res = await apiClient.post({
        action: "testLineConnection",
        line_id: getAdminLineId(),
        venue_id: venueCode,
      });
      if (res.status === "error") throw new Error(res.message);
      const results = (res.results || []) as ILineKeyCheck[];
      setTestResults(results);
      // 全緑の記録（line_test_passed_at）はサーバーが実結果を見て更新済み
      setLineTestPassed(results.length > 0 && results.every((r) => r.ok));
    } catch (err) {
      setError(err);
    } finally {
      setTesting(false);
    }
  }

  async function submitStep3() {
    setBusy(true);
    setError(null);
    try {
      await goTo(4);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  // ── Step4: 利用開始（C4 で Stripe Checkout に差し替え）──
  async function submitStep4() {
    setBusy(true);
    setError(null);
    try {
      await goTo(4, { complete: true });
      window.location.href = "/admin";
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  if (loading) return <Spinner fullScreen />;
  if (loadError) {
    return (
      <div className="max-w-xl mx-auto pt-2xl px-md">
        <InlineApiError error={loadError} />
      </div>
    );
  }

  const allGreen = testResults !== null && testResults.every((r) => r.ok);

  return (
    <div className="max-w-2xl mx-auto px-md py-xl animate-fade-in">
      <div className="text-center mb-lg">
        <p className="text-label-caps text-tertiary-70">ONBOARDING</p>
        <h1 className="font-display text-display-lg text-on-surface mt-2xs">はじめての設定</h1>
        <p className="text-body-md text-neutral-50 mt-2xs">
          4つのステップで、カップルを招待できる状態まで一緒に進めます。途中でやめても続きから再開できます。
        </p>
      </div>

      <StepIndicator step={step} maxReached={step} onSelect={handleBack} />

      {error ? (
        <div className="mb-md">
          <InlineApiError error={error} />
        </div>
      ) : null}

      {/* ── Step1: 式場情報 ── */}
      {step === 1 ? (
        <form onSubmit={submitStep1} className="card-base p-xl flex flex-col gap-md">
          <div>
            <h2 className="text-headline-lg text-on-surface">式場情報を登録</h2>
            <p className="text-body-md text-neutral-50 mt-2xs">
              まず、管理する式場（会場）をひとつ登録します。式場は後から追加できます。
            </p>
          </div>
          <div>
            <label className="block text-body-sm font-bold text-neutral-30 mb-2xs" htmlFor="ob_venue_id">
              式場ID <span className="text-error">*</span>
            </label>
            <input
              id="ob_venue_id"
              value={form1.venue_id}
              onChange={(e) => setForm1({ ...form1, venue_id: e.target.value })}
              placeholder="例: RC001"
              disabled={!!venueCode}
              className="w-full rounded-lg border border-border-strong px-sm py-2.5 text-body-md font-mono disabled:bg-neutral-95 disabled:text-neutral-50"
            />
            <p className="text-body-sm text-neutral-50 mt-2xs">
              半角英数字。Webhook URL などに使われます（登録後は変更できません）
            </p>
          </div>
          <div>
            <label className="block text-body-sm font-bold text-neutral-30 mb-2xs" htmlFor="ob_venue_name">
              式場名 <span className="text-error">*</span>
            </label>
            <input
              id="ob_venue_name"
              value={form1.venue_name}
              onChange={(e) => setForm1({ ...form1, venue_name: e.target.value })}
              placeholder="例: グランドホテル〇〇"
              className="w-full rounded-lg border border-border-strong px-sm py-2.5 text-body-md"
            />
            <p className="text-body-sm text-neutral-50 mt-2xs">カップルの画面に表示される名称です</p>
          </div>
          <div className="flex justify-end pt-sm border-t border-border">
            <button type="submit" disabled={busy} className="btn-primary px-xl">
              {busy ? "保存中…" : "次へ（LINE設定）"}
            </button>
          </div>
        </form>
      ) : null}

      {/* ── Step2: マニュアル + キー4点 ── */}
      {step === 2 ? (
        <div className="flex flex-col gap-lg">
          <div className="card-base p-lg">
            <h2 className="text-headline-lg text-on-surface">LINE公式アカウントの準備</h2>
            <p className="text-body-md text-neutral-50 mt-2xs leading-relaxed">
              下の手順にそって式場の LINE 公式アカウントを設定し、途中で表示される
              <b>4つのキー</b>（チャネルアクセストークン・チャネルシークレット・Login チャネルID・LIFF ID）
              をこのページのフォームに貼り付けてください。所要時間はおよそ15〜20分です。
            </p>
          </div>

          <LineSetupManual webhookUrl={webhookUrl} liffEndpointUrl={`${origin}/register`} />

          <form onSubmit={submitStep2} className="card-base p-xl flex flex-col gap-md">
            <div>
              <h3 className="text-headline-md text-on-surface">キー4点を入力</h3>
              <p className="text-body-sm text-neutral-50 mt-2xs">
                設定済みの項目は空欄のまま進めば変更されません。
              </p>
            </div>
            <div>
              <label className="block text-body-sm font-bold text-neutral-30 mb-2xs" htmlFor="ob_token">
                チャネルアクセストークン（Messaging API）
                {venue?.has_channel_access_token ? (
                  <span className="ml-2 text-[11px] font-bold text-success">設定済み✓</span>
                ) : null}
              </label>
              <input
                id="ob_token"
                value={form2.line_channel_access_token}
                onChange={(e) => setForm2({ ...form2, line_channel_access_token: e.target.value })}
                placeholder={venue?.has_channel_access_token ? "（変更する場合のみ入力）" : "手順4で発行した長いトークン"}
                className="w-full rounded-lg border border-border-strong px-sm py-2.5 text-body-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-body-sm font-bold text-neutral-30 mb-2xs" htmlFor="ob_secret">
                チャネルシークレット（Messaging API）
                {venue?.has_channel_secret ? (
                  <span className="ml-2 text-[11px] font-bold text-success">設定済み✓</span>
                ) : null}
              </label>
              <input
                id="ob_secret"
                value={form2.line_channel_secret}
                onChange={(e) => setForm2({ ...form2, line_channel_secret: e.target.value })}
                placeholder={venue?.has_channel_secret ? "（変更する場合のみ入力）" : "手順3でコピーした32桁の文字列"}
                className="w-full rounded-lg border border-border-strong px-sm py-2.5 text-body-sm font-mono"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <div>
                <label className="block text-body-sm font-bold text-neutral-30 mb-2xs" htmlFor="ob_login_id">
                  LINE Login チャネルID
                </label>
                <input
                  id="ob_login_id"
                  value={form2.line_login_channel_id}
                  onChange={(e) => setForm2({ ...form2, line_login_channel_id: e.target.value })}
                  placeholder="2001234567"
                  className="w-full rounded-lg border border-border-strong px-sm py-2.5 text-body-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-body-sm font-bold text-neutral-30 mb-2xs" htmlFor="ob_liff_id">
                  LIFF ID
                </label>
                <input
                  id="ob_liff_id"
                  value={form2.line_liff_id}
                  onChange={(e) => setForm2({ ...form2, line_liff_id: e.target.value })}
                  placeholder="2001234567-AbcdEfgh"
                  className="w-full rounded-lg border border-border-strong px-sm py-2.5 text-body-sm font-mono"
                />
              </div>
            </div>
            <div className="flex flex-col-reverse md:flex-row md:justify-between gap-sm pt-sm border-t border-border">
              <button type="button" onClick={() => handleBack(1)} className="btn-secondary md:px-lg">
                戻る
              </button>
              <button type="submit" disabled={busy} className="btn-primary md:px-xl">
                {busy ? "保存中…" : "保存して接続テストへ"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* ── Step3: 接続テスト ── */}
      {step === 3 ? (
        <div className="card-base p-xl flex flex-col gap-md">
          <div>
            <h2 className="text-headline-lg text-on-surface">接続テスト</h2>
            <p className="text-body-md text-neutral-50 mt-2xs leading-relaxed">
              入力した4つのキーが実際に LINE と繋がるかを確認します。
              <b>4点すべてが ✓ になるまで次へ進めません。</b>
              ✗ が出た場合は表示される直し方にそって修正し、もう一度テストしてください。
            </p>
          </div>

          <button type="button" onClick={runTest} disabled={testing} className="btn-primary self-start">
            {testing ? "確認中…" : testResults ? "もう一度テストする" : "接続テストを実行"}
          </button>

          {testResults ? (
            <ul className="flex flex-col gap-sm">
              {testResults.map((r) => (
                <li
                  key={r.key}
                  className={[
                    "rounded-lg border p-sm",
                    r.ok ? "border-success/40 bg-success/5" : "border-error/40 bg-error/5",
                  ].join(" ")}
                >
                  <p className="text-body-sm text-neutral-50">{r.label}</p>
                  <p className={["text-body-md font-bold", r.ok ? "text-success" : "text-error"].join(" ")}>
                    {r.message}
                  </p>
                  {!r.ok && r.fix ? (
                    <p className="text-body-sm text-neutral-30 mt-2xs leading-relaxed">→ {r.fix}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {allGreen ? (
            <p className="text-body-md font-bold text-success">
              すべてのキーの接続を確認できました。次のステップへ進めます。
            </p>
          ) : null}

          <div className="flex flex-col-reverse md:flex-row md:justify-between gap-sm pt-sm border-t border-border">
            <button type="button" onClick={() => handleBack(2)} className="btn-secondary md:px-lg">
              戻る（キーを修正）
            </button>
            <button
              type="button"
              onClick={submitStep3}
              disabled={busy || !(allGreen || lineTestPassed)}
              className="btn-primary md:px-xl"
            >
              {busy ? "保存中…" : "次へ（利用開始）"}
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Step4: 利用開始 ── */}
      {step === 4 ? (
        <div className="card-base p-xl flex flex-col gap-md">
          <div>
            <h2 className="text-headline-lg text-on-surface">利用を開始する</h2>
            <p className="text-body-md text-neutral-50 mt-2xs leading-relaxed">
              設定は完了しました。今日から14日間は無料でお試しいただけます。
            </p>
          </div>

          <div className="rounded-lg border border-primary-20 bg-primary-5 p-lg">
            <p className="text-label-caps text-tertiary-70">PLAN</p>
            <p className="font-display text-display-md text-on-surface mt-2xs">
              月額 9,800円<span className="text-body-md text-neutral-50">（税込・1プラン）</span>
            </p>
            <ul className="text-body-md text-on-surface mt-sm flex flex-col gap-2xs list-disc pl-md">
              <li>14日間の無料トライアル（本日から）</li>
              <li>カップル数・タスク数は無制限</li>
              <li>LINE 自動リマインド・AI メッセージ生成つき</li>
            </ul>
            <p className="text-body-sm text-neutral-50 mt-sm">
              お支払い方法の登録（クレジットカード）は準備中です。トライアル終了前にご案内します。
            </p>
          </div>

          <div className="flex flex-col-reverse md:flex-row md:justify-between gap-sm pt-sm border-t border-border">
            <button type="button" onClick={() => handleBack(3)} className="btn-secondary md:px-lg">
              戻る
            </button>
            <button type="button" onClick={submitStep4} disabled={busy} className="btn-primary md:px-xl">
              {busy ? "処理中…" : "トライアルを開始して管理画面へ"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--cs-page, #f6f5f2)" }}>
      <AuthGate>
        <Wizard />
      </AuthGate>
    </main>
  );
}
