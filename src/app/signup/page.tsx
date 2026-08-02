"use client";

import { useState } from "react";
import Link from "next/link";

// テナント管理者サインアップ（SaaS化 C1）。
// Supabase Auth でユーザー作成 → サーバーが httpOnly セッション発行 →
// app.provision_tenant() が company + tenant_admins を作成（冪等）。
// オンボーディングウィザード（C3）ができたら遷移先を /onboarding に切り替える。
export default function SignupPage() {
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: "signup",
          email,
          password,
          company_name: companyName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError({
          message: data?.error?.message || "登録に失敗しました",
          hint: data?.error?.hint,
        });
        return;
      }
      window.location.href = "/admin";
    } catch {
      setError({ message: "通信に失敗しました", hint: "時間をおいて再度お試しください。" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--cs-page, #f6f5f2)" }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div
            className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center text-white font-bold text-xl"
            style={{ background: "linear-gradient(135deg, var(--cp, #2f5a40), var(--ca, #7fa653))" }}
          >
            R
          </div>
          <h1 className="mt-3 text-xl font-bold" style={{ color: "var(--ct, #1a1815)" }}>
            Roots AI Planner
          </h1>
          <p className="text-[13px] text-gray-500 mt-1">
            式場向けアカウントの新規登録（無料トライアル）
          </p>
        </div>

        <form
          onSubmit={submit}
          className="bg-white rounded-2xl shadow-sm border p-8 flex flex-col gap-4"
          style={{ borderColor: "var(--cb, #e5e2dc)" }}
        >
          <label className="block">
            <span className="text-[12px] font-bold text-gray-600">会社名（式場運営会社）</span>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2.5 text-[14px]"
              style={{ borderColor: "var(--cb, #e5e2dc)" }}
              placeholder="例: サンプルウェディング株式会社"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-bold text-gray-600">メールアドレス</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2.5 text-[14px]"
              style={{ borderColor: "var(--cb, #e5e2dc)" }}
              placeholder="you@example.com"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-bold text-gray-600">パスワード（8文字以上）</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2.5 text-[14px]"
              style={{ borderColor: "var(--cb, #e5e2dc)" }}
              placeholder="••••••••"
            />
          </label>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
              <p className="text-[13px] font-bold text-red-700">{error.message}</p>
              {error.hint && <p className="text-[12px] text-red-600 mt-0.5">{error.hint}</p>}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-lg text-white text-[14px] font-bold disabled:opacity-60"
            style={{ background: "var(--cp, #2f5a40)" }}
          >
            {busy ? "登録中…" : "無料ではじめる"}
          </button>

          <p className="text-center text-[12px] text-gray-500">
            すでにアカウントをお持ちの場合は{" "}
            <Link href="/login" className="underline font-bold" style={{ color: "var(--cp, #2f5a40)" }}>
              ログイン
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
