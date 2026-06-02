import React from "react";

interface SpinnerProps {
  fullScreen?: boolean;
  label?: string;
}

/**
 * Wedding-ring motif loader: two interlocking rings (sage → champagne-gold)
 * counter-rotating at slightly different speeds, with a breathing center bead.
 * Honors prefers-reduced-motion (falls back to a single gentle rotation).
 */
const Rings: React.FC = () => (
  <svg
    className="w-12 h-12"
    viewBox="0 0 48 48"
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="spinner-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#2F5A40" />
        <stop offset="55%" stopColor="#5A8E6E" />
        <stop offset="100%" stopColor="#D4A853" />
      </linearGradient>
    </defs>

    {/* faint track */}
    <circle cx="24" cy="24" r="18" stroke="#EFE8DC" strokeWidth="2.5" />
    <circle cx="24" cy="24" r="11" stroke="#F5F1EA" strokeWidth="2" />

    {/* outer ring — clockwise, sage→gold sweeping arc */}
    <g className="spinner-ring-outer">
      <circle
        className="spinner-arc"
        cx="24"
        cy="24"
        r="18"
        stroke="url(#spinner-grad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="46 200"
      />
    </g>

    {/* inner ring — counter-clockwise, champagne gold */}
    <g className="spinner-ring-inner">
      <circle
        cx="24"
        cy="24"
        r="11"
        stroke="#D4A853"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="20 200"
      />
    </g>

    {/* center bead */}
    <circle className="spinner-bead" cx="24" cy="24" r="2" fill="#D4A853" />
  </svg>
);

export const Spinner: React.FC<SpinnerProps> = ({ fullScreen, label = "読み込み中…" }) => {
  if (fullScreen) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-0 flex flex-col items-center justify-center gap-md bg-surface-page/80 backdrop-blur-[2px] z-40"
      >
        <Rings />
        <p className="spinner-label text-body-sm text-neutral-50 tracking-wide tabular-nums">{label}</p>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-md py-2xl">
      <Rings />
      <span className="spinner-label text-body-sm text-neutral-50 tracking-wide">{label}</span>
    </div>
  );
};
