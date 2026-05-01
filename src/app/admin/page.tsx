"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiff } from "@/hooks/useLiff";
import { apiClient } from "@/lib/api";
import { IUserProgress, IMessageDraft } from "@/lib/types";
import { getDaysFromToday } from "@/lib/utils";
import { Spinner } from "@/components/Spinner";

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

type TabType = "couples" | "drafts";

export default function AdminDashboard() {
  const { isLiffReady, profile } = useLiff();
  const router = useRouter();

  const [users, setUsers] = useState<IUserProgress[]>([]);
  const [drafts, setDrafts] = useState<IMessageDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("couples");
  const [venueId, setVenueId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  // LIFF 認証
  useEffect(() => {
    if (!isLiffReady || !profile) return;
    const check = async () => {
      try {
        const res = await apiClient.post({ action: "getUser", line_id: profile.userId });
        if (res.is_admin) {
          setIsAdmin(true);
          setAuthed(true);
        } else if (res.status === "planner") {
          setVenueId(res.venue_id || "");
          setAuthed(true);
        } else if (res.status === "exists" && res.venue_id) {
          setVenueId(res.venue_id || "");
          setAuthed(true);
        }
      } catch (_) {}
      setAuthChecked(true);
    };
    check();
  }, [isLiffReady, profile]);

  useEffect(() => {
    if (isLiffReady && !profile) setAuthChecked(true);
  }, [isLiffReady, profile]);

  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    Promise.all([
      apiClient.post({ action: "getUsersWithProgress", line_id: "admin", venue_id: venueId }),
      apiClient.post({ action: "getMessageDrafts", line_id: "admin", venue_id: venueId, status: "pending" }),
    ]).then(([usersRes, draftsRes]) => {
      if (usersRes.users) setUsers(usersRes.users as IUserProgress[]);
      if (draftsRes.drafts) setDrafts(draftsRes.drafts as IMessageDraft[]);
    }).finally(() => setLoading(false));
  }, [authed, venueId]);

  const handlePasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === (process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "roots2026")) {
      setIsAdmin(true);
      setAuthed(true);
    } else {
      alert("パスワードが違います");
    }
  };

  const handleDraftAction = async (draftId: string, action: "approved" | "rejected") => {
    await apiClient.post({ action: "updateDraftStatus", line_id: "admin", venue_id: venueId, draft_id: draftId, draft_status: action });
    setDrafts(prev => prev.filter(d => d.draft_id !== draftId));
  };

  const handleEditDraft = async (draftId: string, message: string) => {
    await apiClient.post({ action: "updateDraftMessage", line_id: "admin", venue_id: venueId, draft_id: draftId, message });
    setDrafts(prev => prev.map(d => d.draft_id === draftId ? { ...d, draft_message: message } : d));
  };

  if (!authChecked && !isLiffReady) return <Spinner fullScreen />;

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
            (sum, u) => sum + (u.total_tasks > 0 ? (u.done_tasks / u.total_tasks) * 100 : 0),
            0
          ) / couples.length
        );

  return (
    <div className="pb-16">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-[var(--colorText)]">ダッシュボード</h2>
        {isAdmin && (
          <button
            onClick={() => router.push("/admin/venues")}
            className="px-4 py-2 text-sm bg-[var(--colorSecondary)] text-[var(--colorPrimary)] font-bold rounded-xl hover:opacity-80 transition-all"
          >
            式場管理
          </button>
        )}
      </div>

      {/* サマリカード */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-[28px] font-bold leading-none text-[var(--colorPrimary)]">{couples.length}</p>
          <p className="text-[11px] text-gray-500 mt-1">登録ペア数</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-[28px] font-bold leading-none" style={{ color: "var(--colorAccent)" }}>{avgPercent}%</p>
          <p className="text-[11px] text-gray-500 mt-1">平均完了率</p>
        </div>
        <div
          className="bg-white rounded-2xl border shadow-sm p-4 text-center cursor-pointer hover:opacity-80 transition-all"
          style={{ borderColor: drafts.length > 0 ? "#f59e0b" : "#f3f4f6" }}
          onClick={() => setActiveTab("drafts")}
        >
          <p className="text-[28px] font-bold leading-none" style={{ color: drafts.length > 0 ? "#f59e0b" : "#9ca3af" }}>{drafts.length}</p>
          <p className="text-[11px] text-gray-500 mt-1">承認待ち</p>
        </div>
      </div>

      {/* タブ切り替え */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab("couples")}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === "couples" ? "border-b-2 border-[var(--colorPrimary)] text-[var(--colorPrimary)]" : "text-gray-500"}`}
        >
          カップル一覧
        </button>
        <button
          onClick={() => setActiveTab("drafts")}
          className={`flex-1 py-3 text-sm font-bold transition-colors relative ${activeTab === "drafts" ? "border-b-2 border-[var(--colorPrimary)] text-[var(--colorPrimary)]" : "text-gray-500"}`}
        >
          承認待ちメッセージ
          {drafts.length > 0 && (
            <span className="absolute -top-1 right-4 w-5 h-5 bg-amber-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {drafts.length}
            </span>
          )}
        </button>
      </div>

      {/* カップル一覧タブ */}
      {activeTab === "couples" && (
        <>
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
                  const percent = user.total_tasks > 0 ? Math.round((user.done_tasks / user.total_tasks) * 100) : 0;
                  const parts = user.wedding_date?.split("-").map(Number);
                  const weddingObj = parts && parts[0] ? new Date(parts[0], parts[1] - 1, parts[2]) : null;
                  const daysLeft = weddingObj ? getDaysFromToday(weddingObj) : null;
                  const coupleName = user.name1_kana && user.name2_kana ? `${user.name1_kana}＆${user.name2_kana}` : "（未登録）";
                  const initials = user.name1_kana && user.name2_kana ? `${user.name1_kana[0]}＆${user.name2_kana[0]}` : "?";
                  const barColor = percent >= 80 ? "#4CAF50" : percent >= 50 ? "#F59E0B" : "var(--colorPrimary)";

                  return (
                    <div key={user.line_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                          style={{ background: "linear-gradient(135deg, var(--colorPrimary), var(--colorAccent))" }}
                        >
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[16px] font-bold text-[var(--colorText)] truncate">{coupleName}ペア</p>
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
                      <div className="mt-4">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[11px] text-gray-400 font-medium">タスク進捗</span>
                          <span className="text-[12px] font-bold text-gray-600">{user.done_tasks} / {user.total_tasks} 完了</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: barColor, transition: "width 0.5s ease" }} />
                        </div>
                      </div>
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
        </>
      )}

      {/* 承認待ちメッセージタブ */}
      {activeTab === "drafts" && (
        <DraftsPanel drafts={drafts} onAction={handleDraftAction} onEdit={handleEditDraft} />
      )}
    </div>
  );
}

function DraftsPanel({
  drafts,
  onAction,
  onEdit,
}: {
  drafts: IMessageDraft[];
  onAction: (id: string, action: "approved" | "rejected") => Promise<void>;
  onEdit: (id: string, message: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  if (drafts.length === 0) {
    return (
      <div className="bg-white p-8 rounded-2xl text-center text-gray-400 border border-gray-100">
        承認待ちのメッセージはありません
      </div>
    );
  }

  const handleSaveEdit = async (draftId: string) => {
    setSaving(draftId);
    await onEdit(draftId, editText);
    setSaving(null);
    setEditingId(null);
  };

  const handleApprove = async (draftId: string) => {
    setSaving(draftId);
    await onAction(draftId, "approved");
    setSaving(null);
  };

  const handleReject = async (draftId: string) => {
    if (!confirm("このメッセージを却下しますか？")) return;
    setSaving(draftId);
    await onAction(draftId, "rejected");
    setSaving(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {drafts.map((draft) => (
        <div key={draft.draft_id} className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">承認待ち</span>
            <span className="ml-auto text-[11px] text-gray-400">{draft.couple_id.slice(0, 12)}...</span>
          </div>

          {editingId === draft.draft_id ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={5}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none outline-none focus:border-[var(--colorPrimary)]"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditingId(null)}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => handleSaveEdit(draft.draft_id)}
                  disabled={saving === draft.draft_id}
                  className="px-4 py-1.5 bg-[var(--colorPrimary)] text-white text-sm font-bold rounded-lg disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-3">
              {draft.draft_message}
            </div>
          )}

          <div className="flex gap-2 mt-2">
            {editingId !== draft.draft_id && (
              <button
                onClick={() => { setEditingId(draft.draft_id); setEditText(draft.draft_message); }}
                className="flex-1 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-all"
              >
                編集
              </button>
            )}
            <button
              onClick={() => handleReject(draft.draft_id)}
              disabled={saving === draft.draft_id}
              className="flex-1 px-3 py-2 border border-red-200 text-red-500 text-sm font-bold rounded-xl hover:bg-red-50 disabled:opacity-50 transition-all"
            >
              却下
            </button>
            <button
              onClick={() => handleApprove(draft.draft_id)}
              disabled={saving === draft.draft_id}
              className="flex-1 px-3 py-2 bg-[var(--colorPrimary)] text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
            >
              承認して送信
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
