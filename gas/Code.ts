import {
  findCustomer,
  createCustomer,
  getActiveTasks,
  getProgressByLineId,
  upsertProgress,
  ensureProgressRows,
} from "./sheets";
import { ApiResponse, ITaskForClient } from "./types";

function cors(output: GoogleAppsScript.Content.TextOutput): GoogleAppsScript.Content.TextOutput {
  return output;
}

function json(data: ApiResponse): GoogleAppsScript.Content.TextOutput {
  return cors(
    ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
      ContentService.MimeType.JSON
    )
  );
}

function errorResponse(message: string): GoogleAppsScript.Content.TextOutput {
  return json({ status: "error", message });
}

// ── doGet ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function doGet(e: any): GoogleAppsScript.Content.TextOutput {
  try {
    const action = e.parameter?.action as string | undefined;
    const lineId = e.parameter?.line_id as string | undefined;

    if (!lineId) return errorResponse("Unauthorized");

    if (action === "getTasks") {
      return handleGetTasks(lineId);
    }

    return errorResponse("Unknown action");
  } catch (err) {
    return errorResponse(String(err));
  }
}

// ── doPost ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function doPost(e: any): GoogleAppsScript.Content.TextOutput {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any = {};
    try {
      body = JSON.parse(e.postData?.contents ?? "{}");
    } catch {
      return errorResponse("Invalid JSON");
    }

    const action = body.action as string | undefined;
    const lineId = body.line_id as string | undefined;

    if (!lineId) return errorResponse("Unauthorized");

    if (action === "register") {
      return handleRegister(lineId, body.nickname as string);
    }

    if (action === "updateTask") {
      return handleUpdateTask(lineId, body.task_id as string, body.is_done as boolean);
    }

    return errorResponse("Unknown action");
  } catch (err) {
    return errorResponse(String(err));
  }
}

// ── Handlers ────────────────────────────────────────────────────

function handleRegister(
  lineId: string,
  nickname: string
): GoogleAppsScript.Content.TextOutput {
  const existing = findCustomer(lineId);
  if (existing) {
    return json({ status: "exists", nickname: existing.nickname });
  }
  const trimmedNickname = (nickname ?? "").trim();
  if (!trimmedNickname) {
    return json({ status: "exists", nickname: "" });
  }
  createCustomer(lineId, trimmedNickname);

  // Initialize progress rows for all active tasks
  const activeTasks = getActiveTasks();
  ensureProgressRows(lineId, activeTasks);

  return json({ status: "created", nickname: trimmedNickname });
}

function handleGetTasks(lineId: string): GoogleAppsScript.Content.TextOutput {
  const activeTasks = getActiveTasks();

  // Ensure all tasks have progress rows
  ensureProgressRows(lineId, activeTasks);

  const progressRows = getProgressByLineId(lineId);
  const progressMap = new Map(progressRows.map((r) => [r.task_id, r]));

  const tasks: ITaskForClient[] = activeTasks
    .map((t) => {
      const progress = progressMap.get(t.task_id);
      return {
        task_id: t.task_id,
        title: t.title,
        description: t.description,
        manual_url: t.manual_url,
        due_offset_days: t.due_offset_days,
        is_done: progress?.is_done ?? false,
        is_visible: progress?.is_visible ?? true,
      };
    })
    .filter((t) => t.is_visible);

  return json({ tasks });
}

function handleUpdateTask(
  lineId: string,
  taskId: string,
  isDone: boolean
): GoogleAppsScript.Content.TextOutput {
  if (!taskId) return errorResponse("task_id is required");
  upsertProgress(lineId, taskId, isDone);
  return json({ status: "updated" });
}
