import type {
  IRegisterResponse,
  ITasksResponse,
  IUpdateTaskResponse,
} from "./types";

const GAS_ENDPOINT = process.env.NEXT_PUBLIC_GAS_ENDPOINT ?? "";

async function gasGet<T>(params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${GAS_ENDPOINT}?${query}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`HTTP error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function gasPost<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(GAS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`HTTP error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function registerUser(
  line_id: string,
  nickname: string
): Promise<IRegisterResponse> {
  const data = await gasPost<IRegisterResponse>({
    action: "register",
    line_id,
    nickname,
  });
  if (data.status === "error") {
    throw new Error(data.message ?? "登録に失敗しました");
  }
  return data;
}

export async function checkRegistered(
  line_id: string
): Promise<IRegisterResponse> {
  const data = await gasPost<IRegisterResponse>({
    action: "register",
    line_id,
    nickname: "",
  });
  return data;
}

export async function getTasks(line_id: string): Promise<ITasksResponse> {
  const data = await gasGet<ITasksResponse>({
    action: "getTasks",
    line_id,
  });
  if (data.status === "error") {
    throw new Error(data.message ?? "タスクの取得に失敗しました");
  }
  return data;
}

export async function updateTask(
  line_id: string,
  task_id: string,
  is_done: boolean
): Promise<IUpdateTaskResponse> {
  const data = await gasPost<IUpdateTaskResponse>({
    action: "updateTask",
    line_id,
    task_id,
    is_done,
  });
  if (data.status === "error") {
    throw new Error(data.message ?? "タスクの更新に失敗しました");
  }
  return data;
}
