import React from "react";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onChange, disabled }) => {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      data-testid="task-checkbox"
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) {
          onChange(!checked);
        }
      }}
      disabled={disabled}
      className={`
        w-6 h-6 flex-shrink-0 rounded border flex items-center justify-center transition-all duration-150
        ${checked 
          ? "bg-[var(--colorPrimary)] border-[var(--colorPrimary)] scale-100" 
          : "bg-white border-[#ccc] scale-95"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-90"}
      `}
    >
      {checked && (
        <svg
          className="w-4 h-4 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
};
