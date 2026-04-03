import { IApiResponse } from "./types";

const GAS_ENDPOINT = process.env.NEXT_PUBLIC_GAS_ENDPOINT || "";

// Mock data list
let MOCK_TASKS = [
  { task_id: "T001", title: "招待状リストアップ", description: "テスト説明", manual_url: "", due_offset_days: 90, is_done: false, is_visible: true }
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
      throw new Error(e.message || "Failed to fetch data");
    }
  },

  post: async (payload: any): Promise<IApiResponse> => {
    if (!GAS_ENDPOINT || GAS_ENDPOINT === "YOUR_GAS_WEB_APP_URL_HERE") {
      if (payload.action === "updateTask") {
        MOCK_TASKS = MOCK_TASKS.map(t => t.task_id === payload.task_id ? { ...t, is_done: payload.is_done } : t);
        return { status: "updated" };
      }
      if (payload.action === "register") {
        return { status: "created", nickname: payload.nickname };
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
      throw new Error(e.message || "Failed to post data");
    }
  },
};

