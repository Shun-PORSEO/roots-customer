"use client";

import { useState, useEffect } from "react";
import { initLiff, ensureLogin, getProfile } from "@/lib/liff";

interface UseLiffResult {
  lineId: string | null;
  nickname: string | null;
  loading: boolean;
  error: string | null;
}

export function useLiff(): UseLiffResult {
  const [lineId, setLineId] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        await ensureLogin();
        const profile = await getProfile();
        setLineId(profile.userId);
        setNickname(profile.displayName);
      } catch (err) {
        setError("LINEアプリからアクセスしてください");
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { lineId, nickname, loading, error };
}
