import { IApiResponse } from "./types";
import liff from "@line/liff";

// 「症状 + 対処法」を持つ API エラー（ErrorMessage/InlineApiError が solution を展開する）。
// db バックエンドの統一エラー DTO（{error:{message,hint}}）の hint を solution に載せる。
export class ApiError extends Error {
  constructor(message: string, public solution?: string) {
    super(message);
    this.name = "ApiError";
  }
}

const GAS_ENDPOINT = process.env.NEXT_PUBLIC_GAS_ENDPOINT || "";
// バックエンド切替（縦スライス）: "db" で新スタック(Supabase+Route Handlers)、既定は "gas"。
// api.ts のシグネチャは変えないので呼び出し元(UI)の diff はゼロ = シーム維持の実証。
const BACKEND = process.env.NEXT_PUBLIC_BACKEND || "gas";

// LINE ID Token 検証 → httpOnly セッションを確立（初回 or セッション切れ時）。
// liff_id を添えて送り、サーバーが venue 別の Login チャネル ID で aud 検証する（SaaS化 C2）。
async function ensureLineSession(): Promise<void> {
  const idToken = liff.getIDToken();
  if (!idToken) throw new Error("[auth] LINE ID Token を取得できません");
  const r = await fetch("/api/auth/line", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id_token: idToken,
      liff_id: liff.id ?? process.env.NEXT_PUBLIC_LIFF_ID ?? undefined,
    }),
    credentials: "include",
  });
  if (!r.ok) throw new Error("[auth] セッション確立に失敗しました");
}

// 新スタック(Route Handlers)への共通 fetch。
// 401 なら画面にエラーを出す前にサイレント再認証→1回だけ透過リトライ
// （Design critical: LIFF webview の Cookie ドロップでも「差し替えに気づかせない」）。
async function dbFetch(path: string, init?: RequestInit): Promise<IApiResponse> {
  const call = () => fetch(path, { credentials: "include", ...init });
  let res = await call();
  if (res.status === 401) {
    // LIFF 文脈ならサイレント再認証。管理画面（LIFF 外・メールログイン）では
    // LIFF 再認証は成立しないので、/login への誘導をエラーとして返す。
    try {
      await ensureLineSession();
    } catch {
      throw new ApiError(
        "セッションの有効期限が切れました",
        "管理画面をご利用の場合は /login からログインし直してください。"
      );
    }
    res = await call();
  }
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(
      data?.error?.message || "Failed to fetch data",
      data?.error?.hint
    );
  }
  return data;
}

