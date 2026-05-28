"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiff } from "@/hooks/useLiff";
import { apiClient } from "@/lib/api";
import { ITask } from "@/lib/types";
import { Spinner } from "@/components/Spinner";
import { Checkbox } from "@/components/Checkbox";
import { ErrorMessage } from "@/components/ErrorMessage";

export default function TaskDetailPage({ params }: { params: { task_id: string } }) {
  const { isLiffReady, profile } = useLiff();
  const router = useRouter();
  
  const [task, setTask] = useState<ITask | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTask = async () => {
      if (!profile) return;
      
      const cacheKey = `roots_dashboard_${profile.userId}`;
      const cachedData = localStorage.getItem(cacheKey);
      let parsedCache: any = null;
      if (cachedData) {
        try {
          parsedCache = JSON.parse(cachedData);
          const found = parsedCache?.tasks?.find((t: ITask) => t.task_id === params.task_id);
          if (found) {
            setTask(found);
            setLoading(false); // Instantly dismiss
          }
        } catch (e) {}
      }

      try {
        const res = await apiClient.get("getTasks", profile.userId);
        const found = res.tasks?.find((t) => t.task_id === params.task_id);
        if (found) {
          setTask(found);
          // Also update the global cache so it's fresh for dashboard
          localStorage.setItem(cacheKey, JSON.stringify({ 
            tasks: res.tasks, 
            weddingDate: parsedCache?.weddingDate || "" 
          }));
        } else if (!cachedData) {
          setError("タスクが見つかりませんでした。");
        }
      } catch (err: any) {
        if (!cachedData) setError("タスクの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };
    if (isLiffReady && profile) {
      fetchTask();
    }
  }, [isLiffReady, profile, params.task_id]);

  const handleToggle = async (isDone: boolean) => {
    if (!profile || !task) return;
    
    // Optimistic UI
    setTask({ ...task, is_done: isDone });
    setUpdating(true);
    
    try {
      await apiClient.post({
        action: "updateTask",
        line_id: profile.userId,
        task_id: task.task_id,
        is_done: isDone,
      });
    } catch (err: any) {
      setTask({ ...task, is_done: !isDone }); // Revert
      setError("更新に失敗しました。");
      setTimeout(() => setError(null), 3000);
    } finally {
      setUpdating(false);
    }
  };

  if (!isLiffReady || loading) {
    return <Spinner fullScreen />;
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[var(--colorBg)]">
        <p className="text-[var(--colorError)] mb-6 font-semibold">{error || "エラーが発生しました"}</p>
        <button onClick={() => router.push("/dashboard")} className="px-6 py-3 bg-white text-[var(--colorText)] font-semibold rounded-lg shadow-sm w-full border border-[var(--colorBorder)] active:bg-gray-50">
          ダッシュボードに戻る
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--colorBg)] flex flex-col">
      {/* Navigation Header */}
      <header className="bg-white px-4 py-4 border-b border-[var(--colorBorder)] sticky top-0 flex items-center gap-3">
        <button 
          onClick={() => router.push("/dashboard")}
          className="p-2 -ml-2 text-[var(--colorTextLight)] hover:bg-[#f0f0f0] rounded-full active:bg-[#e0e0e0] transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="font-semibold text-[var(--colorText)] text-lg">タスク詳細</span>
      </header>

      {/* Content */}
      <main className="flex-1 p-6 flex flex-col gap-6">
        <div className="bg-white p-6 rounded-2xl border border-[var(--colorBorder)] shadow-sm flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <div className="pt-1">
              <Checkbox 
                checked={task.is_done} 
                onChange={handleToggle} 
                disabled={updating}
              />
            </div>
            <div>
              <h1 className={`text-[20px] font-bold leading-tight mb-2 ${task.is_done ? 'text-[var(--colorTextLight)] line-through' : 'text-[var(--colorText)]'}`}>
                <span className="text-sm font-bold text-[var(--colorPrimary)] bg-[var(--colorSecondary)] px-2 py-0.5 rounded mr-2 uppercase tracking-wider inline-block mb-1 align-middle">
                  {task.category}
                </span>
                <br/>
                {task.task_content}
              </h1>
              <p className="text-[14px] text-[var(--colorPrimary)] font-semibold mt-2">
                ⏳ 期限目安: {task.due_estimate}
              </p>
            </div>
          </div>

          <div className="h-[1px] bg-[var(--colorBorder)] w-full"></div>

          <div>
            <h2 className="text-[13px] text-[var(--colorTextLight)] mb-2 font-semibold uppercase tracking-wider">メモ / 詳細</h2>
            <p className="text-[15px] leading-relaxed text-[var(--colorText)] whitespace-pre-wrap bg-gray-50 p-4 rounded-xl border border-gray-100 min-h-[4rem]">
              {task.memo || "特になし"}
            </p>
          </div>



        </div>
      </main>

      {error && <ErrorMessage message={error} />}
    </div>
  );
}
