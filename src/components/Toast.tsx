"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  onClose: () => void;
}

export default function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 bg-text-main text-white text-sm rounded-card shadow-card animate-slide-up max-w-[360px] w-[90vw] text-center"
      role="alert"
    >
      {message}
    </div>
  );
}
