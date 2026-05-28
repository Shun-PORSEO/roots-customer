"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthGate } from "@/components/admin/AuthGate";

const NAV = [
  { href: "/admin", label: "お客様", icon: "💍" },
  { href: "/admin/venues", label: "式場", icon: "🏛" },
  { href: "/admin/tasks", label: "タスク雛形", icon: "📋" },
  { href: "/admin/messages", label: "配信ログ", icon: "💬" },
  { href: "/admin/help", label: "使い方", icon: "📖" },
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
    <div className="admin-shell min-h-screen flex" style={{ background: "#F5F6F8" }}>
      {/* Sidebar */}
      <aside
        className="hidden md:flex md:flex-col w-[220px] shrink-0 bg-white border-r"
        style={{ borderColor: "#E5E7EB" }}
      >
        <div className="px-5 py-5 border-b" style={{ borderColor: "#E5E7EB" }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{
                background:
                  "linear-gradient(135deg, var(--colorPrimary), var(--colorAccent))",
              }}
            >
              R
            </div>
            <div className="leading-tight">
              <p
                className="text-[9px] tracking-[0.2em] font-bold uppercase"
                style={{ color: "var(--colorPrimary)" }}
              >
                Roots AI
              </p>
              <p className="text-[12px] font-semibold text-gray-600">
                Planner
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3">
          <ul className="flex flex-col gap-0.5">
            {NAV.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    className={`flex items-center gap-2.5 px-3 py-2 text-[13px] rounded-lg transition-colors ${
                      active
                        ? "font-bold"
                        : "text-gray-600 hover:bg-gray-50 font-medium"
                    }`}
                    style={
                      active
                        ? {
                            background: "var(--colorSecondary)",
                            color: "var(--colorPrimary)",
                          }
                        : undefined
                    }
                  >
                    <span className="text-base leading-none w-4 text-center">
                      {n.icon}
                    </span>
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div
          className="px-5 py-3 border-t text-[11px] text-gray-400"
          style={{ borderColor: "#E5E7EB" }}
        >
          v1 · 内部管理ツール
        </div>
      </aside>

      {/* Mobile top nav */}
      <header
        className="md:hidden fixed top-0 inset-x-0 z-30 bg-white border-b"
        style={{ borderColor: "#E5E7EB" }}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <p className="font-bold text-sm" style={{ color: "var(--colorPrimary)" }}>
            Roots AI Planner
          </p>
        </div>
        <nav className="px-2 overflow-x-auto">
          <ul className="flex gap-1 -mb-px">
            {NAV.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <li key={n.href} className="shrink-0">
                  <Link
                    href={n.href}
                    className={`inline-flex items-center gap-1 px-3 py-2 text-[12px] font-semibold border-b-2 ${
                      active
                        ? "border-current"
                        : "border-transparent text-gray-500"
                    }`}
                    style={
                      active ? { color: "var(--colorPrimary)" } : undefined
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

      {/* Main */}
      <div className="flex-1 min-w-0 pt-[88px] md:pt-0">
        <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-6 md:py-8">
          <AuthGate>{children}</AuthGate>
        </div>
      </div>
    </div>
  );
}
