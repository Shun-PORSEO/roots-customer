"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiff } from "@/hooks/useLiff";
import { apiClient } from "@/lib/api";
import { IUserProgress } from "@/lib/types";
import { getDaysFromToday } from "@/lib/utils";
import { Spinner } from "@/components/Spinner";

// 進捗リング（SVG）
const ProgressRing = ({ percent }: { percent: number }) => {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const color =
    percent >= 80 ? "#4CAF50" : percent >= 50 ? "#F59E0B" : "var(--colorPrimary)";
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0">
      <circle cx="24" cy="24" r={radius} fill="none" stroke="#F0EBE0" strokeWidth="4" />
      <circle
        cx="24" cy="24" r={radius} fill="none"
        stroke={color} strokeWidth="4"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 24 24)"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
      <text x="24" y="28" textAnchor="middle" fontSize="10" fontWeight="bold" fill={color}>
        {percent}%
      </text>
    </svg>
  );
};

export default function AdminDashboard() {
  const { isLiffReady, profile } = useLiff();
  const router = useRouter();

  const [users, setUsers] = useState<IUserProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [password, setPassword] = useState("");

  // LIFF 認証：is_admin=true なら自動ログイン
  useEffect(() => {
    if (!isLiffReady || !profile) return;
    const check = async () => {
      try {
        const res = await apiClient.post({ action: "getUser", line_id: profile.userId });
        if (res.is_admin) setAuthed(true);
      } catch (_) {}
      setAuthChecked(true);
    };
    check();
  }, [isLiffReady, profile]);

  // LIFF が使えない場合（非 LINE ブラウザ）もパスワードへ
  useEffect(() => {
    if (isLiffReady && !profile) setAuthChecked(true);
  }, [isLiffReady, profile]);

  // 認証後にデータ取得
  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    apiClient
      .post({ action: "getUsersWithProgress", line_id: "admin" })
      .then((res) => {
        if (res.users) setUsers(res.users as IUserProgress[]);
      })
      .finally(() => setLoading(false));
  }, [authed]);

  const handlePasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === (process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "roots2026")) {
      setAuthed(true);
    } else {
      alert("パスワードが違います");
    }
  };

  // LIFF チェック中
  if (!authChecked && !isLiffReady) return <Spinner fullScreen />;

  // 未認証 → パスワードフォーム
  if (!authed) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 w-full max-w-sm">
          <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--colorPrimary)] uppercase text-center mb-2">
            Planner Login
          </p>
          <h2 className="text-xl font-bold mb-6 text-center text-[var(--colorText)]">
            管理者ログイン
          </h2>
          <form onSubmit={handlePasswordLogin} className="flex flex-col gap-4">
            <input
              type="password"
              placeholder="パスワードを入力"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-[var(--colorPrimary)] bg-gray-50"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-[var(--colorPrimary)] text-white font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all"
            >
              ログイン
            </button>
          </form>
          <p className="text-[11px] text-gray-400 text-center mt-4">
            LINEログインでも自動認証されます
          </p>
        </div>
      </div>
    );
  }

  if (loading) return <Spinner fullScreen />;

  const couples = users.filter((u) => !u.is_admin);
  const avgPercent =
    couples.length === 0
      ? 0
      : Math.round(
          couples.reduce(
            (sum, u) =>
              sum + (u.total_tasks > 0 ? (u.done_tasks / u.total_tasks) * 100 : 0),
            0
          ) / couples.length
        );

  return (
    <div className="pb-16">
      {/* ページタイトル */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-[var(--colorText)]">ダッシュボード</h2>
      </div>

      {/* サマリカード */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-[32px] font-bold leading-none text-[var(--colorPrimary)]">
            {couples.length}
          </p>
          <p className="text-[12px] text-gray-500 mt-1">登録ペア数</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-[32px] font-bold leading-none" style={{ color: "var(--colorAccent)" }}>
            {avgPercent}%
          </p>
          <p className="text-[12px] text-gray-500 mt-1">平均完了率</p>
        </div>
      </div>

      {/* ペア一覧 */}
      {couples.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl text-center text-gray-400 border border-gray-100">
          登録されているお客様がいません
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {couples
            .slice()
            .sort((a, b) => (a.wedding_date > b.wedding_date ? 1 : -1))
            .map((user) => {
              const percent =
                user.total_tasks > 0
                  ? Math.round((user.done_tasks / user.total_tasks) * 100)
                  : 0;
              const parts = user.wedding_date?.split("-").map(Number);
              const weddingObj =
                parts && parts[0]
                  ? new Date(parts[0], parts[1] - 1, parts[2])
                  : null;
              const daysLeft = weddingObj ? getDaysFromToday(weddingObj) : null;
              const coupleName =
                user.name1_kana && user.name2_kana
                  ? `${user.name1_kana}＆${user.name2_kana}`
                  : "（未登録）";
              const initials =
                user.name1_kana && user.name2_kana
                  ? `${user.name1_kana[0]}＆${user.name2_kana[0]}`
                  : "?";

              const barColor =
                percent >= 80 ? "#4CAF50" : percent >= 50 ? "#F59E0B" : "var(--colorPrimary)";

              return (
                <div
                  key={user.line_id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
                >
                  {/* 上段：アバター・名前・リング */}
                  <div className="flex items-start gap-3">
                    {/* イニシャルアバター */}
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                      style={{ background: "linear-gradient(135deg, var(--colorPrimary), var(--colorAccent))" }}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[16px] font-bold text-[var(--colorText)] truncate">
                        {coupleName}ペア
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[12px] text-gray-500">{user.wedding_date || "日程未定"}</span>
                        {daysLeft !== null && (
                          <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              color: daysLeft > 30 ? "var(--colorPrimary)" : daysLeft > 0 ? "#F59E0B" : "#EF4444",
                              background: daysLeft > 30 ? "var(--colorSecondary)" : daysLeft > 0 ? "#FEF3C7" : "#FEE2E2",
                            }}
                          >
                            {daysLeft > 0 ? `あと${daysLeft}日` : daysLeft === 0 ? "本日！" : `${Math.abs(daysLeft)}日経過`}
                          </span>
                        )}
                      </div>
                    </div>
                    <ProgressRing percent={percent} />
                  </div>

                  {/* 進捗バー */}
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[11px] text-gray-400 font-medium">タスク進捗</span>
                      <span className="text-[12px] font-bold text-gray-600">
                        {user.done_tasks} / {user.total_tasks} 完了
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${percent}%`,
                          backgroundColor: barColor,
                          transition: "width 0.5s ease",
                        }}
                      />
                    </div>
                  </div>

                  {/* アクションボタン */}
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => router.push(`/admin/${user.line_id}`)}
                      className="px-4 py-2 bg-[var(--colorSecondary)] text-[var(--colorPrimary)] text-[13px] font-bold rounded-xl hover:opacity-80 active:scale-95 transition-all"
                    >
                      タスクを管理 →
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
