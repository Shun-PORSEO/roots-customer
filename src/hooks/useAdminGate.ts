"use client";

import { useEffect, useState } from "react";
import { useLiff } from "./useLiff";

/**
 * 管理者専用画面のアクセス制御フック。
 * NEXT_PUBLIC_ADMIN_LINE_USER_IDS（カンマ区切り）に
 * 自分の LINE userId が含まれているかで判定する。
 *
 * authChecked が false の間は判定中（Spinner 表示推奨）、
 * true でかつ authorized === false なら拒否画面（AdminAccessDenied）を出す想定。
 */
export function useAdminGate() {
  const { isLiffReady, profile } = useLiff();
  const [authorized, setAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!isLiffReady) return;
    const adminIds = (process.env.NEXT_PUBLIC_ADMIN_LINE_USER_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (profile && adminIds.includes(profile.userId)) {
      setAuthorized(true);
    }
    setAuthChecked(true);
  }, [isLiffReady, profile]);

  return { authorized, authChecked };
}
