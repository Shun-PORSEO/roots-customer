"use client";

import { ReactNode } from "react";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div
      className="bg-white rounded-xl border overflow-hidden"
      style={{ borderColor: "#E5E7EB" }}
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
      className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-500"
      style={{ background: "#F9FAFB" }}
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
      style={{ borderColor: "#E5E7EB" }}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y" style={{}}>{children}</tbody>;
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
      className={`${onClick ? "cursor-pointer hover:bg-gray-50" : ""} ${
        highlight ? "" : ""
      }`}
      style={{
        background: highlight ? "#FFFBEB" : undefined,
      }}
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
      style={{ borderColor: "#E5E7EB" }}
    >
      {children}
    </td>
  );
}
