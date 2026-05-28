"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { IVenue } from "@/lib/types";
import { Spinner } from "@/components/Spinner";
import { Dialog } from "@/components/admin/Dialog";
import { Field, inputCls, inputStyle } from "@/components/admin/Field";
import { Button } from "@/components/admin/Button";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@/components/admin/Table";

const EMPTY_VENUE = {
  venue_name: "",
  planner_line_user_id: "",
  line_liff_id: "",
};

function nextVenueId(venues: IVenue[]): string {
  const nums = venues
    .map((v) => v.venue_id.match(/^RC(\d+)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => parseInt(m[1], 10));
  const next = (nums.length === 0 ? 0 : Math.max(...nums)) + 1;
  return `RC${String(next).padStart(3, "0")}`;
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full"
      style={{
        background: active ? "#E8F5E9" : "#F5F5F5",
        color: active ? "#2E7D32" : "#9E9E9E",
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: active ? "#4CAF50" : "#BDBDBD" }}
      />
      {active ? "稼働中" : "停止中"}
    </span>
  );
}

export default function VenuesPage() {
  const router = useRouter();
  const [venues, setVenues] = useState<IVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<IVenue | null>(null);
  const [form, setForm] = useState(EMPTY_VENUE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const previewNextId = nextVenueId(venues);

  const fetchVenues = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("getVenues", "admin");
      if (res.venues) setVenues(res.venues);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVenues();
  }, []);

  const openCreate = () => {
    setForm(EMPTY_VENUE);
    setError("");
    setShowCreate(true);
  };

  const openEdit = (v: IVenue) => {
    setForm({
      venue_name: v.venue_name,
      planner_line_user_id: v.planner_line_user_id || "",
      line_liff_id: v.line_liff_id || "",
    });
    setError("");
    setEditing(v);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.venue_name) {
      setError("式場名は必須です");
      return;
    }
    setSaving(true);
    try {
      await apiClient.post({
        action: "createVenue",
        line_id: "admin",
        venue_id: nextVenueId(venues),
        ...form,
      });
      setShowCreate(false);
      await fetchVenues();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError("");
    setSaving(true);
    try {
      await apiClient.post({
        action: "updateVenue",
        line_id: "admin",
        venue_id: editing.venue_id,
        patch: {
          venue_name: form.venue_name,
          planner_line_user_id: form.planner_line_user_id,
          line_liff_id: form.line_liff_id,
        },
      });
      setEditing(null);
      await fetchVenues();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (v: IVenue) => {
    setSaving(true);
    try {
      await apiClient.post({
        action: "updateVenueStatus",
        line_id: "admin",
        venue_id: v.venue_id,
        active: !v.active,
      });
      await fetchVenues();
    } finally {
      setSaving(false);
    }
  };

  const filtered = venues.filter(
    (v) =>
      !query ||
      v.venue_name?.toLowerCase().includes(query.toLowerCase()) ||
      v.venue_id?.toLowerCase().includes(query.toLowerCase())
  );

  if (loading) return <Spinner fullScreen />;

  return (
    <div className="pb-16">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2
            className="text-2xl font-bold mb-1"
            style={{ color: "var(--colorText)" }}
          >
            式場
          </h2>
          <p className="text-[13px] text-gray-500">
            登録 {venues.length} 件 / 稼働{" "}
            {venues.filter((v) => v.active).length} 件
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="式場名・ID で検索"
            className="px-3 py-2 text-[13px] border rounded-lg outline-none w-64 bg-white"
            style={{ borderColor: "#E5E7EB" }}
          />
          <Button onClick={openCreate}>＋ 新しい式場</Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          className="bg-white p-16 rounded-xl text-center border"
          style={{ borderColor: "#E5E7EB" }}
        >
          <p className="text-gray-400 mb-4">
            {query ? "該当する式場がありません" : "まだ式場が登録されていません"}
          </p>
          {!query && (
            <Button onClick={openCreate}>最初の式場を追加</Button>
          )}
        </div>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH className="w-[80px]">ID</TH>
              <TH>式場名</TH>
              <TH>プランナー LINE</TH>
              <TH>LIFF ID</TH>
              <TH className="w-[100px]">ステータス</TH>
              <TH className="w-[260px] text-right">操作</TH>
            </tr>
          </THead>
          <TBody>
            {filtered.map((v) => (
              <TR key={v.venue_id}>
                <TD mono>
                  <span
                    className="px-1.5 py-0.5 rounded text-[11px] font-bold"
                    style={{
                      background: "var(--colorSecondary)",
                      color: "var(--colorPrimary)",
                    }}
                  >
                    {v.venue_id}
                  </span>
                </TD>
                <TD>
                  <p
                    className="font-bold"
                    style={{ color: "var(--colorText)" }}
                  >
                    {v.venue_name}
                  </p>
                </TD>
                <TD mono>
                  {v.planner_line_user_id ? (
                    <span className="text-gray-600 text-[12px]">
                      {v.planner_line_user_id}
                    </span>
                  ) : (
                    <span className="text-gray-300 italic">未設定</span>
                  )}
                </TD>
                <TD mono>
                  {v.line_liff_id ? (
                    <span className="text-gray-600 text-[12px]">
                      {v.line_liff_id}
                    </span>
                  ) : (
                    <span className="text-gray-300 italic">未設定</span>
                  )}
                </TD>
                <TD>
                  <StatusBadge active={v.active} />
                </TD>
                <TD className="text-right whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      router.push(`/admin/tasks?venue=${v.venue_id}`)
                    }
                  >
                    📋 タスクを見る
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-1"
                    onClick={() => openEdit(v)}
                  >
                    編集
                  </Button>
                  <button
                    onClick={() => toggleActive(v)}
                    disabled={saving}
                    className="ml-1 text-[12px] text-gray-500 hover:text-gray-800 px-2 py-1.5"
                  >
                    {v.active ? "停止" : "再開"}
                  </button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {/* Create Dialog */}
      <Dialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="新しい式場を追加"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              キャンセル
            </Button>
            <Button onClick={(e) => submitCreate(e as any)} disabled={saving}>
              {saving ? "追加中…" : "追加する"}
            </Button>
          </>
        }
      >
        <form onSubmit={submitCreate} className="flex flex-col gap-4">
          <div
            className="rounded-lg p-3 flex items-center gap-3"
            style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}
          >
            <span className="text-[11px] text-gray-500">式場ID</span>
            <span
              className="px-2 py-0.5 rounded font-mono text-[12px] font-bold"
              style={{
                background: "var(--colorSecondary)",
                color: "var(--colorPrimary)",
              }}
            >
              {previewNextId}
            </span>
            <span className="text-[11px] text-gray-400">
              自動採番されます
            </span>
          </div>

          <Field label="式場名" required>
            <input
              type="text"
              value={form.venue_name}
              onChange={(e) =>
                setForm({ ...form, venue_name: e.target.value })
              }
              className={inputCls}
              style={inputStyle}
              placeholder="ヒルトン札幌"
              required
              autoFocus
            />
          </Field>
          <Field
            label="プランナー LINE user_id"
            hint="日次サマリ・テスト送信の宛先"
          >
            <input
              type="text"
              value={form.planner_line_user_id}
              onChange={(e) =>
                setForm({ ...form, planner_line_user_id: e.target.value })
              }
              className={`${inputCls} font-mono`}
              style={inputStyle}
              placeholder="U1234..."
            />
          </Field>
          <Field label="LIFF ID" hint="任意・LINE Developers コンソールで取得">
            <input
              type="text"
              value={form.line_liff_id}
              onChange={(e) =>
                setForm({ ...form, line_liff_id: e.target.value })
              }
              className={`${inputCls} font-mono`}
              style={inputStyle}
              placeholder="0000000000-XXXXXXXX"
            />
          </Field>
          {error && (
            <p
              className="text-[12px] font-semibold"
              style={{ color: "var(--colorError)" }}
            >
              {error}
            </p>
          )}
          <div
            className="rounded-lg p-3 text-[11px] leading-relaxed"
            style={{
              background: "var(--colorSecondary)",
              color: "var(--colorPrimary)",
            }}
          >
            ✨ 追加すると、共通の base task が自動で 16 件コピーされ、
            翌朝 9 時から配信を開始できます。
          </div>
        </form>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`式場を編集 / ${editing?.venue_id}`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              キャンセル
            </Button>
            <Button onClick={(e) => submitEdit(e as any)} disabled={saving}>
              {saving ? "保存中…" : "保存する"}
            </Button>
          </>
        }
      >
        <form onSubmit={submitEdit} className="flex flex-col gap-4">
          <Field label="式場名" required>
            <input
              type="text"
              value={form.venue_name}
              onChange={(e) =>
                setForm({ ...form, venue_name: e.target.value })
              }
              className={inputCls}
              style={inputStyle}
              required
            />
          </Field>
          <Field label="プランナー LINE user_id">
            <input
              type="text"
              value={form.planner_line_user_id}
              onChange={(e) =>
                setForm({ ...form, planner_line_user_id: e.target.value })
              }
              className={`${inputCls} font-mono`}
              style={inputStyle}
            />
          </Field>
          <Field label="LIFF ID">
            <input
              type="text"
              value={form.line_liff_id}
              onChange={(e) =>
                setForm({ ...form, line_liff_id: e.target.value })
              }
              className={`${inputCls} font-mono`}
              style={inputStyle}
            />
          </Field>
          {error && (
            <p
              className="text-[12px] font-semibold"
              style={{ color: "var(--colorError)" }}
            >
              {error}
            </p>
          )}
        </form>
      </Dialog>
    </div>
  );
}
