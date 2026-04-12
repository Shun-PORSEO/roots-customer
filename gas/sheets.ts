// types.ts interfaces are global

const getSheet = (name: string) => SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);

function getCustomer(lineId: string): ICustomer | null {
  const sheet = getSheet("customers");
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === lineId) {
      return {
        line_id: String(data[i][0]),
        wedding_date: String(data[i][1]),
        created_at: String(data[i][2]),
        name1_kana: String(data[i][3] || ""),
        name2_kana: String(data[i][4] || ""),
      };
    }
  }
  return null;
};

function createCustomer(lineId: string, weddingDate: string, name1Kana?: string, name2Kana?: string): void {
  const sheet = getSheet("customers");
  if (!sheet) return;
  sheet.appendRow([lineId, weddingDate, new Date().toISOString(), name1Kana || "", name2Kana || ""]);
};

function getUsers(): ICustomer[] {
  const sheet = getSheet("customers");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const users: ICustomer[] = [];
  for (let i = 1; i < data.length; i++) {
    users.push({
      line_id: String(data[i][0]),
      wedding_date: String(data[i][1]),
      created_at: String(data[i][2]),
      name1_kana: String(data[i][3] || ""),
      name2_kana: String(data[i][4] || ""),
    });
  }
  return users;
};

function getActiveTasks(): ITaskMaster[] {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("activeTasks");
  if (cached) return JSON.parse(cached);

  const sheet = getSheet("task_master");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const tasks: ITaskMaster[] = [];
  for (let i = 1; i < data.length; i++) {
    const isActive = data[i][6] === true || String(data[i][6]).toLowerCase() === "true";
    if (isActive) {
      tasks.push({
        task_id: String(data[i][0]),
        category: String(data[i][1]),
        task_content: String(data[i][2]),
        due_formula: String(data[i][3]),
        due_estimate: String(data[i][4]),
        memo: String(data[i][5]),
        is_active: true,
        target_line_id: String(data[i][7] || ""),
      });
    }
  }
  cache.put("activeTasks", JSON.stringify(tasks), 900); // 15 mins
  return tasks;
};

function getTaskProgress(lineId: string): ITaskProgress[] {
  const cache = CacheService.getScriptCache();
  const cacheKey = "progress_" + lineId;
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

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
  cache.put(cacheKey, JSON.stringify(progress), 900);
  return progress;
};

function updateOrCreateTaskProgress(lineId: string, taskId: string, isDone: boolean): void {
  const sheet = getSheet("task_progress");
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === lineId && data[i][1] === taskId) {
      sheet.getRange(i + 1, 3).setValue(isDone);
      sheet.getRange(i + 1, 4).setValue(new Date().toISOString());
      found = true;
      break;
    }
  }
  if (!found) {
    sheet.appendRow([lineId, taskId, isDone, new Date().toISOString(), true]);
  }
  CacheService.getScriptCache().remove("progress_" + lineId);
};

function getHiddenTasks(lineId: string): Set<string> {
  const cache = CacheService.getScriptCache();
  const cacheKey = "hidden_" + lineId;
  const cached = cache.get(cacheKey);
  if (cached) return new Set(JSON.parse(cached));

  const sheet = getSheet("user_hidden_tasks");
  if (!sheet) return new Set();
  const data = sheet.getDataRange().getValues();
  const hidden = new Set<string>();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === lineId) {
      hidden.add(String(data[i][1]));
    }
  }
  cache.put(cacheKey, JSON.stringify(Array.from(hidden)), 900);
  return hidden;
};

function toggleHiddenTask(lineId: string, taskId: string, isHidden: boolean): void {
  const sheet = getSheet("user_hidden_tasks");
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  
  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === lineId && String(data[i][1]) === taskId) {
      if (!isHidden) {
        sheet.deleteRow(i + 1);
      }
      found = true;
      break;
    }
  }
  
  if (!found && isHidden) {
    sheet.appendRow([lineId, taskId]);
  }
  CacheService.getScriptCache().remove("hidden_" + lineId);
};

function addCustomTask(task: ITaskMaster): void {
  const sheet = getSheet("task_master");
  if (!sheet) return;
  sheet.appendRow([
    task.task_id, 
    task.category, 
    task.task_content, 
    task.due_formula, 
    task.due_estimate, 
    task.memo, 
    task.is_active, 
    task.target_line_id || ""
  ]);
  CacheService.getScriptCache().remove("activeTasks");
};

function deleteCustomTask(taskId: string): void {
  const sheet = getSheet("task_master");
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === taskId) {
      sheet.getRange(i + 1, 7).setValue(false);
      CacheService.getScriptCache().remove("activeTasks");
      return;
    }
  }
};
