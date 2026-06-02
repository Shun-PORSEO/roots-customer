"use client";

import { ReactNode } from "react";

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span
          className="text-[12px] font-bold tracking-wide"
          style={{ color: "var(--ct)" }}
        >
          {label}
          {required && (
            <span className="ml-1" style={{ color: "var(--c-error)" }}>
              *
            </span>
          )}
        </span>
        {hint && (
          <span className="text-[11px]" style={{ color: "var(--ct-muted)" }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full px-3.5 py-2.5 text-[14px] rounded-md outline-none transition-all border";

export const inputStyle: React.CSSProperties = {
  borderColor: "var(--cb-strong)",
  color: "var(--ct)",
  background: "white",
};

export const inputFocusProps = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = "var(--cp-light)";
    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(167,197,178,0.40)";
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = "var(--cb-strong)";
    e.currentTarget.style.boxShadow = "none";
  },
};
