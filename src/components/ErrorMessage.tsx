import React from "react";

interface ErrorMessageProps {
  message: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-11/12 max-w-[400px] z-50">
      <div className="bg-[var(--colorError)] text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-center animate-[slideUp_0.2s_ease-out]">
        <span className="text-sm font-semibold">{message}</span>
      </div>
    </div>
  );
};
