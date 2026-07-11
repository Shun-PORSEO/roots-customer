import { IApiResponse } from "./types";

// 「症状 + 対処法」を持つ API エラー（ErrorMessage/InlineApiError が solution を展開する）。
export class ApiError extends Error {
  constructor(message: string, public solution?: string) {
    super(message);
    this.name = "ApiError";
  }
}

const GAS_ENDPOINT = process.env.NEXT_PUBLIC_GAS_ENDPOINT || "";

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

