"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 旧LIFF設定のエンドポイントが `/` を指したまま LINE 内で開かれた場合の救済（SaaS化 C6）。
// LIFF 起動時は URL に `liff.state` が付き、カップル招待QRは `venue` が付くため、
// どちらかがあればクエリを保ったまま旧入口の移設先 /liff へ逃がす。
// 通常のLPアクセスでは何もしない（LP は静的なまま）。
export function LegacyLiffRedirect() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("liff.state") || params.has("venue")) {
      router.replace(`/liff?${params.toString()}`);
    }
  }, [router]);

  return null;
}
