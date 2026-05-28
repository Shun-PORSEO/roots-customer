"use client";

import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Spinner } from "@/components/Spinner";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { authed, checked } = useAdminAuth();

  if (!checked) {
    return <Spinner fullScreen />;
  }

  if (!authed) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="bg-white rounded-2xl shadow-sm border w-full max-w-md p-8 text-center"
          style={{ borderColor: "var(--colorBorder)" }}
        >
          <p className="text-3xl mb-3">🔒</p>
          <h2
            className="text-xl font-bold mb-2"
            style={{ color: "var(--colorText)" }}
          >
            管理者権限が必要です
          </h2>
          <p className="text-[13px] text-gray-500 leading-relaxed mb-2">
            この画面は、LINE 上でプランナー登録（is_admin=TRUE）された
            アカウントからのみアクセスできます。
          </p>
          <p className="text-[12px] text-gray-400">
            LINE のリッチメニューから管理者ダッシュボードを開いてください。
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
