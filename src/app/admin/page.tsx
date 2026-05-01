"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiff } from "@/hooks/useLiff";
import { apiClient } from "@/lib/api";
import { IUserProgress, IMessageDraft, IVenue } from "@/lib/types";
import { getDaysFromToday } from "@/lib/utils";
import { Spinner } from "@/components/Spinner";

const ProgressRing = ({ percent }: { percent: number }) => {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  // success / warning / primary を段階で
  const color = percent >= 80 ? "#2F8A4E" : percent >= 50 ? "#D88B2C" : "#2F5A40";
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0" aria-hidden="true">
      <circle cx="24" cy="24" r={radius} fill="none" stroke="#EFE8DC" strokeWidth="4" />
      <circle
        cx="24"
        cy="24"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 24 24)"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
      <text
        x="24"
        y="28"
        textAnchor="middle"
        fontSize="10"
        fontWeight="bold"
        fill={color}
        fontVariant="tabular-nums"
      >
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
  const [venues, setVenues] = useState<IVenue[]>([]);
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("couples");
  // venueId が空文字の場合は「全式場まとめて表示」、特定の値なら式場で絞り込み
  const [venueId, setVenueId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

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

  // 管理者ログイン時のみ、式場フィルタ用の式場一覧を取得しておく
  useEffect(() => {
    if (!isAdmin) return;
    apiClient
      .get("getVenues", "admin")
      .then((res) => {
        if (res.venues) setVenues(res.venues as IVenue[]);
      })
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    Promise.all([
      apiClient.post({ action: "getUsersWithProgress", line_id: "admin", venue_id: venueId }),
      apiClient.post({ action: "getMessageDrafts", line_id: "admin", venue_id: venueId, status: "pending" }),
    ])
      .then(([usersRes, draftsRes]) => {
        if (usersRes.users) setUsers(usersRes.users as IUserProgress[]);
        if (draftsRes.drafts) setDrafts(draftsRes.drafts as IMessageDraft[]);
      })
      .finally(() => setLoading(false));
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
    await apiClient.post({
      action: "updateDraftStatus",
      line_id: "admin",
      venue_id: venueId,
      draft_id: draftId,
      draft_status: action,
    });
    setDrafts((prev) => prev.filter((d) => d.draft_id !== draftId));
  };

  const handleEditDraft = async (draftId: string, message: string) => {
    await apiClient.post({
      action: "updateDraftMessage",
      line_id: "admin",
      venue_id: venueId,
      draft_id: draftId,
      message,
    });
    setDrafts((prev) =>
      prev.map((d) => (d.draft_id === draftId ? { ...d, draft_message: message } : d))
    );
  };

  if (!authChecked && !isLiffReady) return <Spinner fullScreen />;

  if (!authed) {
    return (
      <div className="flex flex-col items-center justify-center py-3xl animate-fade-in">
        <div className="card-base p-xl w-full max-w-sm">
          <p className="text-label-caps text-primary-70 text-center mb-2xs">PLANNER&nbsp;LOGIN</p>
          <h2 className="font-display text-display-md text-on-surface text-center mb-lg">
            管理者ログイン
          </h2>
          <form onSubmit={handlePasswordLogin} className="flex flex-col gap-sm">
            <input
              type="password"
              placeholder="パスワードを入力"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-base"
            />
            <button type="submit" className="btn-primary mt-xs">
              ログイン
            </button>
          </form>
          <p className="text-body-sm text-neutral-50 text-center mt-md">
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
    <div className="pb-2xl animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-md mb-xl">
        <div>
          <p className="text-label-caps text-tertiary-70">DASHBOARD</p>
          <h2 className="font-display text-display-lg text-on-surface mt-2xs">ダッシュボード</h2>
        </div>
        {isAdmin && (
          <button
            onClick={() => router.push("/admin/venues")}
            className="btn-secondary md:px-lg"
            aria-label="式場管理を開く"
          >
            式場管理
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      {/* 管理者は複数式場をまたいで見れるので、フィルタとして式場切替を提供 */}
      {isAdmin && venues.length > 0 && (
        <div className="card-base p-md mb-lg flex flex-col md:flex-row md:items-center gap-sm md:gap-md">
          <label className="text-label-md text-neutral-50 md:shrink-0" htmlFor="venue-filter">
            表示する式場
          </label>
          <select
            id="venue-filter"
            value={venueId}
            onChange={(e) => setVenueId(e.target.value)}
            aria-label="表示する式場を選択"
            className="input-base md:max-w-md"
          >
            <option value="">全式場をまとめて表示</option>
            {venues.map((v) => (
              <option key={v.venue_id} value={v.venue_id}>
                {v.venue_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* サマリカード */}
      <div className="grid grid-cols-3 gap-sm md:gap-md mb-xl">
        <div className="card-base p-md md:p-lg text-center">
          <p className="font-display text-[32px] md:text-[36px] tabular-nums leading-none text-primary-70">
            {couples.length}
          </p>
          <p className="text-body-sm text-neutral-50 mt-xs">登録ペア数</p>
        </div>
        <div className="card-base p-md md:p-lg text-center">
          <p className="font-display text-[32px] md:text-[36px] tabular-nums leading-none text-tertiary-70">
            {avgPercent}%
          </p>
          <p className="text-body-sm text-neutral-50 mt-xs">平均完了率</p>
        </div>
        <button
          type="button"
          onClick={() => setActiveTab("drafts")}
          className={[
            "card-base p-md md:p-lg text-center cursor-pointer transition-all",
            "active:scale-[0.98]",
            drafts.length > 0
              ? "border-warning/40 hover:border-warning"
              : "hover:border-neutral-80",
          ].join(" ")}
        >
          <p
            className={[
              "font-display text-[32px] md:text-[36px] tabular-nums leading-none",
              drafts.length > 0 ? "text-warning" : "text-neutral-60",
            ].join(" ")}
          >
            {drafts.length}
          </p>
          <p className="text-body-sm text-neutral-50 mt-xs">承認待ち</p>
        </button>
      </div>

      {/* タブ */}
      <div role="tablist" className="flex border-b border-border mb-lg">
        <button
          role="tab"
          aria-selected={activeTab === "couples"}
          onClick={() => setActiveTab("couples")}
          className={[
            "flex-1 py-sm text-headline-sm transition-colors duration-short border-b-[2px]",
            activeTab === "couples"
              ? "border-primary-70 text-primary-70"
              : "border-transparent text-neutral-50",
          ].join(" ")}
        >
          カップル一覧
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "drafts"}
          onClick={() => setActiveTab("drafts")}
          className={[
            "flex-1 py-sm text-headline-sm transition-colors duration-short border-b-[2px] relative",
            activeTab === "drafts"
              ? "border-primary-70 text-primary-70"
              : "border-transparent text-neutral-50",
          ].join(" ")}
        >
          承認待ちメッセージ
          {drafts.length > 0 && (
            <span className="absolute -top-1 right-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 bg-warning text-white text-[10px] font-bold rounded-full tabular-nums">
              {drafts.length}
            </span>
          )}
        </button>
      </div>

      {/* カップル一覧 */}
      {activeTab === "couples" && (
        <>
          {couples.length === 0 ? (
            <div className="card-base p-2xl text-center text-body-md text-neutral-50">
              登録されているお客様がいません
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-md">
              {couples
                .slice()
                .sort((a, b) => (a.wedding_date > b.wedding_date ? 1 : -1))
                .map((user) => {
                  const percent =
                    user.total_tasks > 0
                      ? Math.round((user.done_tasks / user.total_tasks) * 100)
                      : 0;
                  const parts = user.wedding_date?.split("-").map(Number);
                  const weddingObj = parts && parts[0] ? new Date(parts[0], parts[1] - 1, parts[2]) : null;
                  const daysLeft = weddingObj ? getDaysFromToday(weddingObj) : null;
                  const coupleName =
                    user.name1_kana && user.name2_kana
                      ? `${user.name1_kana}＆${user.name2_kana}`
                      : "（未登録）";
                  const initials =
                    user.name1_kana && user.name2_kana
                      ? `${user.name1_kana[0]}＆${user.name2_kana[0]}`
                      : "?";

                  const dueChip =
                    daysLeft === null
                      ? null
                      : daysLeft > 30
                      ? { color: "text-primary-70", bg: "bg-primary-10" }
                      : daysLeft > 0
                      ? { color: "text-warning", bg: "bg-tertiary-10" }
                      : { color: "text-error", bg: "bg-error/10" };

                  const barColor =
                    percent >= 80 ? "bg-success" : percent >= 50 ? "bg-warning" : "bg-primary-70";

                  return (
                    <div key={user.line_id} className="card-base p-lg">
                      <div className="flex items-start gap-sm">
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center text-white font-display text-[12px] font-semibold shrink-0"
                          style={{
                            background:
                              "linear-gradient(135deg, #2F5A40 0%, #5A8E6E 50%, #D4A853 100%)",
                          }}
                          aria-hidden="true"
                        >
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-headline-md text-on-surface truncate">
                            {coupleName}
                            <span className="text-neutral-50 text-body-md ml-1">ペア</span>
                          </p>
                          <div className="flex items-center gap-xs mt-2xs flex-wrap">
                            <span className="text-body-sm text-neutral-50 tabular-nums">
                              {user.wedding_date || "日程未定"}
                            </span>
                            {dueChip && daysLeft !== null && (
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums ${dueChip.color} ${dueChip.bg}`}
                              >
                                {daysLeft > 0
                                  ? `あと${daysLeft}日`
                                  : daysLeft === 0
                                  ? "本日！"
                                  : `${Math.abs(daysLeft)}日経過`}
                              </span>
                            )}
                          </div>
                        </div>
                        <ProgressRing percent={percent} />
                      </div>
                      <div className="mt-md">
                        <div className="flex justify-between items-center mb-2xs">
                          <span className="text-body-sm text-neutral-50">タスク進捗</span>
                          <span className="text-body-sm font-semibold text-on-surface tabular-nums">
                            {user.done_tasks} / {user.total_tasks} 完了
                          </span>
                        </div>
                        <div className="h-1.5 bg-neutral-90 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-medium ${barColor}`}
                            style={{ width: `${percent}%` }}
                            role="progressbar"
                            aria-valuenow={percent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          />
                        </div>
                      </div>
                      <div className="mt-md flex justify-end">
                        <button
                          onClick={() => router.push(`/admin/${user.line_id}`)}
                          className="btn-ghost"
                        >
                          タスクを管理
                          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path
                              fillRule="evenodd"
                              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}

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
      <div className="card-base p-2xl text-center text-body-md text-neutral-50">
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
      {drafts.map((draft) => (
        <div
          key={draft.draft_id}
          className="bg-white rounded-lg border border-warning/30 shadow-card p-lg"
        >
          <div className="flex items-center gap-xs mb-sm">
            <span className="w-2 h-2 rounded-full bg-warning shrink-0" aria-hidden="true" />
            <span className="text-label-caps text-warning">承認待ち</span>
            <span className="ml-auto text-body-sm text-neutral-60 tabular-nums">
              {draft.couple_id.slice(0, 12)}…
            </span>
          </div>

          {editingId === draft.draft_id ? (
            <div className="flex flex-col gap-xs">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={5}
                className="input-base !h-auto py-sm resize-none"
                style={{ minHeight: "8rem" }}
              />
              <div className="flex gap-xs justify-end">
                <button
                  onClick={() => setEditingId(null)}
                  className="px-sm h-9 text-body-md text-neutral-50 hover:text-on-surface rounded-md transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => handleSaveEdit(draft.draft_id)}
                  disabled={saving === draft.draft_id}
                  className="btn-primary !h-9 !px-md text-body-md"
                >
                  保存
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-neutral-98 border border-border rounded-md p-md text-body-md text-on-surface leading-relaxed whitespace-pre-wrap mb-sm">
              {draft.draft_message}
            </div>
          )}

          <div className="flex gap-xs mt-xs">
            {editingId !== draft.draft_id && (
              <button
                onClick={() => {
                  setEditingId(draft.draft_id);
                  setEditText(draft.draft_message);
                }}
                className="flex-1 h-10 px-sm border border-border text-neutral-30 text-body-md font-semibold rounded-md hover:bg-neutral-95 transition-all"
              >
                編集
              </button>
            )}
            <button
              onClick={() => handleReject(draft.draft_id)}
              disabled={saving === draft.draft_id}
              className="flex-1 h-10 px-sm border border-error/30 text-error text-body-md font-semibold rounded-md hover:bg-error/5 disabled:opacity-50 transition-all"
            >
              却下
            </button>
            <button
              onClick={() => handleApprove(draft.draft_id)}
              disabled={saving === draft.draft_id}
              className="flex-1 h-10 px-sm bg-primary-70 text-white text-body-md font-semibold rounded-md hover:bg-primary-80 disabled:opacity-50 transition-all"
            >
              承認して送信
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
