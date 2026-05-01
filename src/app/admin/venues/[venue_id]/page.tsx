"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { IVenue, IUserProgress, ITaskMaster } from "@/lib/types";
import { getDaysFromToday } from "@/lib/utils";
import { Spinner } from "@/components/Spinner";
import { ErrorMessage } from "@/components/ErrorMessage";

export default function VenueDetailPage({ params }: { params: { venue_id: string } }) {
  const router = useRouter();
  const venueId = params.venue_id;

  const [venue, setVenue] = useState<IVenue | null>(null);
  const [users, setUsers] = useState<IUserProgress[]>([]);
  const [pendingDraftsCount, setPendingDraftsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [taskMasters, setTaskMasters] = useState<ITaskMaster[]>([]);
  const [urlDraft, setUrlDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedFlashId, setSavedFlashId] = useState<string | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.post({ action: "getVenueDetail", line_id: "admin", venue_id: venueId }),
      apiClient.post({ action: "getVenueTasks", line_id: "admin", venue_id: venueId }),
    ])
      .then(([detailRes, tasksRes]) => {
        if (detailRes.status === "error") throw new Error(detailRes.message);
        setVenue(detailRes.venue as IVenue);
        setUsers((detailRes.users || []) as IUserProgress[]);
        setPendingDraftsCount(detailRes.pending_drafts_count || 0);

        if (tasksRes.status !== "error") {
          const tasks = (tasksRes.tasks || []) as ITaskMaster[];
          setTaskMasters(tasks);
          setUrlDraft(Object.fromEntries(tasks.map((t) => [t.task_id, t.manual_url || ""])));
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [venueId]);

  const handleSaveManualUrl = async (taskId: string) => {
    setManualError(null);
    setSavingId(taskId);
    try {
      const url = (urlDraft[taskId] || "").trim();
      const res = await apiClient.post({
        action: "updateTaskManualUrl",
        line_id: "admin",
        venue_id: venueId,
        task_id: taskId,
        manual_url: url,
      });
      if (res.status === "error") throw new Error(res.message);
      setTaskMasters((prev) => prev.map((t) => (t.task_id === taskId ? { ...t, manual_url: url } : t)));
      setSavedFlashId(taskId);
      setTimeout(() => setSavedFlashId((id) => (id === taskId ? null : id)), 1500);
    } catch (e: any) {
      setManualError(e.message || "保存に失敗しました");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <Spinner fullScreen />;
  if (error) return <ErrorMessage message={error} />;
  if (!venue) return <ErrorMessage message="式場が見つかりません" />;

  const couples = users.filter((u) => !u.is_admin);

  return (
    <div className="pb-2xl animate-fade-in">
      <div className="flex items-center gap-sm mb-lg">
        <button
          onClick={() => router.push("/admin/venues")}
          className="w-10 h-10 -ml-xs flex items-center justify-center text-neutral-50 hover:bg-neutral-95 rounded-full active:bg-neutral-90 transition-colors shrink-0"
          aria-label="式場一覧へ戻る"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-display text-display-md text-on-surface truncate">
          {venue.venue_name}
        </h2>
      </div>

      {/* 式場情報 */}
      <div className="card-base p-lg mb-md">
        <p className="text-label-caps text-neutral-50 mb-sm">式場情報</p>
        <dl className="flex flex-col gap-xs text-body-md">
          <div className="flex gap-sm">
            <dt className="w-24 text-neutral-50 shrink-0">式場ID</dt>
            <dd className="font-mono font-semibold text-on-surface">{venue.venue_id}</dd>
          </div>
          <div className="flex gap-sm items-center">
            <dt className="w-24 text-neutral-50 shrink-0">ステータス</dt>
            <dd>
              <span
                className={[
                  "text-[11px] font-bold px-2 py-0.5 rounded-full",
                  venue.active
                    ? "bg-success/15 text-success"
                    : "bg-neutral-95 text-neutral-50",
                ].join(" ")}
              >
                {venue.active ? "契約中" : "停止中"}
              </span>
            </dd>
          </div>
          <div className="flex gap-sm">
            <dt className="w-24 text-neutral-50 shrink-0">登録日</dt>
            <dd className="text-on-surface tabular-nums">{venue.created_at?.slice(0, 10)}</dd>
          </div>
        </dl>
      </div>

      <div className="grid grid-cols-2 gap-sm mb-lg">
        <div className="card-base p-md text-center">
          <p className="font-display text-[28px] tabular-nums leading-none text-primary-70">
            {couples.length}
          </p>
          <p className="text-body-sm text-neutral-50 mt-2xs">登録ペア数</p>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/admin?tab=drafts&venue=${venueId}`)}
          className={[
            "card-base p-md text-center cursor-pointer transition-all active:scale-[0.98]",
            pendingDraftsCount > 0
              ? "border-warning/40 hover:border-warning"
              : "hover:border-neutral-80",
          ].join(" ")}
        >
          <p
            className={[
              "font-display text-[28px] tabular-nums leading-none",
              pendingDraftsCount > 0 ? "text-warning" : "text-neutral-60",
            ].join(" ")}
          >
            {pendingDraftsCount}
          </p>
          <p className="text-body-sm text-neutral-50 mt-2xs">承認待ち</p>
        </button>
      </div>

      <h3 className="text-headline-md text-on-surface mb-md">基本タスクのマニュアル設定</h3>
      <p className="text-body-sm text-neutral-50 mb-sm">
        各タスクに表示するマニュアル（手順書・資料など）のURLを登録します。設定すると、ペアのタスク画面から「マニュアルを見る」リンクが利用できるようになります。
      </p>
      {manualError && (
        <div className="card-base p-sm mb-sm border-error/40 text-body-sm text-error">
          {manualError}
        </div>
      )}
      {taskMasters.length === 0 ? (
        <div className="card-base p-lg text-center text-body-md text-neutral-50 mb-lg">
          この式場で利用できる基本タスクがありません
        </div>
      ) : (
        <div className="flex flex-col gap-sm mb-lg">
          {taskMasters.map((task) => {
            const draft = urlDraft[task.task_id] ?? "";
            const isSaving = savingId === task.task_id;
            const isSaved = savedFlashId === task.task_id;
            const currentUrl = task.manual_url || "";
            const isDirty = draft.trim() !== currentUrl.trim();

            return (
              <div key={task.task_id} className="card-base p-md flex flex-col gap-xs">
                <div className="flex items-start gap-xs flex-wrap">
                  <span className="inline-block bg-primary-10 text-primary-70 text-label-caps px-2xs py-0.5 rounded-xs">
                    {task.category || "その他"}
                  </span>
                  <p className="text-body-md text-on-surface flex-1 min-w-0">
                    {task.task_content}
                  </p>
                </div>
                <div className="flex items-center gap-xs flex-wrap">
                  <input
                    type="url"
                    inputMode="url"
                    placeholder="https://..."
                    value={draft}
                    onChange={(e) =>
                      setUrlDraft((prev) => ({ ...prev, [task.task_id]: e.target.value }))
                    }
                    className="input-base flex-1 min-w-0"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveManualUrl(task.task_id)}
                    disabled={isSaving || !isDirty}
                    className="btn-primary !h-12 !px-md text-body-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? "保存中..." : isSaved ? "保存済み✓" : "保存"}
                  </button>
                  {currentUrl && (
                    <a
                      href={currentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost !h-12 !px-sm text-body-sm shrink-0"
                    >
                      開く
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h3 className="text-headline-md text-on-surface mb-md">カップル一覧</h3>
      {couples.length === 0 ? (
        <div className="card-base p-lg text-center text-body-md text-neutral-50">
          まだカップルが登録されていません
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
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

              const dueChip =
                daysLeft === null
                  ? null
                  : daysLeft > 30
                  ? { color: "text-primary-70", bg: "bg-primary-10" }
                  : daysLeft > 0
                  ? { color: "text-warning", bg: "bg-tertiary-10" }
                  : { color: "text-error", bg: "bg-error/10" };

              return (
                <div
                  key={user.line_id}
                  className="card-base p-md flex items-center gap-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-headline-sm text-on-surface truncate">
                      {coupleName}
                      <span className="text-neutral-50 text-body-sm ml-1">ペア</span>
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
                  <div className="text-right shrink-0">
                    <p className="text-body-md font-semibold text-on-surface tabular-nums">
                      {user.done_tasks}/{user.total_tasks}
                    </p>
                    <p className="text-body-sm text-neutral-50 tabular-nums">{percent}%</p>
                  </div>
                  <button
                    onClick={() => router.push(`/admin/${user.line_id}`)}
                    className="btn-ghost !h-9 !px-sm text-body-sm shrink-0"
                  >
                    管理
                  </button>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
