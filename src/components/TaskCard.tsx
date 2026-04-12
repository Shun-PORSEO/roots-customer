import React, { useState } from "react";
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
  const [internalDone, setInternalDone] = useState(isDone);

  const handleToggle = (checked: boolean) => {
    setInternalDone(checked);
    onToggle(taskId, checked);
  };

  // 挙式日から具体的な期限日を計算
  const dueDate = weddingDate ? parseDueDate(dueFormula, weddingDate) : null;
  const dueDateLabel = dueDate ? formatJapaneseDate(dueDate) : dueEstimate;
  const daysLeft = dueDate ? getDaysFromToday(dueDate) : null;

  const dueBadgeColor =
    daysLeft === null
      ? "text-[var(--colorPrimary)]"
      : daysLeft < 0
      ? "text-[var(--colorError)]"
      : daysLeft <= 7
      ? "text-orange-500"
      : "text-[var(--colorPrimary)]";

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
      className="bg-white p-4 rounded-xl border border-[var(--colorBorder)] shadow-sm active:bg-[#F0EBE0] cursor-pointer transition-colors duration-200 mb-3 flex items-start gap-3 w-full"
      role="button"
    >
      <div className="pt-0.5">
        <Checkbox checked={internalDone} onChange={handleToggle} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-bold text-[var(--colorPrimary)] bg-[var(--colorSecondary)] px-2 py-0.5 rounded mr-2 uppercase tracking-wider mb-1 inline-block">
          {category}
        </span>
        <h3 className={`text-[15px] leading-snug font-semibold mt-1 transition-colors duration-200 ${internalDone ? "text-[var(--colorTextLight)] line-through" : "text-[var(--colorText)]"}`}>
          {taskContent}
        </h3>
        <div className={`flex items-baseline gap-1.5 mt-1 ${dueBadgeColor}`}>
          <span className="text-[13px] font-medium">{dueDateLabel}</span>
          {daysLeftLabel && (
            <span className="text-[11px] font-bold">（{daysLeftLabel}）</span>
          )}
        </div>
        {memo && (
          <p className="text-xs text-[var(--colorTextLight)] mt-2 bg-gray-50 p-2 rounded line-clamp-2">
            🗒 {memo}
          </p>
        )}
      </div>
    </div>
  );
};
