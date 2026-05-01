// types.ts interfaces are global

const getSheet = (name: string) => SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);

// ─── Venues ────────────────────────────────────────────────────────

function getVenues(): IVenue[] {
  const sheet = getSheet("venues");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const venues: IVenue[] = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    venues.push({
      venue_id: String(data[i][0]),
      venue_name: String(data[i][1]),
      planner_line_user_id: String(data[i][2]),
      line_channel_access_token: String(data[i][3]),
      line_liff_id: String(data[i][4]),
      active: data[i][5] === true || String(data[i][5]).toLowerCase() === "true",
      created_at: String(data[i][6]),
    });
  }
  return venues;
}

function getVenue(venueId: string): IVenue | null {
  const venues = getVenues();
  return venues.find(v => v.venue_id === venueId) || null;
}

function getVenueByPlannerId(plannerLineId: string): IVenue | null {
  const venues = getVenues();
  return venues.find(v => v.planner_line_user_id === plannerLineId) || null;
}

function createVenue(venue: Omit<IVenue, "created_at">): void {
  const sheet = getSheet("venues");
  if (!sheet) return;
  sheet.appendRow([
    venue.venue_id,
    venue.venue_name,
    venue.planner_line_user_id,
    venue.line_channel_access_token,
    venue.line_liff_id,
    venue.active,
    new Date().toISOString(),
  ]);
}

function updateVenueStatus(venueId: string, active: boolean): void {
  const sheet = getSheet("venues");
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === venueId) {
      sheet.getRange(i + 1, 6).setValue(active);
      return;
    }
  }
}

// ─── Message Drafts ─────────────────────────────────────────────────

function getMessageDrafts(venueId: string, status?: string): IMessageDraft[] {
  const sheet = getSheet("message_drafts");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const drafts: IMessageDraft[] = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    if (String(data[i][1]) !== venueId) continue;
    const draftStatus = String(data[i][5]);
    if (status && draftStatus !== status) continue;
    drafts.push({
      draft_id: String(data[i][0]),
      venue_id: String(data[i][1]),
      couple_id: String(data[i][2]),
      task_id: String(data[i][3]),
      draft_message: String(data[i][4]),
      status: draftStatus as IMessageDraft["status"],
      created_at: String(data[i][6]),
      sent_at: String(data[i][7] || ""),
    });
  }
  return drafts;
}

function createMessageDraft(draft: Omit<IMessageDraft, "created_at" | "sent_at">): void {
  const sheet = getSheet("message_drafts");
  if (!sheet) return;
  sheet.appendRow([
    draft.draft_id,
    draft.venue_id,
    draft.couple_id,
    draft.task_id,
    draft.draft_message,
    draft.status,
    new Date().toISOString(),
    "",
  ]);
}

function updateDraftStatus(draftId: string, status: IMessageDraft["status"]): void {
  const sheet = getSheet("message_drafts");
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === draftId) {
      sheet.getRange(i + 1, 6).setValue(status);
      if (status === "sent") {
        sheet.getRange(i + 1, 8).setValue(new Date().toISOString());
      }
      return;
    }
  }
}

function updateDraftMessage(draftId: string, message: string): void {
  const sheet = getSheet("message_drafts");
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === draftId) {
      sheet.getRange(i + 1, 5).setValue(message);
      return;
    }
  }
}

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
        venue_id: String(data[i][1] || ""),
        wedding_date: formatDateCell(data[i][2]),
        created_at: String(data[i][3]),
        name1_kana: String(data[i][4] || ""),
        name2_kana: String(data[i][5] || ""),
        is_admin: data[i][6] === true || String(data[i][6]).toLowerCase() === "true",
      };
    }
  }
  return null;
};

function createCustomer(lineId: string, weddingDate: string, name1Kana?: string, name2Kana?: string, venueId?: string): void {
  const sheet = getSheet("customers");
  if (!sheet) return;
  sheet.appendRow([lineId, venueId || "", weddingDate, new Date().toISOString(), name1Kana || "", name2Kana || ""]);
};

function updateCustomerNames(lineId: string, name1Kana: string, name2Kana: string): void {
  const sheet = getSheet("customers");
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === lineId) {
      sheet.getRange(i + 1, 5).setValue(name1Kana);
      sheet.getRange(i + 1, 6).setValue(name2Kana);
      return;
    }
  }
};

