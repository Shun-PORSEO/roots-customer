import React, { useState } from "react";
import { Checkbox } from "./Checkbox";

interface TaskCardProps {
  taskId: string;
  category: string;
  taskContent: string;
  dueEstimate: string;
  memo: string;
  isDone: boolean;
  onToggle: (taskId: string, isDone: boolean) => void;
  onClick: (taskId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  taskId,
  category,
  taskContent,
  dueEstimate,
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
      <div className="flex-1">
        <span className="text-xs font-bold text-[var(--colorPrimary)] bg-[var(--colorSecondary)] px-2 py-0.5 rounded mr-2 uppercase tracking-wider mb-1 inline-block">
          {category}
        </span>
        <h3 className={`text-[15px] leading-snug font-semibold mt-1 transition-colors duration-200 ${internalDone ? 'text-[var(--colorTextLight)] line-through' : 'text-[var(--colorText)]'}`}>
          {taskContent}
        </h3>
        <p className="text-[13px] text-[var(--colorPrimary)] font-medium mt-1">
          期限目安: {dueEstimate}
        </p>
        {memo && (
          <p className="text-xs text-[var(--colorTextLight)] mt-2 bg-gray-50 p-2 rounded line-clamp-2">
            🗒 {memo}
          </p>
        )}
      </div>
    </div>
  );
};
