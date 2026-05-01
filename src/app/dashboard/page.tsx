"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLiff } from "@/hooks/useLiff";
import { apiClient } from "@/lib/api";
import { ITask } from "@/lib/types";
import { formatJapaneseDate, getDaysFromToday } from "@/lib/utils";
import { TaskCard } from "@/components/TaskCard";
import { Spinner } from "@/components/Spinner";
import { ErrorMessage } from "@/components/ErrorMessage";

export default function DashboardPage() {
  const { isLiffReady, profile } = useLiff();
  const router = useRouter();

  const [tasks, setTasks] = useState<ITask[]>([]);
  const [weddingDate, setWeddingDate] = useState<string | null>(null);
  const [name1, setName1] = useState<string>("");
  const [name2, setName2] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"incomplete" | "completed">("incomplete");

  const fetchTasks = useCallback(async () => {
    if (!profile) return;

    const cacheKey = `roots_dashboard_${profile.userId}`;
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        setTasks(parsed.tasks);
        setWeddingDate(parsed.weddingDate);
        setName1(parsed.name1 || "");
        setName2(parsed.name2 || "");
        setIsAdmin(parsed.isAdmin || false);
        setLoading(false);
      } catch (e) {
        // ignore parse error
      }
    }

    try {
      const [resTasks, resUser] = await Promise.all([
        apiClient.get("getTasks", profile.userId),
        apiClient.post({ action: "getUser", line_id: profile.userId }),
      ]);
      const newTasks = resTasks.tasks || [];
      const newWeddingDate = resUser.wedding_date || null;
      const newName1 = resUser.name1_kana || "";
      const newName2 = resUser.name2_kana || "";
      const newIsAdmin = resUser.is_admin || false;

      setTasks(newTasks);
      setWeddingDate(newWeddingDate);
      setName1(newName1);
      setName2(newName2);
      setIsAdmin(newIsAdmin);
      setError(null);

      localStorage.setItem(cacheKey, JSON.stringify({
        tasks: newTasks,
        weddingDate: newWeddingDate,
        name1: newName1,
        name2: newName2,
        isAdmin: newIsAdmin,
      }));
    } catch (err: any) {
      if (!cachedData) {
        setError("タスクの取得に失敗しました。もう一度お試しください。");
      }
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (isLiffReady && profile) {
      fetchTasks();
    }
  }, [isLiffReady, profile, fetchTasks]);

  const handleToggleTask = async (taskId: string, isDone: boolean) => {
    if (!profile) return;

    // 1. 画面上のリストを即時更新（楽観更新）。スプシは遅いので待たずに先に反映。
    const originalTasks = tasks;
    const updatedTasks = tasks.map(t => t.task_id === taskId ? { ...t, is_done: isDone } : t);
    setTasks(updatedTasks);

    // 2. localStorage キャッシュも同時に更新する。
    //    ここを更新しないと、詳細ページから戻った時やリロード時に
    //    古いキャッシュが復元され「完了したのに未完了に戻る」現象が起きる。
    const cacheKey = `roots_dashboard_${profile.userId}`;
    const writeCache = (newTasks: ITask[]) => {
      try {
        const cached = localStorage.getItem(cacheKey);
        const parsed = cached ? JSON.parse(cached) : {};
        localStorage.setItem(cacheKey, JSON.stringify({ ...parsed, tasks: newTasks }));
      } catch {
        // キャッシュ書き込み失敗は致命的ではないので握りつぶす
      }
    };
    writeCache(updatedTasks);

    try {
      // 3. GAS（スプシ）に書き込み。レスポンスは待つが UI はすでに更新済み。
      await apiClient.post({
        action: "updateTask",
        line_id: profile.userId,
        task_id: taskId,
        is_done: isDone,
      });
    } catch (err: any) {
      // 4. 失敗したら state とキャッシュ両方をロールバックする。
      setTasks(originalTasks);
      writeCache(originalTasks);
      setError("更新に失敗しました。");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleTaskClick = (taskId: string) => {
    router.push(`/tasks/${taskId}`);
  };

  if (!isLiffReady || (loading && tasks.length === 0)) {
    return <Spinner fullScreen />;
  }

  const incompleteTasks = tasks.filter(t => !t.is_done);
  const completedTasks = tasks.filter(t => t.is_done);
  const displayTasks = activeTab === "incomplete" ? incompleteTasks : completedTasks;
  const totalCount = tasks.length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedTasks.length / totalCount) * 100);

  const weddingDateObj = weddingDate
    ? (() => { const [y, m, d] = weddingDate.split("-").map(Number); return new Date(y, m - 1, d); })()
    : null;
  const formattedWeddingDate = weddingDateObj ? formatJapaneseDate(weddingDateObj) : null;
  const daysUntil = weddingDateObj ? getDaysFromToday(weddingDateObj) : null;

  const coupleLabel = name1 && name2 ? `${name1}＆${name2}` : null;

  return (
    <div className="min-h-screen flex flex-col bg-surface-page">
      {/* === Hero Header === */}
      <header
        className="relative sticky top-0 z-20 border-b border-border"
        style={{
          background:
            "linear-gradient(160deg, #FBFAF6 0%, #F5F1EA 55%, #FAEFD2 100%)",
        }}
      >
        {/* 装飾的な水引風アクセント線（上端） */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-tertiary-50 to-transparent" />

        {isAdmin && (
          <div className="flex justify-end px-md pt-sm">
            <button
              onClick={() => router.push("/admin")}
              className="btn-tertiary-pill"
              aria-label="管理者画面を開く"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              管理者画面
            </button>
          </div>
        )}

        <div className="px-lg pt-sm pb-md text-center">
          <p className="text-label-caps text-primary-70 mb-2xs">
            WEDDING&nbsp;COMPANION
          </p>
          <h1 className="font-display text-display-md text-neutral-20 leading-tight">
            {coupleLabel || "ようこそ"}
          </h1>
          {coupleLabel && (
            <p className="text-body-sm text-neutral-50 mt-2xs">
              ふたりで進める結婚式準備
            </p>
          )}

          {daysUntil !== null && (
            <div className="mt-sm">
              {daysUntil > 0 ? (
                <div className="inline-flex items-baseline gap-1.5 px-md py-2xs bg-white/70 backdrop-blur-sm rounded-full border border-tertiary-20">
                  <span className="text-body-sm text-neutral-50">あと</span>
                  <span className="font-display text-numeric-display tabular-nums text-tertiary-70 leading-none">
                    {daysUntil}
                  </span>
                  <span className="text-body-sm text-neutral-50">日</span>
                </div>
              ) : daysUntil === 0 ? (
                <p className="font-display text-display-md text-tertiary-70">
                  今日が結婚式です
                </p>
              ) : (
                <p className="text-body-md text-neutral-50">結婚式が終わりました</p>
              )}
            </div>
          )}

          {formattedWeddingDate && (
            <p className="text-body-sm text-neutral-50 mt-2xs tabular-nums">
              {formattedWeddingDate}
            </p>
          )}

          {/* 進捗バー */}
          {totalCount > 0 && (
            <div className="mt-md mx-auto max-w-[280px]">
              <div className="flex items-center justify-between text-body-sm text-neutral-50 mb-2xs">
                <span>準備の進捗</span>
                <span className="text-primary-70 font-semibold tabular-nums">
                  {completedTasks.length} / {totalCount}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-neutral-90 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary-50 to-primary-70 transition-all duration-medium"
                  style={{ width: `${progressPercent}%` }}
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* === Tabs === */}
      <div
        role="tablist"
        className="px-lg pt-sm bg-surface flex gap-md border-b border-border sticky top-[calc(var(--header-h,168px))] z-10"
      >
        <button
          role="tab"
          aria-selected={activeTab === "incomplete"}
          onClick={() => setActiveTab("incomplete")}
          className={[
            "flex-1 pb-sm text-[15px] font-semibold transition-colors duration-short border-b-[2px]",
            activeTab === "incomplete"
              ? "border-primary-70 text-primary-70"
              : "border-transparent text-neutral-50",
          ].join(" ")}
        >
          未完了
          <span
            className={[
              "ml-1.5 inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums",
              activeTab === "incomplete"
                ? "bg-primary-10 text-primary-70"
                : "bg-neutral-95 text-neutral-50",
            ].join(" ")}
          >
            {incompleteTasks.length}
          </span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "completed"}
          onClick={() => setActiveTab("completed")}
          className={[
            "flex-1 pb-sm text-[15px] font-semibold transition-colors duration-short border-b-[2px]",
            activeTab === "completed"
              ? "border-primary-70 text-primary-70"
              : "border-transparent text-neutral-50",
          ].join(" ")}
        >
          完了済み
          <span
            className={[
              "ml-1.5 inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums",
              activeTab === "completed"
                ? "bg-primary-10 text-primary-70"
                : "bg-neutral-95 text-neutral-50",
            ].join(" ")}
          >
            {completedTasks.length}
          </span>
        </button>
      </div>

      {/* === Main === */}
      <div className="flex-1 px-md pt-md pb-3xl overflow-y-auto">
        {loading ? (
          <Spinner />
        ) : displayTasks.length > 0 ? (
          displayTasks.map((task) => (
            <TaskCard
              key={task.task_id}
              taskId={task.task_id}
              category={task.category}
              taskContent={task.task_content}
              dueFormula={task.due_formula}
              dueEstimate={task.due_estimate}
              weddingDate={weddingDate}
              memo={task.memo}
              isDone={task.is_done}
              onToggle={handleToggleTask}
              onClick={handleTaskClick}
            />
          ))
        ) : (
          <div className="py-3xl flex flex-col items-center justify-center text-center">
            {activeTab === "incomplete" ? (
              tasks.length === 0 ? (
                <>
                  <div className="w-20 h-20 bg-primary-10 rounded-full flex items-center justify-center mb-md">
                    <svg className="w-9 h-9 text-primary-70" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="font-display text-display-md text-neutral-30 mb-2xs">準備中です</p>
                  <p className="text-body-md text-neutral-50">
                    タスクがまだ登録されていません。<br />
                    担当のプランナーにご連絡ください。
                  </p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-tertiary-10 rounded-full flex items-center justify-center mb-md">
                    <svg className="w-9 h-9 text-tertiary-70" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="font-display text-display-md text-neutral-30 mb-2xs">完璧です</p>
                  <p className="text-body-md text-neutral-50">
                    すべてのタスクが完了しています。<br />
                    お疲れ様でした。
                  </p>
                </>
              )
            ) : (
              <>
                <div className="w-16 h-16 bg-neutral-95 rounded-full flex items-center justify-center mb-md">
                  <svg className="w-8 h-8 text-neutral-60" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-body-md text-neutral-50">まだ完了したタスクはありません。</p>
              </>
            )}
          </div>
        )}
      </div>

      {error && <ErrorMessage message={error} />}
    </div>
  );
}
