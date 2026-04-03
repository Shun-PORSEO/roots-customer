import React, { useState } from "react";
import { Checkbox } from "./Checkbox";

interface TaskCardProps {
  taskId: string;
  title: string;
  description?: string;
  isDone: boolean;
  onToggle: (taskId: string, isDone: boolean) => void;
  onClick: (taskId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  taskId,
  title,
  description,
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
        <h3 className={`text-base font-semibold transition-colors duration-200 ${internalDone ? 'text-[var(--colorTextLight)] line-through' : 'text-[var(--colorText)]'}`}>
          {title}
        </h3>
        {description && (
          <p className="text-sm text-[var(--colorTextLight)] mt-1 line-clamp-2">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};
