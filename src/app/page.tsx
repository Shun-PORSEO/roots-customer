"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiff } from "@/hooks/useLiff";
import { apiClient } from "@/lib/api";
import { Spinner } from "@/components/Spinner";

export default function LoadingPage() {
  const { isLiffReady, profile, error } = useLiff();
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      if (isLiffReady && profile) {
        try {
          const res = await apiClient.post({ action: "getUser", line_id: profile.userId });
          if (res.status === "exists" && res.name1_kana && res.name2_kana) {
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
      <div className="flex items-center justify-center min-h-screen p-md bg-surface-page">
        <div className="card-base p-xl w-full text-center animate-fade-in">
          <div className="w-14 h-14 mx-auto mb-md bg-error/10 rounded-full flex items-center justify-center">
            <svg className="w-7 h-7 text-error" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zM10 5a1 1 0 011 1v4a1 1 0 11-2 0V6a1 1 0 011-1zm0 8a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="font-display text-display-md text-neutral-20 mb-xs">通信エラー</h2>
          <p className="text-body-md text-neutral-50 mb-md">
            {error || "通信エラーが発生しました。"}
          </p>
          {apiError && (
            <details className="text-left text-body-sm text-neutral-30 bg-neutral-95 rounded-md p-sm mb-md">
              <summary className="font-semibold cursor-pointer">技術的な詳細</summary>
              <pre className="mt-xs whitespace-pre-wrap break-all text-[11px] text-neutral-50 max-h-40 overflow-auto">
                {apiError}
              </pre>
            </details>
          )}
          <button onClick={() => window.location.reload()} className="btn-primary w-full">
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return <Spinner fullScreen label="準備しています…" />;
}
