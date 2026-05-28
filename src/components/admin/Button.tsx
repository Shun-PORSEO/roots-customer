"use client";

import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  const sizeCls =
    size === "sm" ? "px-3 py-1.5 text-[12px]" : "px-4 py-2.5 text-[13px]";

  const base =
    "font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5";

  let style: React.CSSProperties = {};
  let variantCls = "";

  if (variant === "primary") {
    style = { background: "var(--colorPrimary)", color: "white" };
    variantCls = "hover:opacity-90";
  } else if (variant === "secondary") {
    style = {
      background: "var(--colorSecondary)",
      color: "var(--colorPrimary)",
    };
    variantCls = "hover:opacity-80";
  } else if (variant === "ghost") {
    style = { color: "var(--colorTextLight)" };
    variantCls = "hover:bg-gray-100";
  } else if (variant === "danger") {
    style = { background: "var(--colorError)", color: "white" };
    variantCls = "hover:opacity-90";
  }

  return (
    <button
      className={`${base} ${sizeCls} ${variantCls} ${className}`}
      style={style}
      {...rest}
    />
  );
}
