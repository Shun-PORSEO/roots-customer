import { IApiResponse, IMessageDraft, IVenue, IUserProgress } from "./types";

const GAS_ENDPOINT = process.env.NEXT_PUBLIC_GAS_ENDPOINT || "";

let MOCK_TASKS: any[] = [
  { task_id: "T001", category: "会場決定", task_content: "・会場、日程の決定・お申込書、お内金振り込み", due_formula: "挙式日 - 180日", due_estimate: "挙式6ヶ月前", memo: "", is_done: false, is_visible: true, manual_url: "" }
];

const MOCK_VENUES: IVenue[] = [
  { venue_id: "RC001", venue_name: "サンプル式場A", planner_line_user_id: "planner_001", line_channel_access_token: "", line_liff_id: "", active: true, created_at: "2026-01-01" },
  { venue_id: "RC002", venue_name: "サンプル式場B", planner_line_user_id: "planner_002", line_channel_access_token: "", line_liff_id: "", active: true, created_at: "2026-02-01" },
];

const MOCK_DRAFTS: IMessageDraft[] = [
  { draft_id: "draft-001", venue_id: "RC001", couple_id: "mock_user1", task_id: "T001", draft_message: "さくら＆たろう様、招待状発送確認の期限まであと3日です。ご確認をお願いします💍", status: "pending", created_at: new Date().toISOString(), sent_at: "" },
];

export const apiClient = {
  get: async (action: string, lineId: string, venueId?: string): Promise<IApiResponse> => {
    if (!GAS_ENDPOINT || GAS_ENDPOINT === "YOUR_GAS_WEB_APP_URL_HERE") {
      if (action === "getTasks") {
        return { status: "ok", tasks: MOCK_TASKS };
      }
      if (action === "getVenues") {
        return { status: "ok", venues: MOCK_VENUES };
      }
      return { status: "ok" };
    }
    const params = new URLSearchParams({ action, line_id: lineId });
    if (venueId) params.set("venue_id", venueId);
    const url = `${GAS_ENDPOINT}?${params.toString()}`;
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
      if (payload.action === "getUser") {
        const date = typeof localStorage !== "undefined" ? localStorage.getItem("mock_wedding_date") : null;
        if (date) return {
          status: "exists",
          venue_id: localStorage.getItem("mock_venue_id") || "RC001",
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
        if (payload.venue_id) localStorage.setItem("mock_venue_id", payload.venue_id);
        return { status: "created", venue_id: payload.venue_id || "RC001", wedding_date: payload.wedding_date };
      }
      if (payload.action === "getUsers") {
        return { status: "ok", users: [{ line_id: "mock_user1", venue_id: "RC001", wedding_date: "2026-10-10", name1_kana: "さくら", name2_kana: "たろう", created_at: "2026-04-10" }] };
      }
      if (payload.action === "getUsersWithProgress") {
        return { status: "ok", users: [
          { line_id: "mock_user1", venue_id: "RC001", wedding_date: "2026-10-10", name1_kana: "さくら", name2_kana: "たろう", is_admin: false, total_tasks: 20, done_tasks: 8 },
          { line_id: "mock_user2", venue_id: "RC001", wedding_date: "2026-08-15", name1_kana: "はな", name2_kana: "けんた", is_admin: false, total_tasks: 18, done_tasks: 15 },
        ] as IUserProgress[] };
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
      if (payload.action === "getMessageDrafts") {
        const filtered = payload.status ? MOCK_DRAFTS.filter(d => d.status === payload.status) : MOCK_DRAFTS;
        return { status: "ok", drafts: filtered };
      }
      if (payload.action === "updateDraftStatus") {
        const idx = MOCK_DRAFTS.findIndex(d => d.draft_id === payload.draft_id);
        if (idx !== -1) MOCK_DRAFTS[idx].status = payload.draft_status;
        return { status: "updated" };
      }
      if (payload.action === "updateDraftMessage") {
        const idx = MOCK_DRAFTS.findIndex(d => d.draft_id === payload.draft_id);
        if (idx !== -1) MOCK_DRAFTS[idx].draft_message = payload.message;
        return { status: "updated" };
      }
      if (payload.action === "createVenue") {
        MOCK_VENUES.push({ ...payload, active: true, created_at: new Date().toISOString() });
        return { status: "created" };
      }
      if (payload.action === "updateVenueStatus") {
        const idx = MOCK_VENUES.findIndex(v => v.venue_id === payload.venue_id);
        if (idx !== -1) MOCK_VENUES[idx].active = payload.active;
        return { status: "updated" };
      }
      if (payload.action === "getVenueDetail") {
        const venue = MOCK_VENUES.find(v => v.venue_id === payload.venue_id);
        if (!venue) return { status: "error", message: "Venue not found" };
        return { status: "ok", venue, users: [], pending_drafts_count: 1 };
      }
      if (payload.action === "getVenueTasks") {
        const tasks = MOCK_TASKS
          .filter(t => !t.target_line_id)
          .map(t => ({
            task_id: t.task_id,
            category: t.category,
            task_content: t.task_content,
            due_formula: t.due_formula,
            due_estimate: t.due_estimate,
            memo: t.memo,
            is_active: true,
            target_line_id: t.target_line_id || "",
            manual_url: t.manual_url || "",
          }));
        return { status: "ok", tasks };
      }
      if (payload.action === "updateTaskManualUrl") {
        const url = String(payload.manual_url || "");
        if (url && !/^https?:\/\//.test(url)) {
          return { status: "error", message: "URLは http(s):// で始めてください" };
        }
        MOCK_TASKS = MOCK_TASKS.map(t => t.task_id === payload.task_id ? { ...t, manual_url: url } : t);
        return { status: "updated" };
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
