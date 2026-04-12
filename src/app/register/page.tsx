"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiff } from "@/hooks/useLiff";
import { apiClient } from "@/lib/api";
import { Spinner } from "@/components/Spinner";
import { ErrorMessage } from "@/components/ErrorMessage";

export default function RegisterPage() {
  const { isLiffReady, profile } = useLiff();
  const router = useRouter();
  const [weddingDate, setWeddingDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weddingDate || !profile) return;
    
    setLoading(true);
    setError(null);
    try {
      await apiClient.post({
        action: "register",
        line_id: profile.userId,
        wedding_date: weddingDate,
      });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "エラーが発生しました");
      setLoading(false);
    }
  };

  if (!isLiffReady || !profile) {
    return <Spinner fullScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--colorBg)]">
      <div className="w-full max-w-sm bg-white p-6 rounded-2xl shadow-sm border border-[var(--colorBorder)]">
        <h1 className="text-xl font-bold text-center mb-2 text-[var(--colorText)]">挙式日の登録</h1>
        <p className="text-sm text-[var(--colorTextLight)] text-center mb-6">
          あなたの結婚式（挙式）の予定日を入力してください。
        </p>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="date"
            value={weddingDate}
            onChange={(e) => setWeddingDate(e.target.value)}
            required
            className="w-full px-4 py-3 border border-[var(--colorBorder)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--colorPrimary)] bg-gray-50 transition-all font-medium text-[var(--colorText)] text-base"
          />
          <button
            type="submit"
            disabled={!weddingDate || loading}
            className={`
              w-full py-3 h-12 rounded-lg font-bold text-base transition-all duration-200
              ${!weddingDate || loading 
                ? "bg-[#DCDCDC] text-white cursor-not-allowed" 
                : "bg-[var(--colorPrimary)] text-white hover:opacity-90 active:scale-95 shadow-md shadow-[var(--colorPrimary)]/30"}
            `}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
            ) : (
              "はじめる"
            )}
          </button>
        </form>
      </div>

      {error && <ErrorMessage message={error} />}
    </div>
  );
}