function dbPost(path: string, body: unknown): Promise<IApiResponse> {
  return dbFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// PATCH /api/tasks。旧 updateTask / updateTaskComment の書き込み経路（カップル自身）。
function dbPatchTaskProgress(body: {
  task_id: string;
  is_done?: boolean;
  comment?: string;
}): Promise<IApiResponse> {
  return dbFetch("/api/tasks", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// プランナー/管理系アクション（POST /api/admin へそのまま中継。line_id は落とす）。
// GAS の ADMIN_ACTIONS と同じ集合 + GAS 未実装だった式場/雛形 CRUD・テスト送信。
const DB_ADMIN_ACTIONS = new Set([
  "getVenues",
  "createVenue", "updateVenue", "updateVenueStatus", "getVenueDetail", "testLineConnection",
  "getVenueTasks", "updateTaskMaster", "addTaskMaster", "updateTaskManualUrl",
  "testSendTask",
  "getUsers", "getUsersWithProgress", "getAdminUserTasks",
  "toggleTaskVisibility", "addCustomTask", "deleteCustomTask",
  "getTaskItems", "addTaskItem", "updateTaskItem", "deleteTaskItem",
  "getTaskItemTemplates", "addTaskItemTemplate",
  "getMessageDrafts", "updateDraftStatus", "updateDraftMessage",
]);

// Mock data list
let MOCK_TASKS: any[] = [
  { task_id: "T001", category: "会場決定", task_content: "・会場、日程の決定・お申込書、お内金振り込み", due_formula: "挙式日 - 180日", due_estimate: "挙式6ヶ月前", memo: "", is_done: false, is_visible: true }
];

let MOCK_VENUES: any[] = [
  { venue_id: "RC001", venue_name: "プリンスホテル", planner_line_user_id: "U_planner_001", line_channel_access_token: "***mock***", line_liff_id: "0000-mock", active: true, created_at: "2026-04-01" },
  { venue_id: "RC002", venue_name: "ヒルトン札幌", planner_line_user_id: "", line_channel_access_token: "***mock***", line_liff_id: "0000-mock", active: true, created_at: "2026-05-10" },
];

let MOCK_TASK_ITEMS: any[] = [
  { item_id: "ITEM-001", task_id: "T003", line_id: "mock_user1", item_name: "メインドレス", quantity: 1, is_done: true, memo: "Takami Bridal で予約済み", created_at: "2026-05-10" },
  { item_id: "ITEM-002", task_id: "T003", line_id: "mock_user1", item_name: "お色直し用ドレス", quantity: 1, is_done: false, memo: "", created_at: "2026-05-10" },
  { item_id: "ITEM-003", task_id: "T005", line_id: "mock_user1", item_name: "招待状", quantity: 60, is_done: false, memo: "ゲスト確定後に発注", created_at: "2026-05-12" },
];

let MOCK_DRAFTS: any[] = [
  { draft_id: "d1", venue_id: "RC001", couple_id: "mock_user1", task_id: "T003", draft_message: "「ドレス試着のご案内」のご案内です。\nお手隙の際にご確認・ご対応をお願いいたします🙇", status: "sent", created_at: "2026-05-25T09:00:00+09:00" },
  { draft_id: "d2", venue_id: "RC001", couple_id: "mock_user2", task_id: "T005", draft_message: "招待状の送付準備をお願いいたします。", status: "sent", created_at: "2026-05-25T09:00:00+09:00" },
  { draft_id: "d3", venue_id: "RC001", couple_id: "mock_user1", task_id: "__OVERDUE_DIGEST__", draft_message: "期限を過ぎているタスクが 2 件あります。", status: "sent", created_at: "2026-05-24T09:00:00+09:00" },
];

export const apiClient = {
  get: async (action: string, lineId: string): Promise<IApiResponse> => {
    // db バックエンドでは新エンドポイントへ。
    // line_id は渡さない（サーバーが検証済みセッションから導出）。
    if (BACKEND === "db") {
      if (action === "getTasksAndUser" || action === "getTasks") {
        return dbFetch("/api/tasks");
      }
      if (action === "getVenues") {
        return dbPost("/api/admin", { action: "getVenues" });
      }
    }
    if (!GAS_ENDPOINT || GAS_ENDPOINT === "YOUR_GAS_WEB_APP_URL_HERE") {
      if (action === "getTasks") {
        return { status: "ok", tasks: MOCK_TASKS };
      }
      if (action === "getTasksAndUser") {
        const date = localStorage.getItem("mock_wedding_date");
        return {
          status: "ok",
          tasks: MOCK_TASKS,
          wedding_date: date || undefined,
          name1_kana: localStorage.getItem("mock_name1") || "",
          name2_kana: localStorage.getItem("mock_name2") || "",
          is_admin: localStorage.getItem("mock_is_admin") === "true",
        };
      }
      if (action === "getVenues") {
        return { status: "ok", venues: MOCK_VENUES };
      }
      return { status: "ok" };
    }
    const url = `${GAS_ENDPOINT}?action=${action}&line_id=${lineId}`;
    try {
      const res = await fetch(url, { method: "GET" });
      const data = await res.json();
      if (data.status === "error") throw new Error(data.message);
      return data;
    } catch (e: any) {
      console.error(`API Error (GET ${action}):`, e);
      throw new Error(`[GET ${action}] ${e.message || "Failed to fetch data"}`);
    }
  },

  post: async (payload: any): Promise<IApiResponse> => {
    // db バックエンドでは全アクションを新エンドポイントへ。
    // line_id は認証情報としては送らない（サーバーが検証済みセッションから導出）。
    // 呼び出し元(UI)の diff はゼロ = api.ts シーム維持。
    if (BACKEND === "db") {
      if (payload.action === "updateTask") {
        return dbPatchTaskProgress({ task_id: payload.task_id, is_done: payload.is_done });
      }
      if (payload.action === "updateTaskComment") {
        return dbPatchTaskProgress({ task_id: payload.task_id, comment: payload.comment });
      }
      if (payload.action === "getUser") {
        // 管理画面が他カップルを照会するケースのみ target を渡す（サーバー側で管理者チェック）。
        // 自分自身の照会では line_id = セッションの本人なので target 指定と等価。
        const target = payload.line_id
          ? `?target_line_id=${encodeURIComponent(payload.line_id)}`
          : "";
        return dbFetch(`/api/user${target}`);
      }
      if (payload.action === "register") {
        return dbPost("/api/user", {
          wedding_date: payload.wedding_date,
          name1_kana: payload.name1_kana,
          name2_kana: payload.name2_kana,
          venue_id: payload.venue_id,
        });
      }
      if (DB_ADMIN_ACTIONS.has(payload.action)) {
        const { line_id: _lineId, ...rest } = payload;
        return dbPost("/api/admin", rest);
      }
      // ここまでに該当しないアクションは未知 → 既存経路(GAS/モック)にフォールスルーする。
    }
    if (!GAS_ENDPOINT || GAS_ENDPOINT === "YOUR_GAS_WEB_APP_URL_HERE") {
      if (payload.action === "updateTask") {
        MOCK_TASKS = MOCK_TASKS.map(t => t.task_id === payload.task_id ? { ...t, is_done: payload.is_done } : t);
        return { status: "updated" };
      }
      if (payload.action === "updateTaskComment") {
        MOCK_TASKS = MOCK_TASKS.map(t => t.task_id === payload.task_id ? { ...t, comment: payload.comment } : t);
        return { status: "updated" };
      }
      if (payload.action === "getUser") {
        const date = localStorage.getItem("mock_wedding_date");
        if (date) return {
          status: "exists",
          wedding_date: date,
          name1_kana: localStorage.getItem("mock_name1") || "",
          name2_kana: localStorage.getItem("mock_name2") || "",
          is_admin: localStorage.getItem("mock_is_admin") === "true",
        };
        return { status: "not_found" };
      }
      if (payload.action === "register") {
        localStorage.setItem("mock_wedding_date", payload.wedding_date);
        localStorage.setItem("mock_name1", payload.name1_kana || "");
        localStorage.setItem("mock_name2", payload.name2_kana || "");
        return { status: "created", wedding_date: payload.wedding_date };
      }
      if (payload.action === "getUsers") {
        return { status: "ok", users: [{ line_id: "mock_user1", wedding_date: "2026-10-10", name1_kana: "さくら", name2_kana: "たろう", created_at: "2026-04-10" }] };
      }
      if (payload.action === "getUsersWithProgress") {
        return { status: "ok", users: [
          { line_id: "mock_user1", wedding_date: "2026-10-10", name1_kana: "さくら", name2_kana: "たろう", is_admin: false, total_tasks: 20, done_tasks: 8 },
          { line_id: "mock_user2", wedding_date: "2026-08-15", name1_kana: "はな", name2_kana: "けんた", is_admin: false, total_tasks: 18, done_tasks: 15 },
        ]};
      }
      if (payload.action === "getAdminUserTasks") {
        return { status: "ok", tasks: MOCK_TASKS }; 
      }
      if (payload.action === "toggleTaskVisibility") {
        MOCK_TASKS = MOCK_TASKS.map(t => t.task_id === payload.task_id ? { ...t, is_visible: payload.is_visible } : t);
        return { status: "updated" };
      }
      if (payload.action === "addCustomTask") {
        MOCK_TASKS.push({ ...payload.task, task_id: "CUST-MOCK", is_done: false, is_visible: true, is_custom: true });
        return { status: "created" };
      }
      if (payload.action === "deleteCustomTask") {
        MOCK_TASKS = MOCK_TASKS.filter(t => t.task_id !== payload.task_id);
        return { status: "deleted" };
      }
      if (payload.action === "createVenue") {
        const newVenue = {
          venue_id: payload.venue_id,
          venue_name: payload.venue_name,
          planner_line_user_id: payload.planner_line_user_id || "",
          line_channel_access_token: payload.line_channel_access_token || "",
          line_liff_id: payload.line_liff_id || "",
          active: true,
          created_at: new Date().toISOString().slice(0, 10),
        };
        MOCK_VENUES.push(newVenue);
        return { status: "created" };
      }
      if (payload.action === "updateVenue") {
        MOCK_VENUES = MOCK_VENUES.map(v =>
          v.venue_id === payload.venue_id ? { ...v, ...payload.patch } : v
        );
        return { status: "updated" };
      }
      if (payload.action === "updateVenueStatus") {
        MOCK_VENUES = MOCK_VENUES.map(v =>
          v.venue_id === payload.venue_id ? { ...v, active: payload.active } : v
        );
        return { status: "updated" };
      }
      if (payload.action === "getMessageDrafts") {
        const drafts = payload.venue_id
          ? MOCK_DRAFTS.filter(d => d.venue_id === payload.venue_id)
          : MOCK_DRAFTS;
        return { status: "ok", drafts };
      }
      if (payload.action === "getVenueTasks") {
        return { status: "ok", tasks: MOCK_TASKS };
      }
      if (payload.action === "updateTaskMaster") {
        MOCK_TASKS = MOCK_TASKS.map(t =>
          t.task_id === payload.task_id ? { ...t, ...payload.patch } : t
        );
        return { status: "updated" };
      }
      // ── task_items (手配物) ──
      if (payload.action === "getTaskItems") {
        const items = MOCK_TASK_ITEMS.filter(
          i => i.line_id === payload.target_line_id
        );
        return { status: "ok", items };
      }
      if (payload.action === "addTaskItem") {
        const item = {
          item_id: "ITEM-" + Date.now(),
          task_id: payload.task_id,
          line_id: payload.target_line_id,
          item_name: payload.item_name || "",
          quantity: Number(payload.quantity) || 1,
          is_done: false,
          memo: payload.memo || "",
          created_at: new Date().toISOString(),
        };
        MOCK_TASK_ITEMS.push(item);
        return { status: "created", item };
      }
      if (payload.action === "updateTaskItem") {
        MOCK_TASK_ITEMS = MOCK_TASK_ITEMS.map(i =>
          i.item_id === payload.item_id ? { ...i, ...payload.patch } : i
        );
        return { status: "updated" };
      }
      if (payload.action === "deleteTaskItem") {
        MOCK_TASK_ITEMS = MOCK_TASK_ITEMS.filter(
          i => i.item_id !== payload.item_id
        );
        return { status: "deleted" };
      }
      if (payload.action === "getTaskItemTemplates") {
        const items = MOCK_TASK_ITEMS.filter(
          i => i.task_id === payload.task_id && (i.line_id === "" || i.line_id == null)
        );
        return { status: "ok", items };
      }
      if (payload.action === "addTaskItemTemplate") {
        const item = {
          item_id: "ITEM-" + Date.now(),
          task_id: payload.task_id,
          line_id: "",
          item_name: payload.item_name || "",
          quantity: Number(payload.quantity) || 1,
          is_done: false,
          memo: payload.memo || "",
          created_at: new Date().toISOString(),
        };
        MOCK_TASK_ITEMS.push(item);
        return { status: "created", item };
      }
      return { status: "ok" };
    }
    try {
      const res = await fetch(GAS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.status === "error") throw new Error(data.message);
      return data;
    } catch (e: any) {
      console.error(`API Error (POST ${payload.action}):`, e);
      throw new Error(`[POST ${payload.action}] ${e.message || "Failed to post data"}`);
    }
  },
};

