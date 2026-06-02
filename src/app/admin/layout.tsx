"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthGate } from "@/components/admin/AuthGate";

const NAV = [
  { href: "/admin",          label: "お客様",      icon: "💍" },
  { href: "/admin/venues",   label: "式場",        icon: "🏛" },
  { href: "/admin/tasks",    label: "タスク雛形",  icon: "📋" },
  { href: "/admin/messages", label: "配信ログ",    icon: "💬" },
  { href: "/admin/help",     label: "使い方",      icon: "📖" },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") {
    if (pathname === "/admin") return true;
    return !NAV.slice(1).some((n) => pathname.startsWith(n.href));
  }
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/admin";

  return (
    <div
      className="admin-shell min-h-screen flex"
      style={{ background: "var(--cs-page)" }}
    >
      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden md:flex md:flex-col w-[220px] shrink-0"
        style={{
          background: "white",
          borderRight: "1px solid var(--cb)",
        }}
      >
        {/* Logo */}
        <div
          className="px-5 py-5 shrink-0"
          style={{ borderBottom: "1px solid var(--cb)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-[15px] shrink-0"
              style={{
                background: "linear-gradient(135deg, var(--cp), var(--ca))",
                boxShadow: "0 2px 8px rgba(47,90,64,0.30)",
              }}
            >
              R
            </div>
            <div className="leading-tight min-w-0">
              <p
                className="text-[9px] tracking-[0.22em] font-bold uppercase"
                style={{ color: "var(--cp)" }}
              >
                Roots AI
              </p>
              <p
                className="text-[13px] font-bold truncate"
                style={{ color: "var(--ct)" }}
              >
                Planner
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          <ul className="flex flex-col gap-0.5">
            {NAV.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    className="relative flex items-center gap-2.5 px-3 py-2.5 text-[13px] rounded-lg transition-all"
                    style={
                      active
                        ? {
                            background: "var(--cp-muted)",
                            color: "var(--cp)",
                            fontWeight: 700,
                          }
                        : {
                            color: "var(--ct-muted)",
                            fontWeight: 500,
                          }
                    }
                    onMouseEnter={(e) => {
                      if (!active)
                        (e.currentTarget as HTMLElement).style.background =
                          "var(--cs-page)";
                    }}
                    onMouseLeave={(e) => {
                      if (!active)
                        (e.currentTarget as HTMLElement).style.background =
                          "transparent";
                    }}
                  >
                    {active && (
                      <span
                        className="absolute left-2 w-1 h-5 rounded-full"
                        style={{ background: "var(--cp)" }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-base leading-none w-4 text-center shrink-0">
                      {n.icon}
                    </span>
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div
          className="px-5 py-3 text-[11px] shrink-0"
          style={{
            borderTop: "1px solid var(--cb)",
            color: "var(--ct-muted)",
          }}
        >
          v1 · 内部管理ツール
        </div>
      </aside>

      {/* ── Mobile top nav ── */}
      <header
        className="md:hidden fixed top-0 inset-x-0 z-30"
        style={{
          background: "white",
          borderBottom: "1px solid var(--cb)",
          boxShadow: "0 1px 4px rgba(26,24,21,0.06)",
        }}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-[12px]"
              style={{
                background: "linear-gradient(135deg, var(--cp), var(--ca))",
              }}
            >
              R
            </div>
            <p
              className="font-bold text-[13px]"
              style={{ color: "var(--ct)" }}
            >
              Roots AI Planner
            </p>
          </div>
        </div>

        <nav className="px-2 overflow-x-auto">
          <ul className="flex gap-0.5 -mb-px">
            {NAV.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <li key={n.href} className="shrink-0">
                  <Link
                    href={n.href}
                    className="inline-flex items-center gap-1 px-3 py-2.5 text-[12px] font-semibold border-b-2 transition-colors"
                    style={
                      active
                        ? {
                            borderColor: "var(--cp)",
                            color: "var(--cp)",
                          }
                        : {
                            borderColor: "transparent",
                            color: "var(--ct-muted)",
                          }
                    }
                  >
                    <span>{n.icon}</span>
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 pt-[88px] md:pt-0">
        <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-6 md:py-8">
          <AuthGate>{children}</AuthGate>
        </div>
      </div>
    </div>
  );
}
