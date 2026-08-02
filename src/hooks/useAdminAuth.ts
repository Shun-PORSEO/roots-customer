"use client";

import { useEffect, useState } from "react";

/**
 * 管理画面の認証フック（SaaS化 C1）。
 * テナント管理者セッション（Supabase Auth → httpOnly Cookie）を GET /api/auth/admin で確認する。
 * 旧「LIFF + customers.is_admin」方式は廃止 — 管理画面は LINE に依存しない。
 * provisioned=false はログイン済みだがテナント（会社）未作成の状態。
 */
export function useAdminAuth() {
  const [authed, setAuthed] = useState<boolean>(false);
  const [checked, setChecked] = useState<boolean>(false);
  const [denied, setDenied] = useState<boolean>(false);
  const [provisioned, setProvisioned] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/admin", { credentials: "include" });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setEmail(data.email || "");
          setProvisioned(!!data.provisioned);
          setAuthed(true);
        } else {
          setDenied(true);
        }
      } catch {
        if (!cancelled) setDenied(true);
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { authed, checked, denied, provisioned, email };
}

/**
 * @deprecated 旧「LIFF + is_admin」認証の名残。db バックエンドでは line_id は
 * 認証情報として使われない（サーバーが検証済みセッションから導出）ため常に空を返す。
 * 呼び出し側 UI の diff をゼロに保つためのシム。GAS 経路の廃止（C5）で削除する。
 */
export function getAdminLineId(): string {
  return "";
}

/** ログアウト（セッション Cookie を破棄して /login へ）。 */
export async function adminLogout(): Promise<void> {
  try {
    await fetch("/api/auth/admin", { method: "DELETE", credentials: "include" });
  } finally {
    window.location.href = "/login";
  }
}
