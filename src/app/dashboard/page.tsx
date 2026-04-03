"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getLineId } from "@/lib/liff";
import { checkRegistered } from "@/lib/api";
import { useTaskList } from "@/hooks/useTaskList";
import TaskCard from "@/components/TaskCard";
import SkeletonCard from "@/components/SkeletonCard";
import Toast from "@/components/Toast";
import ErrorMessage from "@/components/ErrorMessage";

type Tab = "todo" | "done";

export default function DashboardPage() {
  const router = useRouter();
  const [lineId, setLineId] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>("");
  const [initError, setInitError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("todo");

  const { tasks, loading, error, toggleTask, toastMessage, clearToast } =
    useTaskList(lineId);

  useEffect(() => {
    (async () => {
      try {
        const id = await getLineId();
        setLineId(id);
        const reg = await checkRegistered(id);
        if (reg.status === "exists" && reg.nickname) {
          setNickname(reg.nickname);
        } else if (reg.status !== "exists") {
          router.replace("/register");
        }
      } catch (err) {
        console.error(err);
        setInitError("LINEアプリからアクセスしてください");
      }
    })();
  }, [router]);

  if (initError) return <ErrorMessage message={initError} />;
  if (error) return <ErrorMessage message={error} />;

  const todoTasks = tasks.filter((t) => !t.is_done);
  const doneTasks = tasks.filter((t) => t.is_done);
  const displayed = tab === "todo" ? todoTasks : doneTasks;

  return (
    <div className="flex flex-col min-h-screen bg-bg animate-fade-in">
      {/* Header */}
      <header className="bg-white border-b border-border px-4 py-4">
        <h1 className="text-[20px] font-bold text-text-main">
          {nickname ? `${nickname}さんの準備ダッシュボード` : "準備ダッシュボード"}
        </h1>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-border bg-white">
        <button
          className={`flex-1 min-h-[44px] text-[15px] font-semibold transition-colors ${
            tab === "todo"
              ? "text-primary border-b-2 border-primary"
              : "text-text-sub"
          }`}
          onClick={() => setTab("todo")}
        >
          未完了
          {!loading && todoTasks.length > 0 && (
            <span className="ml-1 text-[13px] font-normal">({todoTasks.length})</span>
          )}
        </button>
        <button
          className={`flex-1 min-h-[44px] text-[15px] font-semibold transition-colors ${
            tab === "done"
              ? "text-primary border-b-2 border-primary"
              : "text-text-sub"
          }`}
          onClick={() => setTab("done")}
        >
          完了済み
          {!loading && doneTasks.length > 0 && (
            <span className="ml-1 text-[13px] font-normal">({doneTasks.length})</span>
          )}
        </button>
      </div>

      {/* Content */}
      <main className="flex-1 px-4 py-4 space-y-3 safe-bottom">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : displayed.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-center px-4">
            <p className="text-[15px] text-text-sub">
              {tab === "todo"
                ? tasks.length === 0
                  ? "タスクがまだ登録されていません。プランナーにご連絡ください"
                  : "すべてのタスクが完了しています！お疲れ様でした"}
                : "完了済みのタスクはありません"}
            </p>
          </div>
        ) : (
          displayed.map((task) => (
            <TaskCard key={task.task_id} task={task} onToggle={toggleTask} />
          ))
        )}
      </main>

      {toastMessage && <Toast message={toastMessage} onClose={clearToast} />}
    </div>
  );
}
