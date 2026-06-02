"use client";

import { useEffect, useState } from "react";
import { useLiff } from "./useLiff";
import { apiClient } from "@/lib/api";

const STORAGE_KEY = "roots_admin_authed";
const STORAGE_LINE_ID_KEY = "roots_admin_line_id";

/**
 * 管理画面の認証フック。GAS の is_admin=TRUE で認証し lineId を返す。
 * sessionStorage にキャッシュして同タブ内の再認証を省略する。
 */
export function useAdminAuth() {
  const { isLiffReady, profile, error } = useLiff();
  const [authed, setAuthed] = useState<boolean>(false);
  const [checked, setChecked] = useState<boolean>(false);
  const [denied, setDenied] = useState<boolean>(false);
  const [lineId, setLineId] = useState<string | null>(null);

  // sessionStorage キャッシュから復元（lineId も必須）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cachedLineId = sessionStorage.getItem(STORAGE_LINE_ID_KEY);
    if (sessionStorage.getItem(STORAGE_KEY) === "1" && cachedLineId) {
      setLineId(cachedLineId);
      setAuthed(true);
      setChecked(true);
    }
  }, []);

  // LIFF 経由で is_admin を判定
  useEffect(() => {
    if (authed) return;
    if (!isLiffReady) return;
    if (!profile) {
      setChecked(true);
      setDenied(true);
      return;
    }
    (async () => {
      try {
        const res = await apiClient.post({
          action: "getUser",
          line_id: profile.userId,
        });
        if (res.is_admin) {
          sessionStorage.setItem(STORAGE_KEY, "1");
          sessionStorage.setItem(STORAGE_LINE_ID_KEY, profile.userId);
          setLineId(profile.userId);
          setAuthed(true);
        } else {
          setDenied(true);
        }
      } catch (_) {
        setDenied(true);
      } finally {
        setChecked(true);
      }
    })();
  }, [isLiffReady, profile, authed]);

  // LIFF 初期化エラー → 拒否表示へ
  useEffect(() => {
    if (authed || checked) return;
    if (error) {
      setChecked(true);
      setDenied(true);
    }
  }, [authed, checked, error]);

  return { authed, checked, denied, lineId };
}

/** 認証済み管理者の LINE ID を返す。未認証時は空文字。 */
export function getAdminLineId(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(STORAGE_LINE_ID_KEY) || "";
}
