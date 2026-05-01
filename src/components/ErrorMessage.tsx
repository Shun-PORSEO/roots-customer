import React from "react";
import { ApiError } from "@/lib/api";

interface ErrorMessageProps {
  message: string;
  /** 任意。ApiError から渡される複数行の対処手順。改行で箇条書き表示する。 */
  solution?: string;
}

/**
 * トースト風の即時通知。message のみ渡す既存呼び出しと互換。
 * solution を渡すと「対処法」セクションが続けて表示される。
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, solution }) => {
  return (
    <div role="alert" aria-live="assertive" className="toast animate-slide-up">
      <div className="flex items-start gap-xs">
        <svg
          className="w-4 h-4 text-error shrink-0 mt-0.5"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zM10 5a1 1 0 011 1v4a1 1 0 11-2 0V6a1 1 0 011-1zm0 8a1 1 0 100 2 1 1 0 000-2z"
            clipRule="evenodd"
          />
        </svg>
        <div className="flex flex-col gap-2xs min-w-0">
          <span className="text-body-md text-white font-medium break-words">{message}</span>
          {solution && (
            <div className="text-body-sm text-white/90 whitespace-pre-line">
              <div className="font-semibold mb-2xs">対処法</div>
              {solution}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * 「症状 + 対処法」をフォーム内インラインで表示する用。
 * ApiError なら solution も自動で展開する。
 */
export const InlineApiError: React.FC<{ error: unknown }> = ({ error }) => {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  const solution = error instanceof ApiError ? error.solution : undefined;

  return (
    <div role="alert" className="border border-error/40 bg-error/5 rounded-md p-md flex flex-col gap-2xs">
      <div className="flex items-start gap-xs">
        <svg className="w-4 h-4 text-error shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zM10 5a1 1 0 011 1v4a1 1 0 11-2 0V6a1 1 0 011-1zm0 8a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
        </svg>
        <p className="text-error text-body-md font-semibold break-words">{message}</p>
      </div>
      {solution && (
        <div className="text-body-sm text-on-surface/80 whitespace-pre-line pl-6">
          <div className="font-semibold mb-2xs">対処法</div>
          {solution}
        </div>
      )}
    </div>
  );
};
