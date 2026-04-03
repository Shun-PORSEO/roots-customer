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
      try {
        const res = await apiClient.get("getTasks", profile.userId);
        const found = res.tasks?.find((t) => t.task_id === params.task_id);
        if (found) {
          setTask(found);
        } else {
          setError("タスクが見つかりませんでした。");
        }
      } catch (err: any) {
        setError("タスクの取得に失敗しました。");
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
                {task.title}
              </h1>
              <p className="text-[14px] text-[var(--colorPrimary)] font-semibold">
                期日目安: 式当日の {task.due_offset_days} 日前
              </p>
            </div>
          </div>

          <div className="h-[1px] bg-[var(--colorBorder)] w-full"></div>

          <div>
            <h2 className="text-[13px] text-[var(--colorTextLight)] mb-2 font-semibold uppercase tracking-wider">タスクの説明</h2>
            <p className="text-[15px] leading-relaxed text-[var(--colorText)] whitespace-pre-wrap">
              {task.description}
            </p>
          </div>

          {task.manual_url && (
            <div className="pt-2 pb-1">
              <a 
                href={task.manual_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-[var(--colorSecondary)] text-[var(--colorPrimary)] font-bold rounded-xl active:bg-[#EBE4D5] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                マニュアルを見る
              </a>
            </div>
          )}
        </div>
      </main>

      {error && <ErrorMessage message={error} />}
    </div>
  );
}
