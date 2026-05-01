import React from "react";

interface SpinnerProps {
  fullScreen?: boolean;
  label?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ fullScreen, label = "読み込み中…" }) => {
  const dot = (
    <svg
      className="w-9 h-9 text-primary-70 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.18" strokeWidth="3" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );

  if (fullScreen) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-0 flex flex-col items-center justify-center gap-sm bg-surface-page/80 backdrop-blur-[2px] z-40"
      >
        {dot}
        <p className="text-body-sm text-neutral-50 tabular-nums">{label}</p>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-sm py-2xl">
      {dot}
      <span className="text-body-sm text-neutral-50">{label}</span>
    </div>
  );
};
