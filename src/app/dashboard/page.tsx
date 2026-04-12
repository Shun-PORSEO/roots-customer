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

    // 1. Fast Path: Read from LocalStorage cache
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

    // 2. Background Revalidation: Fetch from GAS
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

    const originalTasks = [...tasks];
    setTasks(prev => prev.map(t => t.task_id === taskId ? { ...t, is_done: isDone } : t));

    try {
      await apiClient.post({
        action: "updateTask",
        line_id: profile.userId,
        task_id: taskId,
        is_done: isDone,
      });
    } catch (err: any) {
      setTasks(originalTasks);
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

  // ヘッダー用の日付・カウントダウン計算
  const weddingDateObj = weddingDate
    ? (() => { const [y, m, d] = weddingDate.split("-").map(Number); return new Date(y, m - 1, d); })()
    : null;
  const formattedWeddingDate = weddingDateObj ? formatJapaneseDate(weddingDateObj) : null;
  const daysUntil = weddingDateObj ? getDaysFromToday(weddingDateObj) : null;

  const coupleLabel = name1 && name2 ? `${name1}＆${name2}` : null;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--colorBg)]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[var(--colorBorder)]"
        style={{ background: "linear-gradient(135deg, #F9EDE8 0%, #FDF8F0 60%, #F5F0E8 100%)" }}
      >
        {isAdmin && (
          <div className="flex justify-end px-4 pt-2">
            <button
              onClick={() => router.push("/admin")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--colorPrimary)] text-white text-[11px] font-bold rounded-full shadow-sm hover:opacity-90 active:scale-95 transition-all"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              管理者画面
            </button>
          </div>
        )}
        <div className="px-5 py-4 text-center">
          <p className="text-[10px] font-bold tracking-[0.25em] text-[var(--colorPrimary)] uppercase mb-1">
            Wedding Planner
          </p>
          <h1 className="text-[17px] font-bold text-[var(--colorText)] leading-tight">
            {coupleLabel ? `${coupleLabel}ペア` : "ウェディングプランナー"}
          </h1>
          {coupleLabel && (
            <p className="text-[12px] text-[var(--colorTextLight)] mt-0.5">結婚式までにやる事リスト</p>
          )}
          {daysUntil !== null && (
            <div className="mt-2 flex items-baseline justify-center gap-1">
              {daysUntil > 0 ? (
                <>
                  <span className="text-[13px] text-[var(--colorTextLight)]">結婚式まで あと</span>
                  <span className="text-[32px] font-bold leading-none" style={{ color: "var(--colorAccent)" }}>
                    {daysUntil}
                  </span>
                  <span className="text-[13px] text-[var(--colorTextLight)]">日</span>
                </>
              ) : daysUntil === 0 ? (
                <span className="text-[18px] font-bold" style={{ color: "var(--colorAccent)" }}>
                  今日が結婚式です！
                </span>
              ) : (
                <span className="text-[13px] text-[var(--colorTextLight)]">結婚式が終わりました</span>
              )}
            </div>
          )}
          {formattedWeddingDate && (
            <p className="text-[12px] text-[var(--colorTextLight)] mt-0.5">{formattedWeddingDate}</p>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="px-4 pt-4 pb-2 bg-white flex border-b border-[var(--colorBorder)] sticky top-[calc(var(--header-h,88px))] z-10" role="tablist">
        <button
          role="tab"
          onClick={() => setActiveTab("incomplete")}
          className={`flex-1 pb-3 text-[15px] font-semibold transition-colors duration-200 border-b-[3px] ${
            activeTab === "incomplete"
              ? "border-[var(--colorPrimary)] text-[var(--colorPrimary)]"
              : "border-transparent text-[var(--colorTextLight)]"
          }`}
        >
          未完了 ({incompleteTasks.length})
        </button>
        <button
          role="tab"
          onClick={() => setActiveTab("completed")}
          className={`flex-1 pb-3 text-[15px] font-semibold transition-colors duration-200 border-b-[3px] ${
            activeTab === "completed"
              ? "border-[var(--colorPrimary)] text-[var(--colorPrimary)]"
              : "border-transparent text-[var(--colorTextLight)]"
          }`}
        >
          完了済み ({completedTasks.length})
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-4 py-4 overflow-y-auto">
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
          <div className="py-12 flex flex-col items-center justify-center text-center">
            {activeTab === "incomplete" ? (
              tasks.length === 0 ? (
                <>
                  <div className="w-16 h-16 bg-[var(--colorSecondary)] rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-[var(--colorPrimary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  </div>
                  <p className="text-[var(--colorTextLight)] font-medium">タスクがまだ登録されていません。<br/>プランナーにご連絡ください。</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-[#ebf7eb] rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-[var(--colorSuccess)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p className="text-[var(--colorTextLight)] font-medium">すべてのタスクが完了しています！<br/>お疲れ様でした。</p>
                </>
              )
            ) : (
              <p className="text-[var(--colorTextLight)] font-medium">完了済みのタスクはありません。</p>
            )}
          </div>
        )}
      </div>

      {error && <ErrorMessage message={error} />}
    </div>
  );
}
