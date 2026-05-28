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
          style={{ color: "var(--colorText)" }}
        >
          {label}
          {required && (
            <span className="ml-1" style={{ color: "var(--colorError)" }}>
              *
            </span>
          )}
        </span>
        {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full px-3 py-2.5 text-[14px] border rounded-xl outline-none transition-colors focus:ring-2 focus:ring-[var(--colorSecondary)]";

export const inputStyle: React.CSSProperties = {
  borderColor: "var(--colorBorder)",
  color: "var(--colorText)",
  background: "white",
};
