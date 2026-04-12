"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLiff } from "@/hooks/useLiff";
import { apiClient } from "@/lib/api";
import { ITask } from "@/lib/types";
import { TaskCard } from "@/components/TaskCard";
import { Spinner } from "@/components/Spinner";
import { ErrorMessage } from "@/components/ErrorMessage";

export default function DashboardPage() {
  const { isLiffReady, profile } = useLiff();
  const router = useRouter();
  
  const [tasks, setTasks] = useState<ITask[]>([]);
  const [weddingDate, setWeddingDate] = useState<string | null>(null);
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
        setLoading(false); // Instantly dismiss loading screen
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
      
      setTasks(newTasks);
      setWeddingDate(newWeddingDate);
      setError(null);
      
      // Update Cache
      localStorage.setItem(cacheKey, JSON.stringify({ tasks: newTasks, weddingDate: newWeddingDate }));
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
    
    // Optimistic UI handled within TaskCard partially, but we update our main list here.
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
      // Revert on error
      setTasks(originalTasks);
      setError("更新に失敗しました。");
      // Auto dismiss error
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

  return (
    <div className="min-h-screen flex flex-col bg-[var(--colorBg)]">
      {/* Header */}
      <header className="bg-white px-4 py-6 border-b border-[var(--colorBorder)] sticky top-0 z-10">
        <h1 className="text-xl font-bold text-[var(--colorText)]">
          挙式日: {weddingDate ? weddingDate : "取得中"} のダッシュボード
        </h1>
      </header>

      {/* Tabs */}
      <div className="px-4 pt-4 pb-2 bg-white flex border-b border-[var(--colorBorder)] sticky top-[77px] z-10" role="tablist">
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
              dueEstimate={task.due_estimate}
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
