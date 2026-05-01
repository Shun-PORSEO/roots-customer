import React from "react";
import { Checkbox } from "./Checkbox";
import { parseDueDate, formatJapaneseDate, getDaysFromToday } from "@/lib/utils";

interface TaskCardProps {
  taskId: string;
  category: string;
  taskContent: string;
  dueFormula: string;
  dueEstimate: string;
  weddingDate: string | null;
  memo: string;
  isDone: boolean;
  onToggle: (taskId: string, isDone: boolean) => void;
  onClick: (taskId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  taskId,
  category,
  taskContent,
  dueFormula,
  dueEstimate,
  weddingDate,
  memo,
  isDone,
  onToggle,
  onClick,
}) => {
  const handleToggle = (checked: boolean) => {
    onToggle(taskId, checked);
  };

  const dueDate = weddingDate ? parseDueDate(dueFormula, weddingDate) : null;
  const dueDateLabel = dueDate ? formatJapaneseDate(dueDate) : dueEstimate;
  const daysLeft = dueDate ? getDaysFromToday(dueDate) : null;

  // 期限のステータス: overdue / soon (≤7) / normal
  const dueState =
    daysLeft === null ? "normal" : daysLeft < 0 ? "overdue" : daysLeft <= 7 ? "soon" : "normal";

  const dueColor =
    dueState === "overdue"
      ? "text-error"
      : dueState === "soon"
      ? "text-warning"
      : "text-primary-70";

  const daysLeftLabel =
    daysLeft === null
      ? null
      : daysLeft > 0
      ? `あと${daysLeft}日`
      : daysLeft === 0
      ? "今日まで"
      : `${Math.abs(daysLeft)}日超過`;

  return (
    <div
      onClick={() => onClick(taskId)}
      data-testid="task-card"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick(taskId);
      }}
      className={[
        "card-base mb-sm w-full p-md flex items-start gap-sm cursor-pointer",
        "transition-colors duration-short",
        isDone ? "bg-neutral-98" : "bg-white active:bg-primary-5",
      ].join(" ")}
    >
      <div className="pt-0.5">
        <Checkbox checked={isDone} onChange={handleToggle} label={taskContent} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="chip-category mb-xs">{category}</span>
        <h3
          className={[
            "text-headline-sm mt-1 transition-colors duration-short",
            isDone ? "text-neutral-50 line-through" : "text-on-surface",
          ].join(" ")}
        >
          {taskContent}
        </h3>
        <div className={`flex items-baseline gap-1.5 mt-xs ${dueColor}`}>
          <svg className="w-3.5 h-3.5 self-center shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-body-md font-medium">{dueDateLabel}</span>
          {daysLeftLabel && <span className="text-body-sm font-bold">（{daysLeftLabel}）</span>}
        </div>
        {memo && (
          <p className="text-body-sm text-neutral-50 mt-sm bg-neutral-98 border border-border px-sm py-2xs rounded-sm line-clamp-2">
            🗒 {memo}
          </p>
        )}
      </div>
      <svg
        className="w-4 h-4 text-neutral-60 shrink-0 self-center"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
};
