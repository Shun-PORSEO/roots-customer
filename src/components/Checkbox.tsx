import React from "react";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onChange, disabled, label }) => {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label || (checked ? "完了済み" : "未完了")}
      data-testid="task-checkbox"
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      disabled={disabled}
      className={[
        "w-6 h-6 flex-shrink-0 rounded-xs flex items-center justify-center",
        "border transition-all duration-150",
        checked
          ? "bg-primary-70 border-primary-70 scale-100"
          : "bg-white border-neutral-60 scale-95",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-90",
      ].join(" ")}
    >
      {checked && (
        <svg
          className="w-4 h-4 text-white"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
};
