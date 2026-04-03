"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getLineId } from "@/lib/liff";
import { registerUser } from "@/lib/api";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";

export default function RegisterPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);
    try {
      const lineId = await getLineId();
      await registerUser(lineId, trimmed);
      router.replace("/dashboard");
    } catch (err) {
      console.error(err);
      setError("通信エラーが発生しました。もう一度お試しください");
      setSubmitting(false);
    }
  };

  if (submitting) return <LoadingSpinner />;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg px-6 animate-fade-in">
      <div className="w-full max-w-app">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <h1 className="text-[20px] font-bold text-primary">結婚式準備ダッシュボード</h1>
          <p className="text-[13px] text-text-sub mt-2">
            ニックネームを登録してはじめましょう
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-error rounded-card text-error text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="nickname"
              className="block text-[15px] font-semibold text-text-main mb-1"
            >
              ニックネーム
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              placeholder="例: しゅん"
              className="w-full px-4 py-3 border border-border rounded-card text-[15px] bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
              aria-describedby="nickname-hint"
              autoFocus
            />
            <p id="nickname-hint" className="text-[13px] text-text-sub mt-1">
              最大20文字
            </p>
          </div>
          <button
            type="submit"
            disabled={!nickname.trim()}
            className="w-full min-h-[44px] bg-primary text-white font-semibold text-[15px] rounded-card py-3 active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            はじめる
          </button>
        </form>
      </div>
    </div>
  );
}
