import React from "react";

interface SpinnerProps {
  fullScreen?: boolean;
}

export const Spinner: React.FC<SpinnerProps> = ({ fullScreen }) => {
  const spinnerContent = (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="w-8 h-8 border-4 border-[var(--colorSecondary)] border-t-[var(--colorPrimary)] rounded-full animate-spin"></div>
      <p className="text-[var(--colorPrimary)] font-semibold text-sm">読み込み中...</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 z-50 flex items-center justify-center">
        {spinnerContent}
      </div>
    );
  }

  return <div className="py-8">{spinnerContent}</div>;
};
