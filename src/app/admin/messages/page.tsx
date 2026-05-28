"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api";
import { IMessageDraft, IVenue } from "@/lib/types";
import { Spinner } from "@/components/Spinner";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@/components/admin/Table";

function formatTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(key: string) {
  if (!key || key.length < 10) return key;
  const [, m, d] = key.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

function dayLabel(key: string) {
  const today = new Date().toISOString().slice(0, 10);
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yest = y.toISOString().slice(0, 10);
  if (key === today) return "今日";
  if (key === yest) return "昨日";
  const d = new Date(key + "T00:00:00");
  const days = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${formatDate(key)}（${days}）`;
}

export default function MessagesPage() {
  const [drafts, setDrafts] = useState<IMessageDraft[]>([]);
  const [venues, setVenues] = useState<IVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [venueFilter, setVenueFilter] = useState<string>("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<IMessageDraft | null>(null);

  useEffect(() => {
    apiClient.get("getVenues", "admin").then((res) => {
      if (res.venues) setVenues(res.venues);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    apiClient
      .post({
        action: "getMessageDrafts",
        line_id: "admin",
        venue_id: venueFilter || undefined,
      })
      .then((res) => {
        if (res.drafts) setDrafts(res.drafts);
      })
      .finally(() => setLoading(false));
  }, [venueFilter]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return drafts;
    return drafts.filter(
      (d) =>
        d.draft_message?.includes(q) ||
        d.task_id?.includes(q) ||
        d.couple_id?.includes(q)
    );
  }, [drafts, query]);

  // Group by date for stats but render flat table
  const stats = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const today = filtered.filter((d) => (d.created_at || "").startsWith(todayKey)).length;
    const overdue = filtered.filter((d) => d.task_id === "__OVERDUE_DIGEST__").length;
    return { today, total: filtered.length, overdue };
  }, [filtered]);

  const venueName = (id: string) =>
    venues.find((v) => v.venue_id === id)?.venue_name || id;
  const coupleShort = (id: string) =>
    id.length > 14 ? `${id.slice(0, 6)}...${id.slice(-4)}` : id;

  return (
    <div className="pb-16">
      <div className="mb-6">
        <h2
          className="text-2xl font-bold mb-1"
          style={{ color: "var(--colorText)" }}
        >
          配信ログ
        </h2>
        <p className="text-[13px] text-gray-500">
          毎朝 9:00 の自動リマインド配信履歴
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border rounded-xl p-4" style={{ borderColor: "#E5E7EB" }}>
          <p className="text-[12px] text-gray-500 mb-1">今日の配信</p>
          <p className="text-[24px] font-bold" style={{ color: "var(--colorPrimary)" }}>
            {stats.today} <span className="text-[12px] font-normal text-gray-400">件</span>
          </p>
        </div>
        <div className="bg-white border rounded-xl p-4" style={{ borderColor: "#E5E7EB" }}>
          <p className="text-[12px] text-gray-500 mb-1">表示中合計</p>
          <p className="text-[24px] font-bold text-gray-700">
            {stats.total} <span className="text-[12px] font-normal text-gray-400">件</span>
          </p>
        </div>
        <div className="bg-white border rounded-xl p-4" style={{ borderColor: "#E5E7EB" }}>
          <p className="text-[12px] text-gray-500 mb-1">期限切れまとめ</p>
          <p className="text-[24px] font-bold" style={{ color: "#DC2626" }}>
            {stats.overdue} <span className="text-[12px] font-normal text-gray-400">件</span>
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div
        className="bg-white border rounded-xl px-4 py-3 mb-3 flex flex-wrap items-center gap-3"
        style={{ borderColor: "#E5E7EB" }}
      >
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setVenueFilter("")}
            className="px-3 py-1.5 text-[12px] font-semibold rounded-md transition-colors"
            style={{
              background:
                venueFilter === "" ? "var(--colorPrimary)" : "transparent",
              color: venueFilter === "" ? "white" : "#6B7280",
            }}
          >
            すべての式場
          </button>
          {venues.map((v) => {
            const active = venueFilter === v.venue_id;
            return (
              <button
                key={v.venue_id}
                onClick={() => setVenueFilter(v.venue_id)}
                className="px-3 py-1.5 text-[12px] font-semibold rounded-md transition-colors"
                style={{
                  background: active ? "var(--colorPrimary)" : "transparent",
                  color: active ? "white" : "#6B7280",
                }}
              >
                {v.venue_name}
              </button>
            );
          })}
        </div>
        <div className="flex-1 min-w-[200px]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="本文・task_id で検索"
          className="px-3 py-1.5 text-[13px] border rounded-md outline-none bg-white w-72"
          style={{ borderColor: "#E5E7EB" }}
        />
      </div>

      {loading ? (
        <Spinner fullScreen />
      ) : filtered.length === 0 ? (
        <div
          className="bg-white p-16 rounded-xl text-center border"
          style={{ borderColor: "#E5E7EB" }}
        >
          <p className="text-gray-400">配信履歴がありません</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
          <Table>
            <THead>
              <tr>
                <TH className="w-[100px]">日付</TH>
                <TH className="w-[60px]">時刻</TH>
                <TH className="w-[140px]">式場</TH>
                <TH className="w-[120px]">カップル</TH>
                <TH className="w-[140px]">タスク</TH>
                <TH>本文</TH>
                <TH className="w-[80px]">状態</TH>
              </tr>
            </THead>
            <TBody>
              {filtered.map((d) => {
                const dateKey = (d.created_at || "").slice(0, 10);
                const isOverdue = d.task_id === "__OVERDUE_DIGEST__";
                const isSelected = selected?.draft_id === d.draft_id;
                return (
                  <TR
                    key={d.draft_id}
                    onClick={() => setSelected(d)}
                    highlight={isSelected}
                  >
                    <TD>
                      <span className="text-[12px] text-gray-700">
                        {dayLabel(dateKey)}
                      </span>
                    </TD>
                    <TD mono className="text-gray-500">
                      {formatTime(d.created_at)}
                    </TD>
                    <TD>
                      <span className="text-[12px]">{venueName(d.venue_id)}</span>
                    </TD>
                    <TD mono className="text-gray-500">
                      {coupleShort(d.couple_id)}
                    </TD>
                    <TD>
                      {isOverdue ? (
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: "#FEE2E2",
                            color: "#DC2626",
                          }}
                        >
                          期限切れまとめ
                        </span>
                      ) : (
                        <span
                          className="text-[11px] font-mono font-bold px-2 py-0.5 rounded"
                          style={{
                            background: "var(--colorSecondary)",
                            color: "var(--colorPrimary)",
                          }}
                        >
                          {d.task_id}
                        </span>
                      )}
                    </TD>
                    <TD>
                      <p className="text-[12px] text-gray-700 line-clamp-1">
                        {d.draft_message}
                      </p>
                    </TD>
                    <TD>
                      {d.status === "sent" && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                          style={{
                            background: "#E8F5E9",
                            color: "#2E7D32",
                          }}
                        >
                          ✓ 送信済
                        </span>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>

          {/* Detail panel */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            {!selected ? (
              <div
                className="bg-white border rounded-xl p-8 text-center"
                style={{ borderColor: "#E5E7EB" }}
              >
                <div className="text-2xl mb-2 opacity-50">💬</div>
                <p className="text-[13px] text-gray-400">
                  左のログをクリックすると
                  <br />
                  ここに本文全体が表示されます
                </p>
              </div>
            ) : (
              <div
                className="bg-white border rounded-xl p-5"
                style={{ borderColor: "#E5E7EB" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] text-gray-500">配信詳細</p>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-gray-400 hover:text-gray-700 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
                <dl className="text-[12px] space-y-1.5 mb-4">
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-gray-400">送信時刻</dt>
                    <dd className="font-mono text-gray-700">
                      {selected.created_at}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-gray-400">式場</dt>
                    <dd className="text-gray-700">
                      {venueName(selected.venue_id)}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-gray-400">カップル</dt>
                    <dd className="font-mono text-gray-700 truncate">
                      {selected.couple_id}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-gray-400">task_id</dt>
                    <dd className="font-mono text-gray-700">
                      {selected.task_id}
                    </dd>
                  </div>
                </dl>
                <div
                  className="rounded-lg p-3 text-[13px] whitespace-pre-wrap leading-relaxed"
                  style={{
                    background: "#F9FAFB",
                    color: "var(--colorText)",
                  }}
                >
                  {selected.draft_message}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
