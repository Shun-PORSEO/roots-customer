"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { ITask } from "@/lib/types";
import { Spinner } from "@/components/Spinner";
import { ErrorMessage } from "@/components/ErrorMessage";

export default function AdminUserTaskPage({ params }: { params: { line_id: string } }) {
  const router = useRouter();
  const lineId = params.line_id;
  
  const [tasks, setTasks] = useState<ITask[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State for Custom Task
  const [showForm, setShowForm] = useState(false);
  const [newTask, setNewTask] = useState({
    category: "追加タスク",
    task_content: "",
    due_estimate: "",
    due_formula: "挙式日 - 0日",
    memo: ""
  });

  const fetchUserTasks = async () => {
    try {
      const res = await apiClient.post({ action: "getAdminUserTasks", line_id: "admin", target_line_id: lineId });
      if (res.tasks) {
        setTasks(res.tasks);
      }
    } catch (e: any) {
      setError(e.message);
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
        is_visible: !currentVisible
      });
      // Optimistic upate
      setTasks(tasks.map(t => t.task_id === taskId ? { ...t, is_visible: !currentVisible } : t));
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
        task: newTask
      });
      setShowForm(false);
      setNewTask({ category: "追加タスク", task_content: "", due_estimate: "", due_formula: "挙式日 - 0日", memo: "" });
      fetchUserTasks(); // Refresh list to get real ID
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
        task_id: taskId
      });
      setTasks(tasks.filter(t => t.task_id !== taskId));
    } catch (e: any) {
      alert("削除に失敗しました: " + e.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <Spinner fullScreen />;
  if (error) return <ErrorMessage message={error} />;

  const globalTasks = tasks.filter(t => !t.is_custom);
  const customTasks = tasks.filter(t => t.is_custom);

  return (
    <div className="pb-16">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => router.push("/admin")}
          className="text-gray-500 hover:text-gray-800"
        >
          &larr; 一覧へ戻る
        </button>
        <h2 className="text-2xl font-bold text-[var(--colorText)]">個別タスク設定</h2>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8">
        <p className="text-blue-800 font-semibold mb-1">対象のLINE ID</p>
        <p className="text-blue-600 font-mono text-sm">{lineId}</p>
      </div>

      {/* Custom Tasks Section */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">追加された個別タスク</h3>
          <button 
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-[var(--colorPrimary)] text-white text-sm font-bold rounded-lg shadow hover:opacity-90 transition"
          >
            ＋ 個別タスクを追加
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAddCustomTask} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-6">
            <h4 className="font-bold mb-4">新しいタスクの作成</h4>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">カテゴリ名</label>
                <input value={newTask.category} onChange={e => setNewTask({...newTask, category: e.target.value})} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">タスク内容</label>
                <input value={newTask.task_content} onChange={e => setNewTask({...newTask, task_content: e.target.value})} className="w-full border p-2 rounded" placeholder="例: リングドッグの手配" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">期日目安</label>
                <input value={newTask.due_estimate} onChange={e => setNewTask({...newTask, due_estimate: e.target.value})} className="w-full border p-2 rounded" placeholder="例: 挙式1ヶ月前" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">メモ</label>
                <textarea value={newTask.memo} onChange={e => setNewTask({...newTask, memo: e.target.value})} className="w-full border p-2 rounded h-20" placeholder="詳細なメモ..." />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-500">キャンセル</button>
                <button type="submit" disabled={updating} className="px-6 py-2 bg-[var(--colorPrimary)] text-white rounded font-bold disabled:opacity-50">保存する</button>
              </div>
            </div>
          </form>
        )}

        {customTasks.length === 0 ? (
          <p className="text-gray-400 text-sm italic">個別タスクはありません</p>
        ) : (
          <div className="flex flex-col gap-3">
            {customTasks.map(task => (
              <div key={task.task_id} className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded font-bold mr-2">{task.category}</span>
                  <p className="font-semibold">{task.task_content}</p>
                </div>
                <button onClick={() => handleDeleteCustomTask(task.task_id)} disabled={updating} className="text-red-500 text-sm font-bold hover:underline disabled:opacity-50">
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Global Tasks Section */}
      <div>
        <h3 className="text-xl font-bold mb-4">基本タスク表示設定</h3>
        <p className="text-sm text-gray-500 mb-4">
          お客様の画面に表示させるタスクのON/OFFを切り替えます。
        </p>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {globalTasks.map((task, idx) => (
            <div key={task.task_id} className={`flex items-center justify-between p-4 ${idx !== globalTasks.length - 1 ? 'border-b border-gray-100' : ''} ${!task.is_visible ? 'bg-gray-50' : ''}`}>
              <div className="flex items-start gap-4">
                <div className={`mt-1 font-mono text-xs px-2 py-1 rounded ${task.is_visible ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                  {task.is_visible ? '表示中' : '非表示'}
                </div>
                <div>
                  <span className={`text-xs px-2 py-0.5 rounded font-bold mr-2 ${task.is_visible ? 'bg-[var(--colorSecondary)] text-[var(--colorPrimary)]' : 'bg-gray-200 text-gray-500'}`}>{task.category}</span>
                  <p className={`font-semibold mt-1 ${task.is_visible ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{task.task_content}</p>
                </div>
              </div>
              <div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={task.is_visible}
                    onChange={() => handleToggleVisibility(task.task_id, task.is_visible)}
                    disabled={updating}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--colorPrimary)]"></div>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
