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
  const [name1, setName1] = useState("");
  const [name2, setName2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weddingDate || !name1 || !name2 || !profile) return;

    setLoading(true);
    setError(null);
    try {
      await apiClient.post({
        action: "register",
        line_id: profile.userId,
        wedding_date: weddingDate,
        name1_kana: name1,
        name2_kana: name2,
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

  const isFormValid = weddingDate && name1 && name2;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--colorBg)]">
      <div className="w-full max-w-sm bg-white p-6 rounded-2xl shadow-sm border border-[var(--colorBorder)]">
        <h1 className="text-xl font-bold text-center mb-2 text-[var(--colorText)]">はじめに登録</h1>
        <p className="text-sm text-[var(--colorTextLight)] text-center mb-6">
          お二人の情報を入力してください。
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* 名前入力 */}
          <div>
            <label className="text-xs font-semibold text-[var(--colorTextLight)] mb-2 block">
              お二人のお名前（ひらがな）
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="さくら"
                value={name1}
                onChange={(e) => setName1(e.target.value)}
                required
                className="flex-1 min-w-0 w-0 px-3 py-3 border border-[var(--colorBorder)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--colorPrimary)] bg-gray-50 text-[var(--colorText)] text-base"
              />
              <span className="text-[var(--colorAccent)] font-bold text-lg shrink-0">＆</span>
              <input
                type="text"
                placeholder="たろう"
                value={name2}
                onChange={(e) => setName2(e.target.value)}
                required
                className="flex-1 min-w-0 w-0 px-3 py-3 border border-[var(--colorBorder)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--colorPrimary)] bg-gray-50 text-[var(--colorText)] text-base"
              />
            </div>
          </div>

          {/* 挙式日入力 */}
          <div>
            <label className="text-xs font-semibold text-[var(--colorTextLight)] mb-2 block">
              挙式日
            </label>
            <input
              type="date"
              value={weddingDate}
              onChange={(e) => setWeddingDate(e.target.value)}
              required
              className="block w-full px-4 py-3 border border-[var(--colorBorder)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--colorPrimary)] bg-gray-50 text-[var(--colorText)] text-base"
            />
          </div>

          <button
            type="submit"
            disabled={!isFormValid || loading}
            className={`
              w-full py-3 h-12 rounded-lg font-bold text-base transition-all duration-200
              ${!isFormValid || loading
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
