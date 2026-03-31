"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ITask } from "@/lib/types";

interface TaskCardProps {
  task: ITask;
  onToggle: (task_id: string, is_done: boolean) => Promise<void>;
}

export default function TaskCard({ task, onToggle }: TaskCardProps) {
  const router = useRouter();
  const [animating, setAnimating] = useState(false);

  const handleCheckboxClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setAnimating(true);
    setTimeout(() => setAnimating(false), 150);
    await onToggle(task.task_id, !task.is_done);
  };

  const handleCardClick = () => {
    router.push(`/tasks/${task.task_id}`);
  };

  return (
    <div
      className="flex items-center gap-3 p-4 bg-white rounded-card border border-border shadow-card active:bg-[#F0EBE0] cursor-pointer transition-colors"
      onClick={handleCardClick}
      role="button"
      aria-label={`タスク: ${task.title}`}
    >
      <button
        className={`
          w-6 h-6 min-w-[24px] rounded-md border-2 flex items-center justify-center transition-all
          ${task.is_done ? "bg-primary border-primary" : "border-border bg-white"}
          ${animating ? "scale-110" : "scale-100"}
        `}
        onClick={handleCheckboxClick}
        aria-label={task.is_done ? "完了済み" : "未完了"}
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
      <span
        className={`flex-1 text-[15px] ${task.is_done ? "line-through text-text-sub" : "text-text-main"}`}
      >
        {task.title}
      </span>
      <svg
        className="w-4 h-4 text-text-sub flex-shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}
