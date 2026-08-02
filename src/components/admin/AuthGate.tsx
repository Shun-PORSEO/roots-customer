"use client";

import { createContext, useContext } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Spinner } from "@/components/Spinner";

const AdminContext = createContext<string>("");

/** 認証済み管理者の識別子（メールアドレス）を返す。AuthGate 配下のコンポーネントで使用。 */
export function useAdminLineId(): string {
  return useContext(AdminContext);
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { authed, checked, provisioned, email } = useAdminAuth();

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
            ログインが必要です
          </h2>
          <p className="text-[13px] text-gray-500 leading-relaxed mb-4">
            この画面は、登録済みのテナント管理者（式場運営会社の担当者）のみ
            アクセスできます。
          </p>
          <a
            href="/login"
            className="inline-block px-6 py-2.5 rounded-lg text-white text-[13px] font-bold"
            style={{ background: "var(--cp, #2f5a40)" }}
          >
            ログイン画面へ
          </a>
          <p className="text-[12px] text-gray-400 mt-3">
            アカウントをお持ちでない場合は{" "}
            <a href="/signup" className="underline">
              新規登録
            </a>
          </p>
        </div>
      </div>
    );
  }

  if (!provisioned) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="bg-white rounded-2xl shadow-sm border w-full max-w-md p-8 text-center"
          style={{ borderColor: "var(--colorBorder)" }}
        >
          <p className="text-3xl mb-3">🏢</p>
          <h2
            className="text-xl font-bold mb-2"
            style={{ color: "var(--colorText)" }}
          >
            テナントが未作成です
          </h2>
          <p className="text-[13px] text-gray-500 leading-relaxed mb-4">
            ログインには成功しましたが、会社（テナント）がまだ登録されていません。
            新規登録からやり直してください。
          </p>
          <a
            href="/signup"
            className="inline-block px-6 py-2.5 rounded-lg text-white text-[13px] font-bold"
            style={{ background: "var(--cp, #2f5a40)" }}
          >
            新規登録へ
          </a>
        </div>
      </div>
    );
  }

  return (
    <AdminContext.Provider value={email || ""}>
      {children}
    </AdminContext.Provider>
  );
}
