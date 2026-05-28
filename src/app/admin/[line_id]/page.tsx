"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { ITask, ITaskItem, ICustomer } from "@/lib/types";
import { Spinner } from "@/components/Spinner";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Button } from "@/components/admin/Button";
import { Field, inputCls, inputStyle } from "@/components/admin/Field";
import { Dialog } from "@/components/admin/Dialog";
import { getDaysFromToday } from "@/lib/utils";

const EMPTY_CUSTOM_TASK = {
  category: "追加タスク",
  task_content: "",
  due_estimate: "",
  memo: "",
};

export default function AdminUserTaskPage({
  params,
}: {
  params: { line_id: string };
}) {
  const lineId = params.line_id;

  const [tasks, setTasks] = useState<ITask[]>([]);
  const [items, setItems] = useState<ITaskItem[]>([]);
  const [customer, setCustomer] = useState<ICustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [itemDraft, setItemDraft] = useState<
    Record<string, { name: string; qty: string }>
  >({});

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [newTask, setNewTask] = useState(EMPTY_CUSTOM_TASK);

  const fetchAll = async () => {
    try {
      const [tasksRes, itemsRes, userRes] = await Promise.all([
        apiClient.post({
          action: "getAdminUserTasks",
          line_id: "admin",
          target_line_id: lineId,
        }),
        apiClient.post({
          action: "getTaskItems",
          line_id: "admin",
          target_line_id: lineId,
        }),
        apiClient.post({ action: "getUser", line_id: lineId }).catch(() => null),
      ]);
      if (tasksRes.tasks) setTasks(tasksRes.tasks);
      if (itemsRes.items) setItems(itemsRes.items);
      if (userRes && (userRes.wedding_date || userRes.name1_kana)) {
        setCustomer({
          line_id: lineId,
          wedding_date: userRes.wedding_date,
          name1_kana: userRes.name1_kana,
          name2_kana: userRes.name2_kana,
        });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineId]);

  const itemsByTask = useMemo(() => {
    const map = new Map<string, ITaskItem[]>();
    items.forEach((i) => {
      if (!map.has(i.task_id)) map.set(i.task_id, []);
      map.get(i.task_id)!.push(i);
    });
    return map;
  }, [items]);

  const toggleExpand = (taskId: string) => {
    setExpanded((e) => ({ ...e, [taskId]: !e[taskId] }));
  };

  const ensureDraft = (taskId: string) =>
    itemDraft[taskId] || { name: "", qty: "1" };

  const addItem = async (taskId: string) => {
    const d = ensureDraft(taskId);
    const name = d.name.trim();
    if (!name) return;
    setUpdating(true);
    try {
      const res = await apiClient.post({
        action: "addTaskItem",
        line_id: "admin",
        target_line_id: lineId,
        task_id: taskId,
        item_name: name,
        quantity: parseInt(d.qty, 10) || 1,
      });
      if (res.item) {
        setItems((cur) => [...cur, res.item as ITaskItem]);
      }
      setItemDraft((d) => ({ ...d, [taskId]: { name: "", qty: "1" } }));
    } catch (e: any) {
      alert("追加に失敗: " + e.message);
    } finally {
      setUpdating(false);
    }
  };

  const toggleItemDone = async (item: ITaskItem) => {
    const next = !item.is_done;
    setItems((cur) =>
      cur.map((i) => (i.item_id === item.item_id ? { ...i, is_done: next } : i))
    );
    try {
      await apiClient.post({
        action: "updateTaskItem",
        line_id: "admin",
        item_id: item.item_id,
        patch: { is_done: next },
      });
    } catch (e: any) {
      // rollback
      setItems((cur) =>
        cur.map((i) =>
          i.item_id === item.item_id ? { ...i, is_done: item.is_done } : i
        )
      );
      alert("更新に失敗: " + e.message);
    }
  };

  const updateItemQty = async (item: ITaskItem, qty: number) => {
    if (qty < 1) qty = 1;
    setItems((cur) =>
      cur.map((i) =>
        i.item_id === item.item_id ? { ...i, quantity: qty } : i
      )
    );
    try {
      await apiClient.post({
        action: "updateTaskItem",
        line_id: "admin",
        item_id: item.item_id,
        patch: { quantity: qty },
      });
    } catch (e: any) {
      alert("更新に失敗: " + e.message);
    }
  };

  const updateItemName = async (item: ITaskItem, name: string) => {
    setItems((cur) =>
      cur.map((i) =>
        i.item_id === item.item_id ? { ...i, item_name: name } : i
      )
    );
    try {
      await apiClient.post({
        action: "updateTaskItem",
        line_id: "admin",
        item_id: item.item_id,
        patch: { item_name: name },
      });
    } catch (e: any) {
      alert("更新に失敗: " + e.message);
    }
  };

  const deleteItem = async (item: ITaskItem) => {
    if (!confirm(`「${item.item_name}」を削除しますか？`)) return;
    setItems((cur) => cur.filter((i) => i.item_id !== item.item_id));
    try {
      await apiClient.post({
        action: "deleteTaskItem",
        line_id: "admin",
        item_id: item.item_id,
      });
    } catch (e: any) {
      alert("削除に失敗: " + e.message);
      fetchAll();
    }
  };

  const handleToggleVisibility = async (taskId: string, current: boolean) => {
    setUpdating(true);
    try {
      await apiClient.post({
        action: "toggleTaskVisibility",
        line_id: "admin",
        target_line_id: lineId,
        task_id: taskId,
        is_visible: !current,
      });
      setTasks((cur) =>
        cur.map((t) =>
          t.task_id === taskId ? { ...t, is_visible: !current } : t
        )
      );
    } catch (e: any) {
      alert("更新に失敗: " + e.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleAddCustomTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.task_content) return alert("タスク内容を入力してください");
    setUpdating(true);
    try {
      await apiClient.post({
        action: "addCustomTask",
        line_id: "admin",
        target_line_id: lineId,
        task: newTask,
      });
      setShowCustomForm(false);
      setNewTask(EMPTY_CUSTOM_TASK);
      fetchAll();
    } catch (e: any) {
      alert("追加に失敗: " + e.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteCustomTask = async (taskId: string) => {
    if (!confirm("この個別タスクを削除しますか？")) return;
    setUpdating(true);
    try {
      await apiClient.post({
        action: "deleteCustomTask",
        line_id: "admin",
        task_id: taskId,
      });
      setTasks((cur) => cur.filter((t) => t.task_id !== taskId));
    } catch (e: any) {
      alert("削除に失敗: " + e.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <Spinner fullScreen />;
  if (error) return <ErrorMessage message={error} />;

  const coupleName =
    customer?.name1_kana && customer?.name2_kana
      ? `${customer.name1_kana}＆${customer.name2_kana}`
      : "（お名前未登録）";
  const initials =
    customer?.name1_kana && customer?.name2_kana
      ? `${customer.name1_kana[0]}＆${customer.name2_kana[0]}`
      : "?";
  const parts = customer?.wedding_date?.split("-").map(Number);
  const weddingObj =
    parts && parts[0] ? new Date(parts[0], parts[1] - 1, parts[2]) : null;
  const daysLeft = weddingObj ? getDaysFromToday(weddingObj) : null;

  const visible = tasks.filter((t) => t.is_custom || t.is_visible);
  const hidden = tasks.filter((t) => !t.is_custom && !t.is_visible);
  const itemTotal = items.length;
  const itemDone = items.filter((i) => i.is_done).length;

  return (
    <div className="pb-16">
      {/* Breadcrumb */}
      <div className="text-[12px] text-gray-500 mb-4">
        <Link href="/admin" className="hover:text-gray-800">
          お客様
        </Link>
        <span className="mx-2">/</span>
        <span style={{ color: "var(--colorText)" }}>{coupleName}</span>
      </div>

      {/* Couple header */}
      <div
        className="bg-white border rounded-xl p-5 mb-6 flex items-center gap-5"
        style={{ borderColor: "#E5E7EB" }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0"
          style={{
            background:
              "linear-gradient(135deg, var(--colorPrimary), var(--colorAccent))",
          }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h2
            className="text-xl font-bold mb-0.5"
            style={{ color: "var(--colorText)" }}
          >
            {coupleName}ペア
          </h2>
          <div className="flex items-center gap-3 text-[12px] text-gray-500 flex-wrap">
            <span>📅 {customer?.wedding_date || "挙式日 未定"}</span>
            {daysLeft !== null && (
              <span
                className="font-bold px-2 py-0.5 rounded-full"
                style={{
                  color:
                    daysLeft > 30
                      ? "var(--colorPrimary)"
                      : daysLeft > 0
                      ? "#F59E0B"
                      : "#EF4444",
                  background:
                    daysLeft > 30
                      ? "var(--colorSecondary)"
                      : daysLeft > 0
                      ? "#FEF3C7"
                      : "#FEE2E2",
                }}
              >
                {daysLeft > 0
                  ? `あと ${daysLeft} 日`
                  : daysLeft === 0
                  ? "本日"
                  : `${Math.abs(daysLeft)} 日経過`}
              </span>
            )}
            <span className="font-mono text-gray-400 truncate">{lineId}</span>
          </div>
        </div>
        <div className="hidden md:flex gap-6">
          <div className="text-center">
            <p
              className="text-[24px] font-bold leading-none tabular-nums"
              style={{ color: "var(--colorPrimary)" }}
            >
              {tasks.filter((t) => !t.is_custom && t.is_visible).length +
                tasks.filter((t) => t.is_custom).length}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">タスク</p>
          </div>
          <div className="text-center">
            <p
              className="text-[24px] font-bold leading-none tabular-nums"
              style={{ color: "var(--colorAccent)" }}
            >
              {itemTotal}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">手配物</p>
          </div>
          <div className="text-center">
            <p className="text-[24px] font-bold leading-none tabular-nums text-green-600">
              {itemDone}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">手配済み</p>
          </div>
        </div>
      </div>

      {/* タスク + 手配物セクション */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <h3
            className="text-lg font-bold"
            style={{ color: "var(--colorText)" }}
          >
            タスク・手配物
          </h3>
          <p className="text-[12px] text-gray-500">
            各タスクを開くと、そのタスクで発注する手配物を追加できます
          </p>
        </div>
        <Button onClick={() => setShowCustomForm(true)}>
          ＋ 個別タスクを追加
        </Button>
      </div>

      <div
        className="bg-white border rounded-xl overflow-hidden"
        style={{ borderColor: "#E5E7EB" }}
      >
        {visible.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            表示中のタスクがありません
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "#E5E7EB" }}>
            {visible.map((task) => {
              const taskItems = itemsByTask.get(task.task_id) || [];
              const isOpen = expanded[task.task_id] ?? taskItems.length > 0;
              const draft = ensureDraft(task.task_id);
              const itemDoneCount = taskItems.filter((i) => i.is_done).length;
              return (
                <li key={task.task_id}>
                  <div
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleExpand(task.task_id)}
                  >
                    <span
                      className="text-gray-400 text-[12px] w-3 text-center transition-transform"
                      style={{
                        transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                      }}
                    >
                      ▶
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {task.is_custom && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded"
                            style={{
                              background: "#FEF3C7",
                              color: "#92400E",
                            }}
                          >
                            個別
                          </span>
                        )}
                        {task.category && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded"
                            style={{
                              background: "var(--colorSecondary)",
                              color: "var(--colorPrimary)",
                            }}
                          >
                            {task.category}
                          </span>
                        )}
                        <p
                          className="font-semibold text-[14px]"
                          style={{ color: "var(--colorText)" }}
                        >
                          {task.task_content}
                        </p>
                        {task.due_estimate && (
                          <span className="text-[11px] text-gray-400">
                            · {task.due_estimate}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {taskItems.length > 0 && (
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background:
                              itemDoneCount === taskItems.length
                                ? "#E8F5E9"
                                : "#FFFBEB",
                            color:
                              itemDoneCount === taskItems.length
                                ? "#2E7D32"
                                : "#92400E",
                          }}
                        >
                          🛍 {itemDoneCount} / {taskItems.length}
                        </span>
                      )}
                      {task.is_custom && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustomTask(task.task_id);
                          }}
                          className="text-[11px] text-gray-400 hover:text-red-600"
                        >
                          削除
                        </button>
                      )}
                      {!task.is_custom && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleVisibility(
                              task.task_id,
                              task.is_visible
                            );
                          }}
                          className="text-[11px] text-gray-400 hover:text-gray-700"
                        >
                          非表示
                        </button>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div
                      className="px-4 pb-4 pt-1 pl-10"
                      style={{ background: "#FAFBFC" }}
                    >
                      {taskItems.length === 0 ? (
                        <p className="text-[12px] text-gray-400 mb-3 italic">
                          まだ手配物は登録されていません
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-1 mb-3">
                          {taskItems.map((it) => (
                            <li
                              key={it.item_id}
                              className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2"
                              style={{ borderColor: "#E5E7EB" }}
                            >
                              <input
                                type="checkbox"
                                checked={it.is_done}
                                onChange={() => toggleItemDone(it)}
                                className="w-4 h-4 shrink-0 cursor-pointer accent-[var(--colorPrimary)]"
                              />
                              <input
                                type="text"
                                value={it.item_name}
                                onChange={(e) =>
                                  setItems((cur) =>
                                    cur.map((i) =>
                                      i.item_id === it.item_id
                                        ? { ...i, item_name: e.target.value }
                                        : i
                                    )
                                  )
                                }
                                onBlur={(e) =>
                                  updateItemName(it, e.target.value)
                                }
                                className="flex-1 text-[13px] bg-transparent border-0 outline-none px-1"
                                style={{
                                  textDecoration: it.is_done
                                    ? "line-through"
                                    : undefined,
                                  color: it.is_done ? "#9E9E9E" : "var(--colorText)",
                                }}
                              />
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() =>
                                    updateItemQty(it, it.quantity - 1)
                                  }
                                  className="w-6 h-6 rounded text-gray-500 hover:bg-gray-100 text-[14px] leading-none"
                                >
                                  −
                                </button>
                                <span className="text-[12px] font-mono w-8 text-center tabular-nums">
                                  {it.quantity}
                                </span>
                                <button
                                  onClick={() =>
                                    updateItemQty(it, it.quantity + 1)
                                  }
                                  className="w-6 h-6 rounded text-gray-500 hover:bg-gray-100 text-[14px] leading-none"
                                >
                                  ＋
                                </button>
                              </div>
                              <button
                                onClick={() => deleteItem(it)}
                                className="w-7 h-7 rounded text-gray-300 hover:bg-red-50 hover:text-red-500 text-[14px] leading-none shrink-0"
                                aria-label="削除"
                              >
                                ×
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* 追加フォーム */}
                      <form
                        className="flex gap-2 items-center"
                        onSubmit={(e) => {
                          e.preventDefault();
                          addItem(task.task_id);
                        }}
                      >
                        <input
                          type="text"
                          value={draft.name}
                          onChange={(e) =>
                            setItemDraft((d) => ({
                              ...d,
                              [task.task_id]: { ...draft, name: e.target.value },
                            }))
                          }
                          placeholder="手配するものを入力（例: メインドレス）"
                          className="flex-1 text-[13px] px-3 py-1.5 border rounded-md outline-none bg-white"
                          style={{ borderColor: "#E5E7EB" }}
                        />
                        <input
                          type="number"
                          min={1}
                          value={draft.qty}
                          onChange={(e) =>
                            setItemDraft((d) => ({
                              ...d,
                              [task.task_id]: { ...draft, qty: e.target.value },
                            }))
                          }
                          className="w-16 text-[13px] px-2 py-1.5 border rounded-md outline-none bg-white tabular-nums text-center"
                          style={{ borderColor: "#E5E7EB" }}
                        />
                        <Button
                          size="sm"
                          type="submit"
                          disabled={updating || !draft.name.trim()}
                        >
                          ＋ 追加
                        </Button>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 非表示タスク */}
      {hidden.length > 0 && (
        <div className="mt-6">
          <p className="text-[12px] text-gray-400 mb-2">
            非表示にしたタスク（{hidden.length} 件）
          </p>
          <div
            className="bg-white border rounded-xl overflow-hidden"
            style={{ borderColor: "#E5E7EB" }}
          >
            <ul className="divide-y" style={{ borderColor: "#E5E7EB" }}>
              {hidden.map((t) => (
                <li
                  key={t.task_id}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <span className="text-[12px] line-through text-gray-400 flex-1">
                    {t.task_content}
                  </span>
                  <button
                    onClick={() => handleToggleVisibility(t.task_id, t.is_visible)}
                    className="text-[11px] text-gray-500 hover:text-gray-800"
                  >
                    再表示
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Add custom task dialog */}
      <Dialog
        open={showCustomForm}
        onClose={() => setShowCustomForm(false)}
        title="個別タスクを追加"
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setShowCustomForm(false)}
            >
              キャンセル
            </Button>
            <Button
              onClick={(e) => handleAddCustomTask(e as any)}
              disabled={updating}
            >
              {updating ? "追加中…" : "追加する"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddCustomTask} className="flex flex-col gap-3">
          <Field label="カテゴリ">
            <input
              value={newTask.category}
              onChange={(e) =>
                setNewTask({ ...newTask, category: e.target.value })
              }
              className={inputCls}
              style={inputStyle}
            />
          </Field>
          <Field label="タスク内容" required>
            <input
              value={newTask.task_content}
              onChange={(e) =>
                setNewTask({ ...newTask, task_content: e.target.value })
              }
              className={inputCls}
              style={inputStyle}
              placeholder="例: リングドッグの手配"
              required
              autoFocus
            />
          </Field>
          <Field label="期限日">
            <input
              type="date"
              value={newTask.due_estimate}
              onChange={(e) =>
                setNewTask({ ...newTask, due_estimate: e.target.value })
              }
              className={inputCls}
              style={inputStyle}
            />
          </Field>
          <Field label="メモ">
            <textarea
              value={newTask.memo}
              onChange={(e) =>
                setNewTask({ ...newTask, memo: e.target.value })
              }
              className={`${inputCls} h-20 resize-none`}
              style={inputStyle}
              placeholder="詳細メモ（任意）"
            />
          </Field>
        </form>
      </Dialog>
    </div>
  );
}
