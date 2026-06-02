"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { apiClient } from "@/lib/api";
import { getAdminLineId } from "@/hooks/useAdminAuth";
import { IVenue, ITask, ITaskItem } from "@/lib/types";
import { Spinner } from "@/components/Spinner";
import { Field, inputCls, inputStyle } from "@/components/admin/Field";
import { Button } from "@/components/admin/Button";
import { Dialog } from "@/components/admin/Dialog";

type TaskMaster = ITask & {
  venue_id?: string;
  is_active?: boolean;
  manual_url?: string;
  reminder_message?: string;
  target_line_id?: string;
};

const NEW_TASK: Partial<TaskMaster> = {
  category: "",
  task_content: "",
  due_formula: "挙式日 - 30日",
  due_estimate: "挙式1ヶ月前",
  memo: "",
  reminder_message: "",
  manual_url: "",
};

export default function TasksPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const initialVenue = searchParams?.get("venue") || "";

  const [venues, setVenues] = useState<IVenue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<string>(initialVenue); // "" = base
  const [tasks, setTasks] = useState<TaskMaster[]>([]);
  const [templates, setTemplates] = useState<ITaskItem[]>([]);
  const [tplDraft, setTplDraft] = useState<{ name: string; qty: string }>({
    name: "",
    qty: "1",
  });
  const [tplLoading, setTplLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskMaster | null>(null);
  const [draft, setDraft] = useState<Partial<TaskMaster>>({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "empty" | "inactive">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState<Partial<TaskMaster>>(NEW_TASK);

  useEffect(() => {
    apiClient.get("getVenues", getAdminLineId()).then((res) => {
      if (res.venues) setVenues(res.venues);
    });
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post({
        action: "getVenueTasks",
        line_id: getAdminLineId(),
        venue_id: selectedVenue || undefined,
      });
      if (res.tasks) setTasks(res.tasks as TaskMaster[]);
      setSelectedTask(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    // sync URL so /admin/tasks?venue=RC001 stays in sync
    const newQs = selectedVenue ? `?venue=${selectedVenue}` : "";
    const target = `${pathname}${newQs}`;
    if (typeof window !== "undefined" && window.location.search !== newQs) {
      router.replace(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVenue]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === "empty")
        return !t.reminder_message || t.reminder_message.trim() === "";
      if (filter === "inactive") return t.is_active === false;
      return true;
    });
  }, [tasks, filter]);

  const openTask = (t: TaskMaster) => {
    setSelectedTask(t);
    setDraft({
      category: t.category,
      task_content: t.task_content,
      due_formula: t.due_formula,
      due_estimate: t.due_estimate,
      memo: t.memo,
      reminder_message: t.reminder_message || "",
      manual_url: t.manual_url || "",
    });
    setTplDraft({ name: "", qty: "1" });
    // fetch template items for this task
    setTemplates([]);
    setTplLoading(true);
    apiClient
      .post({
        action: "getTaskItemTemplates",
        line_id: getAdminLineId(),
        task_id: t.task_id,
      })
      .then((res) => {
        if (res.items) setTemplates(res.items);
      })
      .finally(() => setTplLoading(false));
  };

  const addTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    const name = tplDraft.name.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await apiClient.post({
        action: "addTaskItemTemplate",
        line_id: getAdminLineId(),
        task_id: selectedTask.task_id,
        item_name: name,
        quantity: parseInt(tplDraft.qty, 10) || 1,
      });
      if (res.item) setTemplates((cur) => [...cur, res.item as ITaskItem]);
      setTplDraft({ name: "", qty: "1" });
    } catch (e: any) {
      alert("追加に失敗: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (item: ITaskItem) => {
    if (!confirm(`テンプレ「${item.item_name}」を削除しますか？`)) return;
    setTemplates((cur) => cur.filter((i) => i.item_id !== item.item_id));
    try {
      await apiClient.post({
        action: "deleteTaskItem",
        line_id: getAdminLineId(),
        item_id: item.item_id,
      });
    } catch (e: any) {
      alert("削除に失敗: " + e.message);
    }
  };

  const saveTask = async () => {
    if (!selectedTask) return;
    setSaving(true);
    try {
      await apiClient.post({
        action: "updateTaskMaster",
        line_id: getAdminLineId(),
        task_id: selectedTask.task_id,
        patch: draft,
      });
      await fetchTasks();
      setSelectedTask(null);
    } catch (e: any) {
      alert("保存に失敗しました: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (t: TaskMaster) => {
    setSaving(true);
    try {
      await apiClient.post({
        action: "updateTaskMaster",
        line_id: getAdminLineId(),
        task_id: t.task_id,
        patch: { is_active: !(t.is_active !== false) },
      });
      await fetchTasks();
    } finally {
      setSaving(false);
    }
  };

  const testSend = async (t: TaskMaster) => {
    if (!selectedVenue) {
      alert("テスト送信は式場別タスクのみ可能です。式場を選択してください");
      return;
    }
    setSaving(true);
    try {
      await apiClient.post({
        action: "testSendTask",
        line_id: getAdminLineId(),
        venue_id: selectedVenue,
        task_id: t.task_id,
      });
      alert("プランナーLINEにテスト送信しました");
    } catch (e: any) {
      alert("送信に失敗しました: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.task_content) return alert("タスク内容を入力してください");
    setSaving(true);
    try {
      await apiClient.post({
        action: "addTaskMaster",
        line_id: getAdminLineId(),
        venue_id: selectedVenue || undefined,
        task: newTask,
      });
      setShowAdd(false);
      setNewTask(NEW_TASK);
      await fetchTasks();
    } catch (e: any) {
      alert("追加に失敗しました: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const emptyCount = tasks.filter(
    (t) => !t.reminder_message || t.reminder_message.trim() === ""
  ).length;
  const inactiveCount = tasks.filter((t) => t.is_active === false).length;

  return (
    <div className="pb-16">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2
            className="text-2xl font-bold mb-1"
            style={{ color: "var(--colorText)" }}
          >
            タスク雛形
          </h2>
          <p className="text-sm text-gray-500">
            リマインド本文・期限・マニュアルURL を整える編集の主戦場
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>＋ タスクを追加</Button>
      </div>

      {/* 式場切替 */}
      <div
        className="bg-white rounded-2xl border shadow-sm p-4 mb-4"
        style={{ borderColor: "var(--colorBorder)" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-[12px] font-bold mr-2"
            style={{ color: "var(--colorTextLight)" }}
          >
            編集対象
          </span>
          <button
            onClick={() => setSelectedVenue("")}
            className="px-3 py-1.5 text-[12px] font-semibold rounded-full border transition-all"
            style={{
              background: selectedVenue === "" ? "var(--colorPrimary)" : "white",
              color:
                selectedVenue === "" ? "white" : "var(--colorTextLight)",
              borderColor:
                selectedVenue === ""
                  ? "var(--colorPrimary)"
                  : "var(--colorBorder)",
            }}
          >
            base（共通雛形）
          </button>
          {venues.map((v) => {
            const active = selectedVenue === v.venue_id;
            return (
              <button
                key={v.venue_id}
                onClick={() => setSelectedVenue(v.venue_id)}
                className="px-3 py-1.5 text-[12px] font-semibold rounded-full border transition-all"
                style={{
                  background: active ? "var(--colorPrimary)" : "white",
                  color: active ? "white" : "var(--colorTextLight)",
                  borderColor: active
                    ? "var(--colorPrimary)"
                    : "var(--colorBorder)",
                }}
              >
                {v.venue_name}
                <span className="ml-1 opacity-60 font-mono text-[10px]">
                  {v.venue_id}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* フィルター */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {[
          { key: "all", label: `すべて (${tasks.length})` },
          {
            key: "empty",
            label: `🔍 リマインド未設定 (${emptyCount})`,
          },
          { key: "inactive", label: `🚫 停止中 (${inactiveCount})` },
        ].map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as typeof filter)}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-full transition-all border"
              style={{
                background: active ? "var(--colorPrimary)" : "white",
                color: active ? "white" : "var(--colorTextLight)",
                borderColor: active
                  ? "var(--colorPrimary)"
                  : "var(--colorBorder)",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <Spinner fullScreen />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-4">
          {/* タスク一覧 */}
          <div
            className="bg-white border rounded-xl divide-y overflow-hidden"
            style={{ borderColor: "#E5E7EB" }}
          >
            {filteredTasks.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                該当するタスクがありません
              </div>
            ) : (
              filteredTasks.map((t) => {
                const isEmpty =
                  !t.reminder_message || t.reminder_message.trim() === "";
                const isInactive = t.is_active === false;
                const isSelected = selectedTask?.task_id === t.task_id;
                return (
                  <button
                    key={t.task_id}
                    onClick={() => openTask(t)}
                    className="block w-full text-left px-4 py-3 transition-colors hover:bg-gray-50"
                    style={{
                      background: isSelected
                        ? "var(--colorSecondary)"
                        : isInactive
                        ? "#FAFAFA"
                        : "white",
                      borderLeft: isSelected
                        ? "3px solid var(--colorPrimary)"
                        : "3px solid transparent",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 w-[80px] text-center"
                        style={{
                          background: "#F3F4F6",
                          color: "var(--colorPrimary)",
                        }}
                      >
                        {t.task_id}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-semibold text-[13px] truncate"
                          style={{
                            color: isInactive ? "#9E9E9E" : "var(--colorText)",
                            textDecoration: isInactive
                              ? "line-through"
                              : undefined,
                          }}
                        >
                          {t.task_content}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {t.category && (
                            <span className="text-[10px] text-gray-500">
                              {t.category}
                            </span>
                          )}
                          {(t.due_estimate || t.due_formula) && (
                            <span className="text-[10px] text-gray-400">
                              · {t.due_estimate || t.due_formula}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isEmpty && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{
                              background: "#FEF3C7",
                              color: "#92400E",
                            }}
                          >
                            本文未設定
                          </span>
                        )}
                        {isInactive && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">
                            停止
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* 編集パネル */}
          <div className="lg:sticky lg:top-32 lg:self-start">
            {!selectedTask ? (
              <div
                className="bg-white rounded-2xl border p-8 text-center"
                style={{ borderColor: "var(--colorBorder)" }}
              >
                <div className="text-3xl mb-3">📋</div>
                <p className="text-sm text-gray-400">
                  左側のタスクを選択すると
                  <br />
                  ここで編集できます
                </p>
              </div>
            ) : (
              <div
                className="bg-white rounded-2xl border shadow-sm p-5"
                style={{ borderColor: "var(--colorBorder)" }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="text-[10px] font-mono font-bold px-2 py-1 rounded-full"
                    style={{
                      background: "var(--colorSecondary)",
                      color: "var(--colorPrimary)",
                    }}
                  >
                    {selectedTask.task_id}
                  </span>
                  <button
                    onClick={() => setSelectedTask(null)}
                    className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  <Field label="カテゴリ">
                    <input
                      value={draft.category || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, category: e.target.value })
                      }
                      className={inputCls}
                      style={inputStyle}
                      placeholder="衣裳 / 招待状 / 打合せ"
                    />
                  </Field>

                  <Field label="タスク内容" required>
                    <input
                      value={draft.task_content || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, task_content: e.target.value })
                      }
                      className={inputCls}
                      style={inputStyle}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="期限計算式" hint="例: 挙式日 - 90日">
                      <input
                        value={draft.due_formula || ""}
                        onChange={(e) =>
                          setDraft({ ...draft, due_formula: e.target.value })
                        }
                        className={`${inputCls} font-mono`}
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="表示用">
                      <input
                        value={draft.due_estimate || ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            due_estimate: e.target.value,
                          })
                        }
                        className={inputCls}
                        style={inputStyle}
                        placeholder="挙式3ヶ月前"
                      />
                    </Field>
                  </div>

                  <Field
                    label="リマインド本文"
                    hint="空欄でも fallback で配信されます"
                  >
                    <textarea
                      value={draft.reminder_message || ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          reminder_message: e.target.value,
                        })
                      }
                      className={`${inputCls} h-28 resize-none leading-relaxed`}
                      style={inputStyle}
                      placeholder={`空のままなら:\n「${
                        draft.task_content || "（タスク名）"
                      }」のご案内です。\nお手隙の際にご確認・ご対応をお願いいたします🙇`}
                    />
                  </Field>

                  <Field label="マニュアルURL" hint="https:// から始まる URL">
                    <input
                      type="url"
                      value={draft.manual_url || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, manual_url: e.target.value })
                      }
                      className={inputCls}
                      style={inputStyle}
                      placeholder="https://..."
                    />
                  </Field>

                  <Field label="プランナー用メモ">
                    <textarea
                      value={draft.memo || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, memo: e.target.value })
                      }
                      className={`${inputCls} h-16 resize-none`}
                      style={inputStyle}
                    />
                  </Field>

                  {/* テンプレ手配物 */}
                  <div
                    className="rounded-lg border p-3 mt-1"
                    style={{
                      background: "#FAFBFC",
                      borderColor: "var(--colorBorder)",
                    }}
                  >
                    <div className="flex items-baseline justify-between mb-2">
                      <p
                        className="text-[12px] font-bold tracking-wide"
                        style={{ color: "var(--colorText)" }}
                      >
                        📦 テンプレ手配物
                      </p>
                      <p className="text-[10px] text-gray-400">
                        このタスクで標準的に発注するもの
                      </p>
                    </div>
                    {tplLoading ? (
                      <p className="text-[11px] text-gray-400 mb-2">読み込み中…</p>
                    ) : templates.length === 0 ? (
                      <p className="text-[11px] text-gray-400 mb-2 italic">
                        まだテンプレ手配物は登録されていません
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1 mb-2">
                        {templates.map((it) => (
                          <li
                            key={it.item_id}
                            className="flex items-center gap-2 bg-white border rounded-md px-2.5 py-1.5"
                            style={{ borderColor: "var(--colorBorder)" }}
                          >
                            <span
                              className="flex-1 text-[12.5px]"
                              style={{ color: "var(--colorText)" }}
                            >
                              {it.item_name}
                            </span>
                            <span className="text-[11px] font-mono text-gray-500 tabular-nums shrink-0">
                              × {it.quantity}
                            </span>
                            <button
                              onClick={() => deleteTemplate(it)}
                              className="w-5 h-5 text-gray-300 hover:text-red-500 text-[14px] leading-none shrink-0"
                              aria-label="削除"
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <form
                      className="flex gap-1.5 items-center"
                      onSubmit={addTemplate}
                    >
                      <input
                        type="text"
                        value={tplDraft.name}
                        onChange={(e) =>
                          setTplDraft({ ...tplDraft, name: e.target.value })
                        }
                        placeholder="手配物名（例: メインドレス）"
                        className="flex-1 text-[12.5px] px-2.5 py-1.5 border rounded-md outline-none bg-white"
                        style={{ borderColor: "var(--colorBorder)" }}
                      />
                      <input
                        type="number"
                        min={1}
                        value={tplDraft.qty}
                        onChange={(e) =>
                          setTplDraft({ ...tplDraft, qty: e.target.value })
                        }
                        className="w-14 text-[12.5px] px-2 py-1.5 border rounded-md outline-none bg-white tabular-nums text-center"
                        style={{ borderColor: "var(--colorBorder)" }}
                      />
                      <Button
                        size="sm"
                        type="submit"
                        disabled={saving || !tplDraft.name.trim()}
                      >
                        ＋
                      </Button>
                    </form>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: "var(--colorBorder)" }}>
                    <Button
                      onClick={saveTask}
                      disabled={saving}
                      className="flex-1"
                    >
                      {saving ? "保存中…" : "💾 保存"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => testSend(selectedTask)}
                      disabled={saving || !selectedVenue}
                    >
                      💌 テスト送信
                    </Button>
                  </div>

                  <button
                    onClick={() => toggleActive(selectedTask)}
                    disabled={saving}
                    className="text-[12px] text-gray-500 hover:text-gray-700 mt-1 text-left underline-offset-2 hover:underline"
                  >
                    {selectedTask.is_active === false
                      ? "▶️ このタスクを再開する"
                      : "🚫 このタスクを停止する"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* タスク追加ダイアログ */}
      <Dialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title={
          selectedVenue
            ? `タスクを追加 / ${
                venues.find((v) => v.venue_id === selectedVenue)?.venue_name ||
                selectedVenue
              }`
            : "base タスクを追加（全式場の雛形）"
        }
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>
              キャンセル
            </Button>
            <Button
              onClick={(e) => submitAdd(e as any)}
              disabled={saving}
            >
              {saving ? "追加中…" : "追加する"}
            </Button>
          </>
        }
      >
        <form onSubmit={submitAdd} className="flex flex-col gap-3">
          <Field label="カテゴリ">
            <input
              value={newTask.category || ""}
              onChange={(e) =>
                setNewTask({ ...newTask, category: e.target.value })
              }
              className={inputCls}
              style={inputStyle}
              placeholder="衣裳 / 招待状 / 打合せ"
            />
          </Field>
          <Field label="タスク内容" required>
            <input
              value={newTask.task_content || ""}
              onChange={(e) =>
                setNewTask({ ...newTask, task_content: e.target.value })
              }
              className={inputCls}
              style={inputStyle}
              placeholder="例: リングドッグの手配"
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="期限計算式" hint="例: 挙式日 - 30日">
              <input
                value={newTask.due_formula || ""}
                onChange={(e) =>
                  setNewTask({ ...newTask, due_formula: e.target.value })
                }
                className={`${inputCls} font-mono`}
                style={inputStyle}
              />
            </Field>
            <Field label="表示用">
              <input
                value={newTask.due_estimate || ""}
                onChange={(e) =>
                  setNewTask({ ...newTask, due_estimate: e.target.value })
                }
                className={inputCls}
                style={inputStyle}
                placeholder="挙式1ヶ月前"
              />
            </Field>
          </div>
          <Field label="リマインド本文（任意）">
            <textarea
              value={newTask.reminder_message || ""}
              onChange={(e) =>
                setNewTask({
                  ...newTask,
                  reminder_message: e.target.value,
                })
              }
              className={`${inputCls} h-20 resize-none`}
              style={inputStyle}
              placeholder="空欄でも fallback で配信されます"
            />
          </Field>
        </form>
      </Dialog>
    </div>
  );
}
