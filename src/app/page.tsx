"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { initLiff, ensureLogin, getLineId } from "@/lib/liff";
import { checkRegistered } from "@/lib/api";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import { useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        await ensureLogin();
        const lineId = await getLineId();
        const result = await checkRegistered(lineId);
        if (result.status === "exists") {
          router.replace("/dashboard");
        } else {
          router.replace("/register");
        }
      } catch (err) {
        console.error(err);
        setError("LINEアプリからアクセスしてください");
      }
    })();
  }, [router]);

  if (error) return <ErrorMessage message={error} />;
  return <LoadingSpinner />;
}
