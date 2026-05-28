"use client";

import { useEffect, useState } from "react";
import { useLiff } from "./useLiff";
import { apiClient } from "@/lib/api";

const STORAGE_KEY = "roots_admin_authed";

/**
 * 管理画面の認証は LIFF の is_admin=TRUE のみ。
 * - LINE で開くと自動認証（customers シートで is_admin=TRUE になっているプランナー）
 * - 非 LINE ブラウザ / 一般ユーザー → アクセス拒否
 *
 * dev では useLiff が localStorage の mock_line_id / mock_nickname を見るので、
 * そちらで疑似ログインできる。
 */
export function useAdminAuth() {
  const { isLiffReady, profile, error } = useLiff();
  const [authed, setAuthed] = useState<boolean>(false);
  const [checked, setChecked] = useState<boolean>(false);
  const [denied, setDenied] = useState<boolean>(false);

  // 同タブで一度認証したら sessionStorage に保存して再認証を省略
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY) === "1") {
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

  // LIFF 初期化エラー（LIFF_ID 未設定 など）→ 拒否表示へ
  useEffect(() => {
    if (authed || checked) return;
    if (error) {
      setChecked(true);
      setDenied(true);
    }
  }, [authed, checked, error]);

  return { authed, checked, denied };
}
