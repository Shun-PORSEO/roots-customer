"use client";

import { useEffect, useState } from "react";
import liff from "@line/liff";

interface LineProfile {
  userId: string;
  displayName: string;
}

export const useLiff = () => {
  const [isLiffReady, setIsLiffReady] = useState(false);
  const [profile, setProfile] = useState<LineProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initLiff = async () => {
      try {
        if (typeof window !== "undefined") {
          const liffMock = (window as any).__LIFF_MOCK__;
          const lsId = localStorage.getItem("mock_line_id");
          const lsName = localStorage.getItem("mock_nickname");
          if (liffMock) {
            setProfile({ userId: liffMock.line_id, displayName: liffMock.nickname_display });
            setIsLiffReady(true);
            return;
          } else if (lsId && lsName) {
            setProfile({ userId: lsId, displayName: lsName });
            setIsLiffReady(true);
            return;
          }
        }

        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId || liffId === "YOUR_LIFF_ID_HERE") {
          throw new Error("LIFF ID is not properly set.");
        }
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const userProfile = await liff.getProfile();
        setProfile({
          userId: userProfile.userId,
          displayName: userProfile.displayName,
        });
        setIsLiffReady(true);
      } catch (err: any) {
        console.error("LIFF Init Error:", err);
        setError("LINEアプリからアクセスしてください。");
      }
    };
    initLiff();
  }, []);

  return { isLiffReady, profile, error };
};
