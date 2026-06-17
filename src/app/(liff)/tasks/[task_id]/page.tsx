"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiff } from "@/hooks/useLiff";
import { apiClient } from "@/lib/api";
import { ITask } from "@/lib/types";
import { Spinner } from "@/components/Spinner";
import { Checkbox } from "@/components/Checkbox";
import { ErrorMessage } from "@/components/ErrorMessage";

export default function TaskDetailPage({ params }: { params: { task_id: string } }) {
  const { isLiffReady, profile } = useLiff();
  const router = useRouter();

  const [task, setTask] = useState<ITask | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // タスクごとのコメント（カップル→プランナー）
  const [comment, setComment] = useState("");
  const [commentInit, setCommentInit] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [commentMsg, setCommentMsg] = useState<string | null>(null);

  // タスクが初めて読み込めたら、保存済みコメントを入力欄へ反映（1回だけ）。
  // 以降のネットワーク再取得では上書きしない（入力中の文字を消さないため）。
  useEffect(() => {
    if (task && !commentInit) {
      setComment(task.comment || "");
      setCommentInit(true);
    }
  }, [task, commentInit]);

  const saveComment = async () => {
    if (!profile || !task) return;
    setSavingComment(true);
    setCommentMsg(null);
    try {
      await apiClient.post({
        action: "updateTaskComment",
        line_id: profile.userId,
        task_id: task.task_id,
        comment,
      });
      // ダッシュボードと共有しているキャッシュにも反映しておく
      const cacheKey = `roots_dashboard_${profile.userId}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          const tasks = (parsed.tasks || []).map((t: ITask) =>
            t.task_id === task.task_id ? { ...t, comment } : t
          );
          localStorage.setItem(cacheKey, JSON.stringify({ ...parsed, tasks }));
        }
      } catch {}
      setCommentMsg("コメントを保存しました");
      setTimeout(() => setCommentMsg(null), 2500);
    } catch (e: any) {
      setCommentMsg("保存に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setSavingComment(false);
    }
  };

  useEffect(() => {
    const fetchTask = async () => {
      if (!profile) return;

      const CACHE_FRESH_MS = 60_000;
      const cacheKey = `roots_dashboard_${profile.userId}`;
      const cachedData = localStorage.getItem(cacheKey);
      let parsedCache: any = null;
      if (cachedData) {
        try {
          parsedCache = JSON.parse(cachedData);
          const found = parsedCache?.tasks?.find((t: ITask) => t.task_id === params.task_id);
          if (found) {
            setTask(found);
            setLoading(false);
            // キャッシュが新鮮（60秒以内）ならGAS再フェッチをスキップ
            if (parsedCache.cachedAt && Date.now() - parsedCache.cachedAt < CACHE_FRESH_MS) {
              return;
            }
          }
        } catch (e) {}
      }

      try {
        const res = await apiClient.get("getTasks", profile.userId);
        const tasks = (res.tasks || []) as ITask[];
        const found = tasks.find((t) => t.task_id === params.task_id);
        if (found) {
          setTask(found);
          // ダッシュボードと同じキャッシュキーを共有しているので、
          // tasks だけ上書きして name1/name2/isAdmin/weddingDate などは維持する。
          // ここでフィールドを書き落とすと、戻った時にカップル名や管理者ボタンが消える。
          localStorage.setItem(cacheKey, JSON.stringify({
            ...(parsedCache || {}),
            tasks: res.tasks,
          }));
        } else if (!cachedData) {
          setError("タスクが見つかりませんでした。");
        }
      } catch (err: any) {
        if (!cachedData) setError("タスクの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };
    if (isLiffReady && profile) {
      fetchTask();
    }
  }, [isLiffReady, profile, params.task_id]);

  const handleToggle = async (isDone: boolean) => {
    if (!profile || !task) return;
    // クロージャに閉じ込められた task 参照に依存しないよう、必要な値はここで切り出す。
    // route 切り替え直前にトグルされても、別タスクの行を書き換えてしまう事故を防ぐ。
    const targetTaskId = task.task_id;
    const previousTask = task;

    // 1. 画面上は即時切り替え（楽観更新）。
    setTask({ ...task, is_done: isDone });
    setUpdating(true);

    // 2. ダッシュボードと共有している localStorage キャッシュも更新する。
    //    これをしないと、戻る → ダッシュボードが古いキャッシュを表示し
    //    「詳細で完了にしたのに一覧に反映されない」現象が起きる。
    const cacheKey = `roots_dashboard_${profile.userId}`;
    const patchCache = (done: boolean) => {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (!cached) return;
        const parsed = JSON.parse(cached);
        const tasks = (parsed.tasks || []).map((t: ITask) =>
          t.task_id === targetTaskId ? { ...t, is_done: done } : t
        );
        localStorage.setItem(cacheKey, JSON.stringify({ ...parsed, tasks }));
      } catch {
        // キャッシュ書き込み失敗は致命的ではないので握りつぶす
      }
    };
    patchCache(isDone);

    try {
      // 3. GAS（スプシ）に書き込み。
      await apiClient.post({
        action: "updateTask",
        line_id: profile.userId,
        task_id: targetTaskId,
        is_done: isDone,
      });
    } catch (err: any) {
      // 4. 失敗時は画面とキャッシュ両方を元に戻す。
      setTask(previousTask);
      patchCache(!isDone);
      setError("更新に失敗しました。");
      setTimeout(() => setError(null), 3000);
    } finally {
      setUpdating(false);
    }
  };

  if (!isLiffReady || loading) {
    return <Spinner fullScreen />;
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-md bg-surface-page">
        <div className="card-base p-xl w-full text-center animate-fade-in">
          <p className="text-error font-semibold mb-md">{error || "エラーが発生しました"}</p>
          <button onClick={() => router.push("/dashboard")} className="btn-secondary w-full">
            ダッシュボードに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-page flex flex-col">
      {/* Header */}
      <header className="bg-surface px-md py-sm border-b border-border sticky top-0 z-10 flex items-center gap-sm">
        <button
          onClick={() => router.push("/dashboard")}
          className="w-10 h-10 -ml-xs flex items-center justify-center text-neutral-50 hover:bg-neutral-95 rounded-full active:bg-neutral-90 transition-colors"
          aria-label="戻る"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-headline-md text-on-surface">タスク詳細</h1>
      </header>

      <main className="flex-1 p-lg flex flex-col gap-md animate-fade-in">
        <div className="card-base p-lg flex flex-col gap-lg">
          <div>
            <span className="chip-category mb-sm">{task.category}</span>
            <div className="flex items-start gap-sm mt-sm">
              <div className="pt-1">
                <Checkbox checked={task.is_done} onChange={handleToggle} disabled={updating} />
              </div>
              <h2
                className={[
                  "font-display text-display-md leading-tight flex-1",
                  task.is_done ? "text-neutral-50 line-through" : "text-on-surface",
                ].join(" ")}
              >
                {task.task_content}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-xs px-sm py-xs bg-primary-5 rounded-md border border-primary-10">
            <svg className="w-4 h-4 text-primary-70" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .2.08.39.22.53l3 3a.75.75 0 101.06-1.06L10.75 9.69V5z" clipRule="evenodd" />
            </svg>
            <span className="text-body-md text-primary-80 font-medium">
              期限目安: <span className="font-semibold">{task.due_estimate}</span>
            </span>
          </div>

          <div className="h-px bg-border w-full" />

          <div>
            <h3 className="text-label-caps text-neutral-50 mb-xs">メモ / 詳細</h3>
            <p className="text-body-lg text-on-surface whitespace-pre-wrap bg-neutral-98 p-md rounded-md border border-border min-h-[4rem]">
              {task.memo || "特になし"}
            </p>
          </div>

          <div className="h-px bg-border w-full" />

          <div>
            <h3 className="text-label-caps text-neutral-50 mb-xs">
              コメント / ご要望
            </h3>
            <p className="text-body-sm text-neutral-50 mb-xs">
              プランナーへの連絡やご要望があれば入力してください。
            </p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="例: ドレスの色は白を希望しています"
              rows={4}
              className="w-full text-body-lg text-on-surface whitespace-pre-wrap bg-neutral-98 p-md rounded-md border border-border outline-none resize-none focus:border-primary-40"
            />
            <div className="flex items-center gap-sm mt-sm">
              <button
                onClick={saveComment}
                disabled={savingComment}
                className="btn-secondary"
              >
                {savingComment ? "保存中…" : "コメントを保存"}
              </button>
              {commentMsg && (
                <span className="text-body-sm text-primary-70">{commentMsg}</span>
              )}
            </div>
          </div>

          <button
            onClick={() => handleToggle(!task.is_done)}
            disabled={updating}
            className={task.is_done ? "btn-secondary" : "btn-primary"}
          >
            {updating ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : task.is_done ? (
              "未完了に戻す"
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
                完了にする
              </>
            )}
          </button>
        </div>
      </main>

      {error && <ErrorMessage message={error} />}
    </div>
  );
}
