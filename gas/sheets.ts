// types.ts interfaces are global

const getSheet = (name: string) => SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);

// Google Sheetsが日付セルをDateオブジェクトとして返すため、"YYYY-MM-DD"形式に変換する
function formatDateCell(value: any): string {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value);
}

function getCustomer(lineId: string): ICustomer | null {
  const sheet = getSheet("customers");
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === lineId) {
      return {
        line_id: String(data[i][0]),
        wedding_date: formatDateCell(data[i][1]),
        created_at: String(data[i][2]),
        name1_kana: String(data[i][3] || ""),
        name2_kana: String(data[i][4] || ""),
        is_admin: data[i][5] === true || String(data[i][5]).toLowerCase() === "true",
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

function updateCustomerNames(lineId: string, name1Kana: string, name2Kana: string): void {
  const sheet = getSheet("customers");
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === lineId) {
      sheet.getRange(i + 1, 4).setValue(name1Kana);
      sheet.getRange(i + 1, 5).setValue(name2Kana);
      return;
    }
  }
};

function getUsers(): ICustomer[] {
  const sheet = getSheet("customers");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const users: ICustomer[] = [];
  for (let i = 1; i < data.length; i++) {
    users.push({
      line_id: String(data[i][0]),
      wedding_date: formatDateCell(data[i][1]),
      created_at: String(data[i][2]),
      name1_kana: String(data[i][3] || ""),
      name2_kana: String(data[i][4] || ""),
      is_admin: data[i][5] === true || String(data[i][5]).toLowerCase() === "true",
    });
  }
  return users;
};

function getUsersWithProgress(): IUserProgress[] {
  const users = getUsers();
  if (users.length === 0) return [];

  const allTasks = getActiveTasks(); // キャッシュ済み

  // task_progress シートを一括読み込み
  const progressSheet = getSheet("task_progress");
  const progressData = progressSheet ? progressSheet.getDataRange().getValues() : [];

  // user_hidden_tasks シートを一括読み込み
  const hiddenSheet = getSheet("user_hidden_tasks");
  const hiddenData = hiddenSheet ? hiddenSheet.getDataRange().getValues() : [];

  return users.map(user => {
    // 非表示タスクを収集
    const hiddenIds = new Set<string>();
    for (let i = 1; i < hiddenData.length; i++) {
      if (String(hiddenData[i][0]) === user.line_id) {
        hiddenIds.add(String(hiddenData[i][1]));
      }
    }

    // 完了状況を収集
    const progressMap = new Map<string, boolean>();
    for (let i = 1; i < progressData.length; i++) {
      if (progressData[i][0] === user.line_id) {
        const isDone = progressData[i][2] === true || String(progressData[i][2]).toLowerCase() === "true";
        progressMap.set(String(progressData[i][1]), isDone);
      }
    }

    // 表示対象タスクを絞り込み
    const visibleTasks = allTasks.filter(t =>
      (!t.target_line_id || t.target_line_id === user.line_id) &&
      !hiddenIds.has(t.task_id)
    );

    const doneCount = visibleTasks.filter(t => progressMap.get(t.task_id) === true).length;

    return {
      ...user,
      total_tasks: visibleTasks.length,
      done_tasks: doneCount,
    };
  });
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
