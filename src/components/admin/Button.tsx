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
  const base =
    "font-semibold rounded-md transition-all active:scale-[0.98] " +
    "disabled:opacity-50 disabled:cursor-not-allowed " +
    "inline-flex items-center justify-center gap-1.5";

  const sizeCls =
    size === "sm"
      ? "px-3 py-1.5 text-[13px]"
      : "px-5 py-2.5 text-[14px]";

  let variantCls = "";
  let style: React.CSSProperties = {};

  if (variant === "primary") {
    variantCls = "text-white hover:opacity-90";
    style = {
      background: "var(--cp)",
      boxShadow: "0 1px 3px rgba(47,90,64,0.22)",
    };
  } else if (variant === "secondary") {
    variantCls = "border hover:opacity-90";
    style = {
      background: "var(--cp-muted)",
      color: "var(--cp)",
      borderColor: "var(--cp-light)",
    };
  } else if (variant === "ghost") {
    variantCls = "hover:bg-neutral-95";
    style = { color: "var(--ct-muted)" };
  } else if (variant === "danger") {
    variantCls = "text-white hover:opacity-90";
    style = {
      background: "var(--c-error)",
      boxShadow: "0 1px 3px rgba(181,64,47,0.22)",
    };
  }

  return (
    <button
      className={`${base} ${sizeCls} ${variantCls} ${className}`}
      style={style}
      {...rest}
    />
  );
}
