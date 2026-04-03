import { ICustomer, ITaskMaster, ITaskProgress } from "./types";

const getSheet = (name: string) => SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);

export const getCustomer = (lineId: string): ICustomer | null => {
  const sheet = getSheet("customers");
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === lineId) {
      return {
        line_id: String(data[i][0]),
        nickname: String(data[i][1]),
        created_at: String(data[i][2]),
      };
    }
  }
  return null;
};

export const createCustomer = (lineId: string, nickname: string): void => {
  const sheet = getSheet("customers");
  if (!sheet) return;
  sheet.appendRow([lineId, nickname, new Date().toISOString()]);
};

export const getActiveTasks = (): ITaskMaster[] => {
  const sheet = getSheet("task_master");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const tasks: ITaskMaster[] = [];
  for (let i = 1; i < data.length; i++) {
    const isActive = data[i][5] === true || String(data[i][5]).toLowerCase() === "true";
    if (isActive) {
      tasks.push({
        task_id: String(data[i][0]),
        title: String(data[i][1]),
        description: String(data[i][2]),
        manual_url: String(data[i][3]),
        due_offset_days: Number(data[i][4]),
        is_active: true,
      });
    }
  }
  return tasks;
};

export const getTaskProgress = (lineId: string): ITaskProgress[] => {
  const sheet = getSheet("task_progress");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const progress: ITaskProgress[] = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === lineId) {
      progress.push({
        line_id: String(data[i][0]),
        task_id: String(data[i][1]),
        is_done: data[i][2] === true || String(data[i][2]).toLowerCase() === "true",
        updated_at: String(data[i][3]),
        is_visible: data[i][4] === true || String(data[i][4]).toLowerCase() === "true" || data[i][4] === "", // Default true if empty
      });
    }
  }
  return progress;
};

export const updateOrCreateTaskProgress = (lineId: string, taskId: string, isDone: boolean): void => {
  const sheet = getSheet("task_progress");
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === lineId && data[i][1] === taskId) {
      sheet.getRange(i + 1, 3).setValue(isDone);
      sheet.getRange(i + 1, 4).setValue(new Date().toISOString());
      return;
    }
  }
  // Not found, append
  sheet.appendRow([lineId, taskId, isDone, new Date().toISOString(), true]);
};
