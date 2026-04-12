"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiff } from "@/hooks/useLiff";
import { apiClient } from "@/lib/api";
import { Spinner } from "@/components/Spinner";
import { ErrorMessage } from "@/components/ErrorMessage";

export default function LoadingPage() {
  const { isLiffReady, profile, error } = useLiff();
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      if (isLiffReady && profile) {
        try {
          const res = await apiClient.get("getUser", profile.userId);
          if (res.status === "exists") {
            router.push("/dashboard");
          } else {
            router.push("/register");
          }
        } catch (err: any) {
          setApiError(err.message || "予期せぬエラーが発生しました");
        }
      }
    };
    checkUser();
  }, [isLiffReady, profile, router]);

  if (error || apiError) {
    return (
      <div className="flex items-center justify-center min-h-screen text-center p-4">
        <div>
          <p className="text-[var(--colorError)] font-bold mb-4">{error || "通信エラーが発生しました。"}</p>
        </div>
      </div>
    );
  }

  return <Spinner fullScreen />;
}