function getUsers(venueId?: string): ICustomer[] {
  const sheet = getSheet("customers");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const users: ICustomer[] = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const customerVenueId = String(data[i][1] || "");
    if (venueId && customerVenueId !== venueId) continue;
    users.push({
      line_id: String(data[i][0]),
      venue_id: customerVenueId,
      wedding_date: formatDateCell(data[i][2]),
      created_at: String(data[i][3]),
      name1_kana: String(data[i][4] || ""),
      name2_kana: String(data[i][5] || ""),
      is_admin: data[i][6] === true || String(data[i][6]).toLowerCase() === "true",
    });
  }
  return users;
};

function getUsersWithProgress(venueId?: string): IUserProgress[] {
  const users = getUsers(venueId);
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

function getActiveTasks(venueId?: string): ITaskMaster[] {
  const cache = CacheService.getScriptCache();
  const cacheKey = venueId ? `activeTasks_${venueId}` : "activeTasks";
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const sheet = getSheet("task_master");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const tasks: ITaskMaster[] = [];
  // Newest schema: A=task_id, B=venue_id, C=category, D=task_content, E=due_formula, F=due_estimate, G=memo, H=is_active, I=target_line_id, J=manual_url
  // Legacy schema (no venue_id col): A=task_id, B=category, C=task_content, D=due_formula, E=due_estimate, F=memo, G=is_active, H=target_line_id
  const hasVenueCol = data[0].length >= 9;
  const colOffset = hasVenueCol ? 1 : 0;
  const hasManualUrlCol = hasVenueCol && data[0].length >= 10;
  for (let i = 1; i < data.length; i++) {
    const taskVenueId = hasVenueCol ? String(data[i][1] || "") : "";
    if (venueId && taskVenueId && taskVenueId !== venueId) continue;

    const isActive = data[i][6 + colOffset] === true || String(data[i][6 + colOffset]).toLowerCase() === "true";
    if (isActive) {
      tasks.push({
        task_id: String(data[i][0]),
        category: String(data[i][1 + colOffset]),
        task_content: String(data[i][2 + colOffset]),
        due_formula: String(data[i][3 + colOffset]),
        due_estimate: String(data[i][4 + colOffset]),
        memo: String(data[i][5 + colOffset]),
        is_active: true,
        target_line_id: String(data[i][7 + colOffset] || ""),
        manual_url: hasManualUrlCol ? String(data[i][8 + colOffset] || "") : "",
      });
    }
  }
  cache.put(cacheKey, JSON.stringify(tasks), 900);
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

function addCustomTask(task: ITaskMaster & { venue_id?: string }): void {
  const sheet = getSheet("task_master");
  if (!sheet) return;
  const lastCol = sheet.getLastColumn();
  const hasVenueCol = lastCol >= 9;
  const hasManualUrlCol = lastCol >= 10;
  if (hasVenueCol) {
    const row: any[] = [
      task.task_id,
      task.venue_id || "",
      task.category,
      task.task_content,
      task.due_formula,
      task.due_estimate,
      task.memo,
      task.is_active,
      task.target_line_id || ""
    ];
    if (hasManualUrlCol) row.push(task.manual_url || "");
    sheet.appendRow(row);
  } else {
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
  }
  CacheService.getScriptCache().remove("activeTasks");
  if (task.venue_id) CacheService.getScriptCache().remove(`activeTasks_${task.venue_id}`);
};

function updateTaskManualUrl(taskId: string, manualUrl: string): boolean {
  const sheet = getSheet("task_master");
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  const hasVenueCol = data[0].length >= 9;
  if (!hasVenueCol) return false; // legacy 形式は manual_url 非対応
  const manualUrlCol = 10; // J列
  // ヘッダーが10列に届いていなければ "manual_url" を補う
  if (data[0].length < manualUrlCol) {
    sheet.getRange(1, manualUrlCol).setValue("manual_url");
  }
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === taskId) {
      sheet.getRange(i + 1, manualUrlCol).setValue(manualUrl || "");
      const venueId = String(data[i][1] || "");
      const cache = CacheService.getScriptCache();
      cache.remove("activeTasks");
      if (venueId) cache.remove(`activeTasks_${venueId}`);
      return true;
    }
  }
  return false;
};

function deleteCustomTask(taskId: string): void {
  const sheet = getSheet("task_master");
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const hasVenueCol = data[0].length >= 9;
  const isActiveCol = hasVenueCol ? 8 : 7;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === taskId) {
      sheet.getRange(i + 1, isActiveCol).setValue(false);
      CacheService.getScriptCache().remove("activeTasks");
      const venueId = hasVenueCol ? String(data[i][1] || "") : "";
      if (venueId) CacheService.getScriptCache().remove(`activeTasks_${venueId}`);
      return;
    }
  }
};
