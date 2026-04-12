import { IApiResponse } from "./types";

const GAS_ENDPOINT = process.env.NEXT_PUBLIC_GAS_ENDPOINT || "";

// Mock data list
let MOCK_TASKS: any[] = [
  { task_id: "T001", category: "会場決定", task_content: "・会場、日程の決定・お申込書、お内金振り込み", due_formula: "挙式日 - 180日", due_estimate: "挙式6ヶ月前", memo: "", is_done: false, is_visible: true }
];

export const apiClient = {
  get: async (action: string, lineId: string): Promise<IApiResponse> => {
    if (!GAS_ENDPOINT || GAS_ENDPOINT === "YOUR_GAS_WEB_APP_URL_HERE") {
      if (action === "getTasks") {
        return { status: "ok", tasks: MOCK_TASKS }; 
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
      if (payload.action === "getUser") {
        const date = localStorage.getItem("mock_wedding_date");
        if (date) return {
          status: "exists",
          wedding_date: date,
          name1_kana: localStorage.getItem("mock_name1") || "",
          name2_kana: localStorage.getItem("mock_name2") || "",
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
        return { status: "ok", users: [{ line_id: "mock_user1", wedding_date: "2026-10-10", created_at: "2026-04-10" }] };
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

