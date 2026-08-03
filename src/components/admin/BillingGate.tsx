"use client";

import { usePathname } from "next/navigation";
import { useBilling } from "@/hooks/useBilling";
import { Spinner } from "@/components/Spinner";

// 課金ゲート（SaaS化 C4）。trialing/active 以外の company は管理画面をブロックする
// （サーバー側 /api/admin のゲートと二重。こちらは案内画面の表示係）。
// /admin/billing だけは復帰導線（Checkout / Customer Portal）なのでブロックしない。
const STATUS_LABEL: Record<string, string> = {
  expired: "無料トライアルの期間が終了しました",
  past_due: "お支払いに問題が発生しています",
  canceled: "ご契約が解約されています",
  unpaid: "お支払いが確認できていません",
  incomplete: "お支払いの登録が完了していません",
  incomplete_expired: "お支払いの登録が完了しませんでした",
  paused: "ご契約が一時停止されています",
};

export function BillingGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const { billing, checked, blocked } = useBilling();

  // 復帰導線（契約・支払いページ）は常に通す
  if (pathname.startsWith("/admin/billing")) return <>{children}</>;

  if (!checked) return <Spinner fullScreen />;
  // 取得失敗時はブロックしない（サーバー側ゲートが最終防衛線）
  if (!blocked || !billing) return <>{children}</>;

  return (
    <div className="flex items-center justify-center py-20">
      <div
        className="bg-white rounded-2xl shadow-sm border w-full max-w-md p-8 text-center"
        style={{ borderColor: "var(--colorBorder)" }}
      >
        <p className="text-3xl mb-3">💳</p>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--colorText)" }}>
          {STATUS_LABEL[billing.status] ?? "ご契約が有効ではありません"}
        </h2>
        <p className="text-[13px] text-gray-500 leading-relaxed mb-4">
          登録済みのデータ（式場・カップル・タスク）はそのまま保管されています。
          お支払いのご登録・再開後、すぐに続きからご利用いただけます。
        </p>
        <a
          href="/admin/billing"
          className="inline-block px-6 py-2.5 rounded-lg text-white text-[13px] font-bold"
          style={{ background: "var(--cp, #2f5a40)" }}
        >
          契約・お支払いの管理へ
        </a>
      </div>
    </div>
  );
}
