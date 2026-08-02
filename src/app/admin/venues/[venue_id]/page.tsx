"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { getAdminLineId } from "@/hooks/useAdminAuth";
import { IVenue, IUserProgress, ITaskMaster, ILineKeyCheck } from "@/lib/types";
import { getDaysFromToday } from "@/lib/utils";
import { Spinner } from "@/components/Spinner";
import { ErrorMessage, InlineApiError } from "@/components/ErrorMessage";
import { useAdminGate } from "@/hooks/useAdminGate";
import { AdminAccessDenied } from "@/components/AdminAccessDenied";

export default function VenueDetailPage({ params }: { params: { venue_id: string } }) {
  const router = useRouter();
  const venueId = params.venue_id;
  const { authorized, authChecked } = useAdminGate();

  const [venue, setVenue] = useState<IVenue | null>(null);
  const [users, setUsers] = useState<IUserProgress[]>([]);
  const [pendingDraftsCount, setPendingDraftsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const [lineTestResults, setLineTestResults] = useState<ILineKeyCheck[] | null>(null);
  const [lineTesting, setLineTesting] = useState(false);
  const [lineTestError, setLineTestError] = useState<unknown>(null);

  const [taskMasters, setTaskMasters] = useState<ITaskMaster[]>([]);
  const [urlDraft, setUrlDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedFlashId, setSavedFlashId] = useState<string | null>(null);
  const [manualError, setManualError] = useState<unknown>(null);

  useEffect(() => {
    if (!authorized) return;
    Promise.all([
      apiClient.post({ action: "getVenueDetail", line_id: getAdminLineId(), venue_id: venueId }),
      apiClient.post({ action: "getVenueTasks", line_id: getAdminLineId(), venue_id: venueId }),
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
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, [venueId, authorized]);

  const handleSaveManualUrl = async (taskId: string) => {
    setManualError(null);
    setSavingId(taskId);
    try {
      const url = (urlDraft[taskId] || "").trim();
      const res = await apiClient.post({
        action: "updateTaskManualUrl",
        line_id: getAdminLineId(),
        venue_id: venueId,
        task_id: taskId,
        manual_url: url,
      });
      if (res.status === "error") throw new Error(res.message);
      setTaskMasters((prev) => prev.map((t) => (t.task_id === taskId ? { ...t, manual_url: url } : t)));
      setSavedFlashId(taskId);
      setTimeout(() => setSavedFlashId((id) => (id === taskId ? null : id)), 1500);
    } catch (e) {
      setManualError(e instanceof Error ? e : new Error("保存に失敗しました"));
    } finally {
      setSavingId(null);
    }
  };

  const handleLineTest = async () => {
    setLineTesting(true);
    setLineTestError(null);
    try {
      const res = await apiClient.post({
        action: "testLineConnection",
        line_id: getAdminLineId(),
        venue_id: venueId,
      });
      if (res.status === "error") throw new Error(res.message);
      setLineTestResults((res.results || []) as ILineKeyCheck[]);
    } catch (e) {
      setLineTestError(e instanceof Error ? e : new Error("接続テストに失敗しました"));
    } finally {
      setLineTesting(false);
    }
  };

  if (!authChecked || (authorized && loading)) return <Spinner fullScreen />;
  if (!authorized) return <AdminAccessDenied />;
  if (error) return <div className="p-md"><InlineApiError error={error} /></div>;
  if (!venue) return <ErrorMessage message="式場が見つかりません" />;

  const couples = users.filter((u) => !u.is_admin);

  return (
    <div className="pb-2xl animate-fade-in">
      <div className="flex items-center gap-sm mb-xl">
        <button
          onClick={() => router.push("/admin/venues")}
          className="w-10 h-10 -ml-xs flex items-center justify-center text-neutral-50 hover:bg-neutral-95 rounded-full active:bg-neutral-90 transition-colors shrink-0"
          aria-label="式場一覧へ戻る"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0">
          <p className="text-label-caps text-tertiary-70">VENUE&nbsp;DETAIL</p>
          <h2 className="font-display text-display-lg text-on-surface mt-2xs truncate">
            {venue.venue_name}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-lg lg:gap-xl items-start">
        {/* 左カラム: タスクのマニュアル設定 + カップル一覧 */}
        <div className="flex flex-col gap-xl min-w-0">
          {/* マニュアル設定 */}
          <section>
            <div className="flex items-baseline justify-between mb-sm">
              <h3 className="text-headline-lg text-on-surface">基本タスクのマニュアル</h3>
              <span className="text-body-sm text-neutral-50 tabular-nums">
                {taskMasters.length}件
              </span>
            </div>
            <p className="text-body-md text-neutral-50 mb-md">
              各タスクのマニュアル（手順書・資料など）のURLを登録すると、ペアのタスク画面に「マニュアルを見る」リンクが表示されます。
            </p>
            {manualError ? (
              <div className="mb-sm">
                <InlineApiError error={manualError} />
              </div>
            ) : null}
            {taskMasters.length === 0 ? (
              <div className="card-base p-xl text-center text-body-md text-neutral-50">
                この式場で利用できる基本タスクがありません
              </div>
            ) : (
              <div className="flex flex-col gap-sm">
                {taskMasters.map((task) => {
                  const draft = urlDraft[task.task_id] ?? "";
                  const isSaving = savingId === task.task_id;
                  const isSaved = savedFlashId === task.task_id;
                  const currentUrl = task.manual_url || "";
                  const isDirty = draft.trim() !== currentUrl.trim();

                  return (
                    <div key={task.task_id} className="card-base p-md flex flex-col gap-sm">
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
                          className="input-base flex-1 min-w-[220px]"
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
          </section>

          {/* カップル一覧 */}
          <section>
            <div className="flex items-baseline justify-between mb-md">
              <h3 className="text-headline-lg text-on-surface">カップル一覧</h3>
              <span className="text-body-sm text-neutral-50 tabular-nums">{couples.length}組</span>
            </div>
            {couples.length === 0 ? (
              <div className="card-base p-xl text-center text-body-md text-neutral-50">
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
                        className="card-base p-md flex items-center gap-md flex-wrap md:flex-nowrap"
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
                        <div className="text-right shrink-0 min-w-[80px]">
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
          </section>
        </div>

        {/* 右カラム: 式場情報・サマリ（PC は sticky） */}
        <aside className="flex flex-col gap-md lg:sticky lg:top-[88px]">
          <div className="card-base p-lg">
            <p className="text-label-caps text-tertiary-70 mb-sm">VENUE&nbsp;INFO</p>
            <dl className="flex flex-col gap-sm text-body-md">
              <div className="flex gap-sm">
                <dt className="w-20 text-neutral-50 shrink-0">式場ID</dt>
                <dd className="font-mono font-semibold text-on-surface break-all">{venue.venue_id}</dd>
              </div>
              <div className="flex gap-sm items-center">
                <dt className="w-20 text-neutral-50 shrink-0">ステータス</dt>
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
                <dt className="w-20 text-neutral-50 shrink-0">登録日</dt>
                <dd className="text-on-surface tabular-nums">{venue.created_at?.slice(0, 10)}</dd>
              </div>
            </dl>
          </div>

          {/* LINE 接続テスト（SaaS化 C2）: キー4点をそれぞれ実検証して直し方まで表示 */}
          <div className="card-base p-lg">
            <div className="flex items-center justify-between mb-sm">
              <p className="text-label-caps text-tertiary-70">LINE&nbsp;接続テスト</p>
              <button
                type="button"
                onClick={handleLineTest}
                disabled={lineTesting}
                className="btn-ghost !h-9 !px-sm text-body-sm shrink-0 disabled:opacity-50"
              >
                {lineTesting ? "確認中..." : "テスト実行"}
              </button>
            </div>
            {lineTestError ? <InlineApiError error={lineTestError} /> : null}
            {lineTestResults === null && !lineTestError ? (
              <p className="text-body-sm text-neutral-50">
                この式場に設定した LINE のキー（トークン・シークレット・Login チャネルID・LIFF ID）が正しく繋がるかを確認します。
              </p>
            ) : null}
            {lineTestResults ? (
              <ul className="flex flex-col gap-sm">
                {lineTestResults.map((r) => (
                  <li key={r.key} className="text-body-sm">
                    <p className="text-neutral-50">{r.label}</p>
                    <p className={r.ok ? "text-success" : "text-error"}>{r.message}</p>
                    {!r.ok && r.fix ? (
                      <p className="text-neutral-50 mt-2xs leading-relaxed">→ {r.fix}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-sm">
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
        </aside>
      </div>
    </div>
  );
}
