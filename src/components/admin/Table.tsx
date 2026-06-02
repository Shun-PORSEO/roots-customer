"use client";

import { ReactNode } from "react";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div
      className="bg-white rounded-xl overflow-hidden"
      style={{
        border: "1px solid var(--cb)",
        boxShadow: "0 1px 2px rgba(26,24,21,0.04), 0 4px 12px rgba(26,24,21,0.04)",
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">{children}</table>
      </div>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead
      className="text-left text-[11px] font-bold uppercase tracking-wider"
      style={{ background: "var(--cs-page)", color: "var(--ct-muted)" }}
    >
      {children}
    </thead>
  );
}

export function TH({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 font-semibold border-b ${className}`}
      style={{ borderColor: "var(--cb)" }}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return (
    <tbody
      className="divide-y"
      style={{ borderColor: "var(--cb)" }}
    >
      {children}
    </tbody>
  );
}

export function TR({
  children,
  onClick,
  highlight,
}: {
  children: ReactNode;
  onClick?: () => void;
  highlight?: boolean;
}) {
  return (
    <tr
      onClick={onClick}
      className={onClick ? "cursor-pointer transition-colors" : ""}
      style={{
        background: highlight ? "var(--ca-light)" : undefined,
      }}
      onMouseEnter={
        onClick
          ? (e) => {
              if (!highlight)
                (e.currentTarget as HTMLElement).style.background =
                  "var(--cs-page)";
            }
          : undefined
      }
      onMouseLeave={
        onClick
          ? (e) => {
              (e.currentTarget as HTMLElement).style.background = highlight
                ? "var(--ca-light)"
                : "";
            }
          : undefined
      }
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  className = "",
  mono,
}: {
  children?: ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <td
      className={`px-4 py-3 align-middle ${
        mono ? "font-mono text-[12px]" : ""
      } ${className}`}
      style={{ color: "var(--ct)" }}
    >
      {children}
    </td>
  );
}
