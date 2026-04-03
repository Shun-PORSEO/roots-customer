"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { getLineId } from "@/lib/liff";
import { getTasks, updateTask } from "@/lib/api";
import type { ITask } from "@/lib/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import Toast from "@/components/Toast";

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.task_id as string;

  const [task, setTask] = useState<ITask | null>(null);
  const [lineId, setLineId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const id = await getLineId();
        setLineId(id);
        const data = await getTasks(id);
        const found = (data.tasks ?? []).find((t) => t.task_id === taskId);
        if (!found) {
          setError("タスクが見つかりませんでした");
        } else {
          setTask(found);
        }
      } catch (err) {
        console.error(err);
        setError("通信エラーが発生しました。もう一度お試しください");
      } finally {
        setLoading(false);
      }
    })();
  }, [taskId]);

  const handleToggle = async () => {
    if (!task || !lineId) return;
    const newDone = !task.is_done;
    setAnimating(true);
    setTimeout(() => setAnimating(false), 150);
    setTask({ ...task, is_done: newDone });
    try {
      await updateTask(lineId, task.task_id, newDone);
    } catch (err) {
      console.error(err);
      setTask({ ...task, is_done: !newDone });
      setToastMessage("通信エラーが発生しました。もう一度お試しください");
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!task) return null;

  return (
    <div className="flex flex-col min-h-screen bg-bg animate-fade-in">
      {/* Header */}
      <header className="bg-white border-b border-border px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-primary"
          aria-label="戻る"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-[17px] font-semibold text-text-main flex-1 truncate">
          タスク詳細
        </h1>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6 space-y-6 safe-bottom">
        {/* Title + Checkbox */}
        <div className="flex items-start gap-3">
          <button
            className={`
              w-6 h-6 min-w-[24px] mt-0.5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0
              ${task.is_done ? "bg-primary border-primary" : "border-border bg-white"}
              ${animating ? "scale-110" : "scale-100"}
            `}
            onClick={handleToggle}
            aria-label={task.is_done ? "完了済みにする" : "未完了にする"}
            style={{ transition: "transform 150ms ease" }}
          >
            {task.is_done && (
              <svg
                className="w-3.5 h-3.5 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <h2
            className={`text-[20px] font-bold leading-snug ${
              task.is_done ? "line-through text-text-sub" : "text-text-main"
            }`}
          >
            {task.title}
          </h2>
        </div>

        {/* Description */}
        <div className="bg-white rounded-card border border-border shadow-card p-4">
          <p className="text-[15px] text-text-main whitespace-pre-wrap">{task.description}</p>
        </div>

        {/* Due info */}
        {task.due_offset_days > 0 && (
          <p className="text-[13px] text-text-sub">
            式当日の <span className="text-accent font-semibold">{task.due_offset_days}日前</span> が目安です
          </p>
        )}

        {/* Manual URL */}
        {task.manual_url && (
          <a
            href={task.manual_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full min-h-[44px] border-2 border-primary text-primary font-semibold text-[15px] rounded-card py-3 active:opacity-80 transition"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            マニュアルを見る
          </a>
        )}

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="w-full min-h-[44px] bg-secondary text-text-main font-semibold text-[15px] rounded-card py-3 active:opacity-80 transition"
        >
          戻る
        </button>
      </main>

      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
    </div>
  );
}
