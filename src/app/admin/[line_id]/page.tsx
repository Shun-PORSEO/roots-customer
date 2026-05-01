"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { ITask } from "@/lib/types";
import { Spinner } from "@/components/Spinner";
import { InlineApiError } from "@/components/ErrorMessage";

export default function AdminUserTaskPage({ params }: { params: { line_id: string } }) {
  const router = useRouter();
  const lineId = params.line_id;

  const [tasks, setTasks] = useState<ITask[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const [showForm, setShowForm] = useState(false);
  const [newTask, setNewTask] = useState({
    category: "追加タスク",
    task_content: "",
    due_estimate: "",
    due_formula: "挙式日 - 0日",
    memo: "",
  });

  const fetchUserTasks = async () => {
    try {
      const res = await apiClient.post({
        action: "getAdminUserTasks",
        line_id: "admin",
        target_line_id: lineId,
      });
      if (res.tasks) {
        setTasks(res.tasks);
      }
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserTasks();
  }, [lineId]);

  const handleToggleVisibility = async (taskId: string, currentVisible: boolean) => {
    setUpdating(true);
    try {
      await apiClient.post({
        action: "toggleTaskVisibility",
        line_id: "admin",
        target_line_id: lineId,
        task_id: taskId,
        is_visible: !currentVisible,
      });
      setTasks(tasks.map((t) => (t.task_id === taskId ? { ...t, is_visible: !currentVisible } : t)));
    } catch (e: any) {
      alert("更新に失敗しました: " + e.message);
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
      setShowForm(false);
      setNewTask({
        category: "追加タスク",
        task_content: "",
        due_estimate: "",
        due_formula: "挙式日 - 0日",
        memo: "",
      });
      fetchUserTasks();
    } catch (e: any) {
      alert("追加に失敗しました: " + e.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteCustomTask = async (taskId: string) => {
    if (!confirm("この個別タスクを本当に削除しますか？")) return;
    setUpdating(true);
    try {
      await apiClient.post({
        action: "deleteCustomTask",
        line_id: "admin",
        task_id: taskId,
      });
      setTasks(tasks.filter((t) => t.task_id !== taskId));
    } catch (e: any) {
      alert("削除に失敗しました: " + e.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <Spinner fullScreen />;
  if (error) return <div className="p-md"><InlineApiError error={error} /></div>;

  const globalTasks = tasks.filter((t) => !t.is_custom);
  const customTasks = tasks.filter((t) => t.is_custom);

  return (
    <div className="pb-2xl animate-fade-in">
      <div className="flex items-center gap-sm mb-lg">
        <button
          onClick={() => router.push("/admin")}
          className="w-10 h-10 -ml-xs flex items-center justify-center text-neutral-50 hover:bg-neutral-95 rounded-full active:bg-neutral-90 transition-colors"
          aria-label="一覧へ戻る"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-display text-display-md text-on-surface">個別タスク設定</h2>
      </div>

      <div className="card-base bg-primary-5 border-primary-20 p-md mb-lg">
        <p className="text-label-caps text-primary-70 mb-2xs">対象の LINE ID</p>
        <p className="text-body-md text-primary-80 font-mono break-all tabular-nums">{lineId}</p>
      </div>

      {/* === Custom Tasks === */}
      <section className="mb-2xl">
        <div className="flex items-center justify-between mb-md">
          <h3 className="text-headline-lg text-on-surface">追加された個別タスク</h3>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary !h-10 !px-md text-body-md"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            個別タスクを追加
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAddCustomTask} className="card-base p-lg mb-md">
            <h4 className="text-headline-md text-on-surface mb-md">新しいタスクの作成</h4>
            <div className="flex flex-col gap-sm">
              <div>
                <label className="label-form">カテゴリ名</label>
                <input
                  value={newTask.category}
                  onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                  className="input-base"
                />
              </div>
              <div>
                <label className="label-form">タスク内容</label>
                <input
                  value={newTask.task_content}
                  onChange={(e) => setNewTask({ ...newTask, task_content: e.target.value })}
                  className="input-base"
                  placeholder="例: リングドッグの手配"
                />
              </div>
              <div>
                <label className="label-form">期日目安</label>
                <input
                  value={newTask.due_estimate}
                  onChange={(e) => setNewTask({ ...newTask, due_estimate: e.target.value })}
                  className="input-base"
                  placeholder="例: 挙式1ヶ月前"
                />
              </div>
              <div>
                <label className="label-form">メモ</label>
                <textarea
                  value={newTask.memo}
                  onChange={(e) => setNewTask({ ...newTask, memo: e.target.value })}
                  className="input-base !h-auto py-sm resize-none"
                  style={{ minHeight: "5rem" }}
                  placeholder="詳細なメモ..."
                />
              </div>
              <div className="flex justify-end gap-xs mt-xs">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-ghost"
                >
                  キャンセル
                </button>
                <button type="submit" disabled={updating} className="btn-primary !w-auto">
                  保存する
                </button>
              </div>
            </div>
          </form>
        )}

        {customTasks.length === 0 ? (
          <p className="text-body-md text-neutral-50 italic px-2xs">個別タスクはありません</p>
        ) : (
          <div className="flex flex-col gap-sm">
            {customTasks.map((task) => (
              <div
                key={task.task_id}
                className="bg-tertiary-10 border border-tertiary-20 rounded-md p-md flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <span className="inline-block bg-tertiary-50 text-neutral-10 text-label-caps px-2 py-0.5 rounded-xs mb-xs">
                    {task.category}
                  </span>
                  <p className="text-headline-sm text-on-surface mt-2xs">{task.task_content}</p>
                </div>
                <button
                  onClick={() => handleDeleteCustomTask(task.task_id)}
                  disabled={updating}
                  className="text-error text-body-md font-semibold hover:underline disabled:opacity-50 ml-sm"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* === Global Tasks (visibility) === */}
      <section>
        <h3 className="text-headline-lg text-on-surface mb-2xs">基本タスク表示設定</h3>
        <p className="text-body-md text-neutral-50 mb-md">
          お客様の画面に表示させるタスクの表示/非表示を切り替えます。
        </p>

        <div className="card-base overflow-hidden">
          {globalTasks.map((task, idx) => (
            <div
              key={task.task_id}
              className={[
                "flex items-center justify-between p-md transition-colors",
                idx !== globalTasks.length - 1 ? "border-b border-border" : "",
                !task.is_visible ? "bg-neutral-98" : "",
              ].join(" ")}
            >
              <div className="flex items-start gap-sm flex-1 min-w-0">
                <span
                  className={[
                    "shrink-0 mt-0.5 inline-flex items-center justify-center text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-xs",
                    task.is_visible
                      ? "bg-primary-10 text-primary-70"
                      : "bg-neutral-90 text-neutral-50",
                  ].join(" ")}
                >
                  {task.is_visible ? "表示中" : "非表示"}
                </span>
                <div className="min-w-0">
                  <span
                    className={[
                      "inline-block text-label-caps px-2 py-0.5 rounded-xs mr-xs",
                      task.is_visible
                        ? "bg-primary-10 text-primary-70"
                        : "bg-neutral-95 text-neutral-50",
                    ].join(" ")}
                  >
                    {task.category}
                  </span>
                  <p
                    className={[
                      "text-headline-sm mt-2xs",
                      task.is_visible ? "text-on-surface" : "text-neutral-50 line-through",
                    ].join(" ")}
                  >
                    {task.task_content}
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-sm">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={task.is_visible}
                  onChange={() => handleToggleVisibility(task.task_id, task.is_visible)}
                  disabled={updating}
                />
                <div className="w-11 h-6 bg-neutral-90 rounded-full peer peer-checked:bg-primary-70 transition-colors duration-short after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-neutral-80 after:rounded-full after:h-5 after:w-5 after:shadow-sm after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-primary-70" />
              </label>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
