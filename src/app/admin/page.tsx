"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { IUserProgress } from "@/lib/types";
import { getDaysFromToday } from "@/lib/utils";
import { Spinner } from "@/components/Spinner";
import Link from "next/link";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@/components/admin/Table";

function StatCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string | number;
  accent?: string;
  sub?: string;
}) {
  return (
    <div
      className="bg-white rounded-xl border p-5"
      style={{ borderColor: "#E5E7EB" }}
    >
      <p className="text-[12px] text-gray-500 mb-1">{label}</p>
      <p
        className="text-[28px] font-bold leading-tight"
        style={{ color: accent || "var(--colorText)" }}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function MiniProgress({ percent }: { percent: number }) {
  const color =
    percent >= 80 ? "#22C55E" : percent >= 50 ? "#F59E0B" : "var(--colorPrimary)";
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${percent}%`,
            background: color,
            transition: "width 0.5s ease",
          }}
        />
      </div>
      <span
        className="text-[11px] font-bold tabular-nums shrink-0"
        style={{ color }}
      >
        {percent}%
      </span>
    </div>
  );
}

function DaysBadge({ days }: { days: number }) {
  const color = days > 30 ? "var(--colorPrimary)" : days > 0 ? "#F59E0B" : "#EF4444";
  const bg =
    days > 30 ? "var(--colorSecondary)" : days > 0 ? "#FEF3C7" : "#FEE2E2";
  const label =
    days > 0 ? `あと ${days} 日` : days === 0 ? "本日" : `${Math.abs(days)} 日経過`;
  return (
    <span
      className="text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color, background: bg }}
    >
      {label}
    </span>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [users, setUsers] = useState<IUserProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "progress">("date");

  useEffect(() => {
    setLoading(true);
    apiClient
      .post({ action: "getUsersWithProgress", line_id: "admin" })
      .then((res) => {
        if (res.users) setUsers(res.users as IUserProgress[]);
      })
      .finally(() => setLoading(false));
  }, []);

  const couples = users.filter((u) => !u.is_admin);

  const stats = useMemo(() => {
    const totalTasks = couples.reduce((s, u) => s + u.total_tasks, 0);
    const doneTasks = couples.reduce((s, u) => s + u.done_tasks, 0);
    const avgPercent =
      couples.length === 0
        ? 0
        : Math.round(
            couples.reduce(
              (sum, u) =>
                sum +
                (u.total_tasks > 0
                  ? (u.done_tasks / u.total_tasks) * 100
                  : 0),
              0
            ) / couples.length
          );
    return { totalTasks, doneTasks, avgPercent };
  }, [couples]);

  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return couples.filter((u) => {
      if (query) {
        const q = query.toLowerCase();
        const name = `${u.name1_kana || ""}${u.name2_kana || ""}`.toLowerCase();
        if (!name.includes(q) && !u.line_id.toLowerCase().includes(q))
          return false;
      }
      if (filter === "all") return true;
      const parts = u.wedding_date?.split("-").map(Number);
      if (!parts || !parts[0]) return false;
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      const days = Math.round((d.getTime() - today.getTime()) / 86400000);
      if (filter === "upcoming") return days >= 0;
      if (filter === "past") return days < 0;
      return true;
    });
  }, [couples, query, filter]);

  const sorted = useMemo(() => {
    const list = filtered.slice();
    if (sortBy === "date") {
      list.sort((a, b) =>
        (a.wedding_date || "9999") > (b.wedding_date || "9999") ? 1 : -1
      );
    } else {
      const pct = (u: IUserProgress) =>
        u.total_tasks > 0 ? u.done_tasks / u.total_tasks : 0;
      list.sort((a, b) => pct(b) - pct(a));
    }
    return list;
  }, [filtered, sortBy]);

  if (loading) return <Spinner fullScreen />;

  return (
    <div className="pb-16">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2
            className="text-2xl font-bold mb-1"
            style={{ color: "var(--colorText)" }}
          >
            お客様
          </h2>
          <p className="text-[13px] text-gray-500">
            登録カップル {couples.length} 組 / 平均完了率 {stats.avgPercent}%
          </p>
        </div>
        <Link
          href="/admin/help"
          className="text-[12px] font-bold inline-flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-gray-50"
          style={{ color: "var(--colorPrimary)" }}
        >
          📖 使い方ガイド
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="登録ペア数" value={couples.length} />
        <StatCard
          label="平均完了率"
          value={`${stats.avgPercent}%`}
          accent="var(--colorAccent)"
        />
        <StatCard
          label="累計タスク"
          value={stats.totalTasks}
          sub={`完了 ${stats.doneTasks}`}
        />
        <StatCard
          label="完了率"
          value={`${
            stats.totalTasks === 0
              ? 0
              : Math.round((stats.doneTasks / stats.totalTasks) * 100)
          }%`}
          accent="#22C55E"
        />
      </div>

      {/* Toolbar */}
      <div className="bg-white border rounded-xl px-4 py-3 mb-3 flex flex-wrap items-center gap-3" style={{ borderColor: "#E5E7EB" }}>
        <div className="flex items-center gap-1">
          {[
            { key: "all", label: "すべて" },
            { key: "upcoming", label: "挙式予定" },
            { key: "past", label: "挙式済" },
          ].map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as typeof filter)}
                className="px-3 py-1.5 text-[12px] font-semibold rounded-md transition-colors"
                style={{
                  background: active ? "var(--colorPrimary)" : "transparent",
                  color: active ? "white" : "#6B7280",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <div className="h-5 w-px bg-gray-200" />
        <div className="flex items-center gap-1 text-[12px] text-gray-500">
          並び順
          <button
            onClick={() => setSortBy("date")}
            className={`px-2 py-1 rounded-md ${
              sortBy === "date" ? "font-bold text-gray-800 bg-gray-100" : ""
            }`}
          >
            挙式日
          </button>
          <button
            onClick={() => setSortBy("progress")}
            className={`px-2 py-1 rounded-md ${
              sortBy === "progress"
                ? "font-bold text-gray-800 bg-gray-100"
                : ""
            }`}
          >
            進捗
          </button>
        </div>
        <div className="flex-1 min-w-[200px]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="お名前で検索"
          className="px-3 py-1.5 text-[13px] border rounded-md outline-none bg-white w-64"
          style={{ borderColor: "#E5E7EB" }}
        />
      </div>

      {sorted.length === 0 ? (
        <div
          className="bg-white p-16 rounded-xl text-center border"
          style={{ borderColor: "#E5E7EB" }}
        >
          <p className="text-gray-400">該当するお客様がいません</p>
        </div>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>カップル</TH>
              <TH className="w-[130px]">挙式日</TH>
              <TH className="w-[110px]">残り日数</TH>
              <TH className="w-[200px]">進捗</TH>
              <TH className="w-[100px]">タスク</TH>
              <TH className="w-[120px] text-right">操作</TH>
            </tr>
          </THead>
          <TBody>
            {sorted.map((u) => {
              const percent =
                u.total_tasks > 0
                  ? Math.round((u.done_tasks / u.total_tasks) * 100)
                  : 0;
              const parts = u.wedding_date?.split("-").map(Number);
              const weddingObj =
                parts && parts[0]
                  ? new Date(parts[0], parts[1] - 1, parts[2])
                  : null;
              const daysLeft = weddingObj ? getDaysFromToday(weddingObj) : null;
              const coupleName =
                u.name1_kana && u.name2_kana
                  ? `${u.name1_kana}＆${u.name2_kana}`
                  : "（未登録）";
              const initials =
                u.name1_kana && u.name2_kana
                  ? `${u.name1_kana[0]}＆${u.name2_kana[0]}`
                  : "?";
              return (
                <TR
                  key={u.line_id}
                  onClick={() => router.push(`/admin/${u.line_id}`)}
                >
                  <TD>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                        style={{
                          background:
                            "linear-gradient(135deg, var(--colorPrimary), var(--colorAccent))",
                        }}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p
                          className="font-bold truncate"
                          style={{ color: "var(--colorText)" }}
                        >
                          {coupleName}ペア
                        </p>
                        <p className="text-[11px] text-gray-400 font-mono truncate">
                          {u.line_id}
                        </p>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <span className="text-[12px]">
                      {u.wedding_date || (
                        <span className="text-gray-300 italic">未定</span>
                      )}
                    </span>
                  </TD>
                  <TD>
                    {daysLeft !== null ? (
                      <DaysBadge days={daysLeft} />
                    ) : (
                      <span className="text-gray-300 italic text-[11px]">
                        —
                      </span>
                    )}
                  </TD>
                  <TD>
                    <MiniProgress percent={percent} />
                  </TD>
                  <TD>
                    <span className="text-[12px] tabular-nums text-gray-600">
                      {u.done_tasks} / {u.total_tasks}
                    </span>
                  </TD>
                  <TD className="text-right">
                    <span
                      className="text-[12px] font-bold"
                      style={{ color: "var(--colorPrimary)" }}
                    >
                      管理 →
                    </span>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
    </div>
  );
}
