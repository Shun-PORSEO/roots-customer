"use client";

import { createContext, useContext } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Spinner } from "@/components/Spinner";

const AdminContext = createContext<string>("");

/** 認証済み管理者の LINE ID を返す。AuthGate 配下のコンポーネントで使用。 */
export function useAdminLineId(): string {
  return useContext(AdminContext);
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { authed, checked, lineId } = useAdminAuth();

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

  return (
    <AdminContext.Provider value={lineId || ""}>
      {children}
    </AdminContext.Provider>
  );
}
