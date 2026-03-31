import {
  ICustomerRow,
  ITaskMasterRow,
  ITaskProgressRow,
} from "./types";

const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty(
  "SPREADSHEET_ID"
) ?? "";

function getSheet(name: string): GoogleAppsScript.Spreadsheet.Sheet {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error(`Sheet not found: ${name}`);
  return sheet;
}

// ── customers ──────────────────────────────────────────────────

export function findCustomer(lineId: string): ICustomerRow | null {
  const sheet = getSheet("customers");
  const data = sheet.getDataRange().getValues() as string[][];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === lineId) {
      return {
        line_id: data[i][0],
        nickname: data[i][1],
        created_at: data[i][2],
      };
    }
  }
  return null;
}

export function createCustomer(lineId: string, nickname: string): void {
  const sheet = getSheet("customers");
  sheet.appendRow([lineId, nickname, new Date().toISOString()]);
}

// ── task_master ─────────────────────────────────────────────────

export function getActiveTasks(): ITaskMasterRow[] {
  const sheet = getSheet("task_master");
  const data = sheet.getDataRange().getValues();
  const rows: ITaskMasterRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const isActive = data[i][5];
    if (isActive === true || isActive === "TRUE") {
      rows.push({
        task_id: String(data[i][0]),
        title: String(data[i][1]),
        description: String(data[i][2]),
        manual_url: String(data[i][3]),
        due_offset_days: Number(data[i][4]),
        is_active: true,
      });
    }
  }
  return rows;
}

// ── task_progress ───────────────────────────────────────────────

export function getProgressByLineId(lineId: string): ITaskProgressRow[] {
  const sheet = getSheet("task_progress");
  const data = sheet.getDataRange().getValues();
  const rows: ITaskProgressRow[] = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === lineId) {
      rows.push({
        line_id: String(data[i][0]),
        task_id: String(data[i][1]),
        is_done: data[i][2] === true || data[i][2] === "TRUE",
        updated_at: String(data[i][3]),
        is_visible: data[i][4] !== false && data[i][4] !== "FALSE",
      });
    }
  }
  return rows;
}

export function upsertProgress(
  lineId: string,
  taskId: string,
  isDone: boolean
): void {
  const sheet = getSheet("task_progress");
  const data = sheet.getDataRange().getValues();
  const now = new Date().toISOString();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === lineId && data[i][1] === taskId) {
      sheet.getRange(i + 1, 3).setValue(isDone);
      sheet.getRange(i + 1, 4).setValue(now);
      return;
    }
  }

  // Insert new row
  sheet.appendRow([lineId, taskId, isDone, now, true]);
}

export function ensureProgressRows(lineId: string, tasks: ITaskMasterRow[]): void {
  const existing = getProgressByLineId(lineId).map((r) => r.task_id);
  for (const task of tasks) {
    if (!existing.includes(task.task_id)) {
      upsertProgress(lineId, task.task_id, false);
    }
  }
}
