"use client";

import { useState, useEffect, useCallback } from "react";
import { getTasks, updateTask } from "@/lib/api";
import type { ITask } from "@/lib/types";

interface UseTaskListResult {
  tasks: ITask[];
  loading: boolean;
  error: string | null;
  toggleTask: (task_id: string, is_done: boolean) => Promise<void>;
  toastMessage: string | null;
  clearToast: () => void;
}

export function useTaskList(lineId: string | null): UseTaskListResult {
  const [tasks, setTasks] = useState<ITask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!lineId) return;
    (async () => {
      try {
        setLoading(true);
        const data = await getTasks(lineId);
        setTasks((data.tasks ?? []).filter((t) => t.is_visible));
      } catch (err) {
        setError("通信エラーが発生しました。もう一度お試しください");
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [lineId]);

  const toggleTask = useCallback(
    async (task_id: string, is_done: boolean) => {
      if (!lineId) return;
      // Optimistic UI update
      setTasks((prev) =>
        prev.map((t) => (t.task_id === task_id ? { ...t, is_done } : t))
      );
      try {
        await updateTask(lineId, task_id, is_done);
      } catch (err) {
        // Revert on failure
        setTasks((prev) =>
          prev.map((t) => (t.task_id === task_id ? { ...t, is_done: !is_done } : t))
        );
        setToastMessage("通信エラーが発生しました。もう一度お試しください");
        console.error(err);
      }
    },
    [lineId]
  );

  const clearToast = useCallback(() => setToastMessage(null), []);

  return { tasks, loading, error, toggleTask, toastMessage, clearToast };
}
