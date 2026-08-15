// types.ts interfaces are global

const getSheet = (name: string) => SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);


function getVenueByPlannerId(plannerLineId: string): IVenue | null {
  const venues = getVenues();
  return venues.find(v => v.planner_line_user_id === plannerLineId) || null;
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
  const cache = CacheService.getScriptCache();
  const cacheKey = `customer_${lineId}`;
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const sheet = getSheet("customers");
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === lineId) {
      const customer = {
        line_id: String(data[i][0]),
        venue_id: String(data[i][1] || ""),
        wedding_date: formatDateCell(data[i][2]),
        created_at: String(data[i][3]),
        name1_kana: String(data[i][4] || ""),
        name2_kana: String(data[i][5] || ""),
        is_admin: data[i][6] === true || String(data[i][6]).toLowerCase() === "true",
      };
      cache.put(cacheKey, JSON.stringify(customer), 300);
      return customer;
    }
  }
  return null;
};

function createCustomer(lineId: string, weddingDate: string, name1Kana?: string, name2Kana?: string, venueId?: string): void {
  const sheet = getSheet("customers");
  if (!sheet) return;
  sheet.appendRow([lineId, venueId || "", weddingDate, new Date().toISOString(), name1Kana || "", name2Kana || ""]);
  CacheService.getScriptCache().remove(`customer_${lineId}`);
};

function updateCustomerNames(lineId: string, name1Kana: string, name2Kana: string): void {
  const sheet = getSheet("customers");
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === lineId) {
      sheet.getRange(i + 1, 5).setValue(name1Kana);
      sheet.getRange(i + 1, 6).setValue(name2Kana);
      CacheService.getScriptCache().remove(`customer_${lineId}`);
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
  // Newest schema: A=task_id, B=venue_id, C=category, D=task_content, E=due_formula, F=due_estimate, G=memo, H=is_active, I=target_line_id, J=manual_url, K=reminder_message
  // Legacy schema (no venue_id col): A=task_id, B=category, C=task_content, D=due_formula, E=due_estimate, F=memo, G=is_active, H=target_line_id
  const hasVenueCol = data[0].length >= 9;
  const colOffset = hasVenueCol ? 1 : 0;
  const hasManualUrlCol = hasVenueCol && data[0].length >= 10;
  const hasReminderMsgCol = hasVenueCol && data[0].length >= 11;
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
        reminder_message: hasReminderMsgCol ? String(data[i][9 + colOffset] || "") : "",
      });
    }
  }
  cache.put(cacheKey, JSON.stringify(tasks), 900);
  return tasks;
};

// task_master シートに reminder_message 列(K列)を用意し、
// 各タスクの空セルにデフォルトの通知文面を流し込む初期化関数。
// プランナーがスプシで自由に文面を書き換えられるようにし、書き換え済みのものは尊重する(上書きしない)。
// GAS エディタから1度実行する想定。
function setupReminderMessages(): { added: number; skipped: number } {
  const sheet = getSheet("task_master");
  if (!sheet) {
    console.log("[setupReminderMessages] task_master シートが見つかりません");
    return { added: 0, skipped: 0 };
  }

  // ヘッダーが10列以下なら K 列に "reminder_message" を補う(後方互換)。
  const lastCol = sheet.getLastColumn();
  if (lastCol < 11) {
    sheet.getRange(1, 11).setValue("reminder_message");
  }

  const data = sheet.getDataRange().getValues();
  const hasVenueCol = data[0].length >= 9;
  if (!hasVenueCol) {
    console.log("[setupReminderMessages] レガシースキーマ(venue_id列無し)はサポート対象外です");
    return { added: 0, skipped: 0 };
  }

  let added = 0;
  let skipped = 0;
  for (let i = 1; i < data.length; i++) {
    const taskId = String(data[i][0] || "");
    const taskContent = String(data[i][3] || ""); // D列
    const dueEstimate = String(data[i][5] || ""); // F列
    const isActive = data[i][7] === true || String(data[i][7]).toLowerCase() === "true";
    const existing = String(data[i][10] || ""); // K列

    if (!taskId || !taskContent) continue;
    if (!isActive) continue;
    if (existing.trim() !== "") {
      // 既に文面が入っていれば上書きしない
      skipped++;
      continue;
    }

    const defaultMsg = buildDefaultReminderMessage(taskContent, dueEstimate);
    sheet.getRange(i + 1, 11).setValue(defaultMsg);
    added++;
  }

  // task_master キャッシュを全クリア(venueId 別キーがあるので簡易に全部消す)
  const cache = CacheService.getScriptCache();
  cache.remove("activeTasks");
  // venue 別キャッシュも消す
  const venues = getVenues();
  for (const v of venues) cache.remove(`activeTasks_${v.venue_id}`);

  const result = { added, skipped };
  console.log("[setupReminderMessages] " + JSON.stringify(result));
  return result;
};

// reminder_message のデフォルト雛形。
// プランナーが書き換える前提なので、丁寧かつ無難な定型文にする。
// メニューからタスク管理表への導線(CTA)を必ず含める。
function buildDefaultReminderMessage(taskContent: string, dueEstimate: string): string {
  const tail = "\n\n📋 メニューからタスク管理表をご確認いただけます。";
  if (dueEstimate) {
    return `「${taskContent}」のご案内です（${dueEstimate}）。\nお手隙の際にご確認・ご対応をお願いいたします🙇` + tail;
  }
  return `「${taskContent}」のご案内です。\nお手隙の際にご確認・ご対応をお願いいたします🙇` + tail;
};

function getTaskProgress(lineId: string): ITaskProgress[] {
  const cache = CacheService.getScriptCache();
  const cacheKey = "progress_" + lineId;
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const sheet = getSheet("task_progress");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  // 同じ task_id が複数行ある場合、最新（updated_at が新しい）行だけを採用する。
  // 過去に LockService 無しで重複が積もっていた事象（PDFで RC001-T006 が2行）に対して
  // 読み込み時点でも自己防衛しておく。
  const latest = new Map<string, ITaskProgress>();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== String(lineId)) continue;
    const taskId = String(data[i][1]);
    const updatedAt = String(data[i][3] || "");
    const candidate: ITaskProgress = {
      line_id: String(data[i][0]),
      task_id: taskId,
      is_done: data[i][2] === true || String(data[i][2]).toLowerCase() === "true",
      updated_at: updatedAt,
      is_visible: data[i][4] === true || String(data[i][4]).toLowerCase() === "true" || data[i][4] === "",
      comment: String(data[i][5] || ""), // F列 = カップルのコメント（無い場合は空文字）
    };
    const prev = latest.get(taskId);
    if (!prev || updatedAt > prev.updated_at) {
      latest.set(taskId, candidate);
    }
  }
  const progress = Array.from(latest.values());
  // TTL は短めに（60秒）。トグル直後は updateOrCreateTaskProgress 側で remove するので問題ないが、
  // 別タブ・別端末から開いた時の鮮度を担保するため。
  cache.put(cacheKey, JSON.stringify(progress), 60);
  return progress;
};

// タスク完了状態をスプシに保存する。
// LockService で同時実行をシリアライズしないと、連打や複数タブからの同時POSTで
// 同じ (lineId, taskId) の行が複数 append されてしまう（PDF調査で T006 が2行重複していた事象）。
// また、既に重複行がある状態を見つけたら、ここでまとめて1行に整理する（自己修復）。
// さらに、文字列セルを比較するときは String() で揃える ── スプシは型をよしなに変えてくるので
// === での厳密比較だと「見た目は同じ文字列だが片方が数値」みたいなケースで一致せず append される事故が起きる。
function updateOrCreateTaskProgress(lineId: string, taskId: string, isDone: boolean): void {
  const lock = LockService.getDocumentLock();
  // 連打されても 10 秒待てばだいたい順番に処理できる
  lock.waitLock(10000);
  try {
    const sheet = getSheet("task_progress");
    if (!sheet) return;
    const data = sheet.getDataRange().getValues();

    // 同じ (lineId, taskId) の行をすべて拾う（過去の重複に対する自己修復のため）
    const matchedRows: number[] = [];
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(lineId) && String(data[i][1]) === String(taskId)) {
        matchedRows.push(i + 1); // setRange は 1-indexed
      }
    }

    if (matchedRows.length === 0) {
      sheet.appendRow([lineId, taskId, isDone, new Date().toISOString(), true]);
    } else {
      const firstRow = matchedRows[0];
      sheet.getRange(firstRow, 3).setValue(isDone);
      sheet.getRange(firstRow, 4).setValue(new Date().toISOString());
      sheet.getRange(firstRow, 5).setValue(true); // 既存の is_visible が空のままなら埋める
      // 2行目以降の重複は削除（後ろから消さないと index がずれる）
      for (let j = matchedRows.length - 1; j >= 1; j--) {
        sheet.deleteRow(matchedRows[j]);
      }
    }
    CacheService.getScriptCache().remove("progress_" + lineId);
  } finally {
    lock.releaseLock();
  }
};

// カップルがタスクごとに残すコメントを task_progress の F列に保存する。
// is_done と同じ (line_id, task_id) 行を共有し、進捗行が無ければ作る。
// is_done は触らない（コメントだけ書きたいケースを壊さない）。
function updateTaskComment(lineId: string, taskId: string, comment: string): void {
  const lock = LockService.getDocumentLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet("task_progress");
    if (!sheet) return;
    const data = sheet.getDataRange().getValues();

    let targetRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(lineId) && String(data[i][1]) === String(taskId)) {
        targetRow = i + 1; // setRange は 1-indexed
        break;
      }
    }

    if (targetRow === -1) {
      // 進捗行がまだ無ければ「未完了・コメントあり」で1行作る
      sheet.appendRow([lineId, taskId, false, new Date().toISOString(), true, comment]);
    } else {
      sheet.getRange(targetRow, 6).setValue(comment); // F列 = comment
      sheet.getRange(targetRow, 4).setValue(new Date().toISOString());
    }
    CacheService.getScriptCache().remove("progress_" + lineId);
  } finally {
    lock.releaseLock();
  }
};

// 既に重複行が積もってしまったスプシを掃除する手動メンテ関数。
// Apps Script エディタから 1 度だけ実行する想定。
// 同じ (line_id, task_id) が複数あれば、updated_at が最新の行だけ残し、それ以外を削除する。
function cleanupDuplicateTaskProgress(): { scanned: number; removed: number } {
  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const sheet = getSheet("task_progress");
    if (!sheet) return { scanned: 0, removed: 0 };
    const data = sheet.getDataRange().getValues();

    // key="lineId|taskId" → そのキーで「最新の updated_at を持つ行 index」
    const latestRowOfKey = new Map<string, number>();
    const rowsToDelete: number[] = [];

    for (let i = 1; i < data.length; i++) {
      const lineId = String(data[i][0] || "");
      const taskId = String(data[i][1] || "");
      if (!lineId || !taskId) continue;
      const key = lineId + "|" + taskId;
      const currTime = String(data[i][3] || "");

      if (!latestRowOfKey.has(key)) {
        latestRowOfKey.set(key, i);
        continue;
      }
      const prevIndex = latestRowOfKey.get(key)!;
      const prevTime = String(data[prevIndex][3] || "");
      // ISO 8601 文字列は辞書順で時刻順にソートできる
      if (currTime > prevTime) {
        rowsToDelete.push(prevIndex + 1);
        latestRowOfKey.set(key, i);
      } else {
        rowsToDelete.push(i + 1);
      }
    }

    // 後ろから削除して index ずれを回避
    rowsToDelete.sort((a, b) => b - a);
    for (const r of rowsToDelete) sheet.deleteRow(r);

    // 進捗キャッシュは line_id ごとに分かれているため、まとめてクリアできる API がない。
    // 影響を受けた line_id のキャッシュだけ消す。
    const affectedLineIds = new Set<string>();
    for (const key of latestRowOfKey.keys()) {
      affectedLineIds.add(key.split("|")[0]);
    }
    const cache = CacheService.getScriptCache();
    affectedLineIds.forEach(id => cache.remove("progress_" + id));

    const result = { scanned: data.length - 1, removed: rowsToDelete.length };
    // GAS エディタの「実行ログ」に結果を出すため。戻り値だけだと表示されない。
    console.log("[cleanupDuplicateTaskProgress] " + JSON.stringify(result));
    return result;
  } finally {
    lock.releaseLock();
  }
};

// 指定 line_id の進捗をすべて削除する。
// 「同じ LINE で過去にテストして残ってしまった TRUE が、新規ペア作成後も残って見える」という
// PDF で確認した事象（Ue18f55fa0ff... に RC001-T002/T005/T006 が is_done=TRUE で残存）を
// register 時に解消するために用意。
function deleteAllTaskProgress(lineId: string): number {
  const lock = LockService.getDocumentLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet("task_progress");
    if (!sheet) return 0;
    const data = sheet.getDataRange().getValues();
    const rowsToDelete: number[] = [];
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(lineId)) {
        rowsToDelete.push(i + 1);
      }
    }
    rowsToDelete.sort((a, b) => b - a);
    for (const r of rowsToDelete) sheet.deleteRow(r);
    CacheService.getScriptCache().remove("progress_" + lineId);
    return rowsToDelete.length;
  } finally {
    lock.releaseLock();
  }
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

// ─── task_items（手配物）─────────────────────────────────

function ensureTaskItemsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("task_items");
  if (!sheet) {
    sheet = ss.insertSheet("task_items");
    sheet
      .getRange("A1:H1")
      .setValues([
        [
          "item_id",
          "task_id",
          "line_id",
          "item_name",
          "quantity",
          "is_done",
          "memo",
          "created_at",
        ],
      ]);
  }
  return sheet;
}

function getTaskItems(lineId: string): ITaskItem[] {
  const sheet = ensureTaskItemsSheet();
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const items: ITaskItem[] = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]) === lineId) {
      items.push({
        item_id: String(data[i][0]),
        task_id: String(data[i][1]),
        line_id: String(data[i][2]),
        item_name: String(data[i][3] || ""),
        quantity: Number(data[i][4]) || 1,
        is_done:
          data[i][5] === true ||
          String(data[i][5]).toLowerCase() === "true",
        memo: String(data[i][6] || ""),
        created_at: String(data[i][7] || ""),
      });
    }
  }
  return items;
}

function addTaskItem(
  taskId: string,
  lineId: string,
  itemName: string,
  quantity: number,
  memo?: string
): ITaskItem {
  const sheet = ensureTaskItemsSheet();
  if (!sheet) throw new Error("task_items シートを作成できません");
  const itemId = "ITEM-" + new Date().getTime();
  const createdAt = new Date().toISOString();
  sheet.appendRow([
    itemId,
    taskId,
    lineId,
    itemName,
    quantity,
    false,
    memo || "",
    createdAt,
  ]);
  return {
    item_id: itemId,
    task_id: taskId,
    line_id: lineId,
    item_name: itemName,
    quantity: quantity,
    is_done: false,
    memo: memo || "",
    created_at: createdAt,
  };
}

function updateTaskItem(
  itemId: string,
  patch: Partial<ITaskItem>
): boolean {
  const sheet = ensureTaskItemsSheet();
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === itemId) {
      // 列: item_id / task_id / line_id / item_name / quantity / is_done / memo / created_at
      if (patch.item_name !== undefined)
        sheet.getRange(i + 1, 4).setValue(patch.item_name);
      if (patch.quantity !== undefined)
        sheet.getRange(i + 1, 5).setValue(patch.quantity);
      if (patch.is_done !== undefined)
        sheet.getRange(i + 1, 6).setValue(patch.is_done);
      if (patch.memo !== undefined)
        sheet.getRange(i + 1, 7).setValue(patch.memo);
      return true;
    }
  }
  return false;
}

function deleteTaskItem(itemId: string): boolean {
  const sheet = ensureTaskItemsSheet();
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === itemId) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

/** task_item の所有者 line_id を返す。存在しない場合は null。 */
function getTaskItemLineId(itemId: string): string | null {
  const sheet = ensureTaskItemsSheet();
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === itemId) {
      return String(data[i][2]); // C列 = line_id
    }
  }
  return null;
}

// テンプレ手配物（line_id="" の task_items を task_id で取得）
function getTaskItemTemplates(taskId: string): ITaskItem[] {
  const sheet = ensureTaskItemsSheet();
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const items: ITaskItem[] = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === taskId && String(data[i][2]) === "") {
      items.push({
        item_id: String(data[i][0]),
        task_id: String(data[i][1]),
        line_id: "",
        item_name: String(data[i][3] || ""),
        quantity: Number(data[i][4]) || 1,
        is_done:
          data[i][5] === true ||
          String(data[i][5]).toLowerCase() === "true",
        memo: String(data[i][6] || ""),
        created_at: String(data[i][7] || ""),
      });
    }
  }
  return items;
}

// ─── venues ────────────────────────────────────────────────

function ensureVenuesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("venues");
  if (!sheet) {
    sheet = ss.insertSheet("venues");
    sheet
      .getRange("A1:G1")
      .setValues([
        [
          "venue_id",
          "venue_name",
          "planner_line_user_id",
          "line_channel_access_token",
          "line_liff_id",
          "active",
          "created_at",
        ],
      ]);
  }
  return sheet;
}

function rowToVenue(row: any[]): IVenue {
  return {
    venue_id: String(row[0]),
    venue_name: String(row[1] || ""),
    planner_line_user_id: String(row[2] || ""),
    line_channel_access_token: String(row[3] || ""),
    line_liff_id: String(row[4] || ""),
    active:
      row[5] === true || String(row[5]).toLowerCase() === "true",
    created_at: String(row[6] || ""),
  };
}

function getVenues(): IVenue[] {
  const sheet = ensureVenuesSheet();
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const venues: IVenue[] = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    venues.push(rowToVenue(data[i]));
  }
  return venues;
}

function getVenue(venueId: string): IVenue | null {
  const sheet = ensureVenuesSheet();
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === venueId) return rowToVenue(data[i]);
  }
  return null;
}

function createVenue(v: IVenue): void {
  if (!v.venue_id || !v.venue_name) {
    throw new Error("venue_id と venue_name は必須です");
  }
  if (getVenue(v.venue_id)) {
    throw new Error(`venue_id "${v.venue_id}" は already exists`);
  }
  const sheet = ensureVenuesSheet();
  if (!sheet) return;
  sheet.appendRow([
    v.venue_id,
    v.venue_name,
    v.planner_line_user_id || "",
    v.line_channel_access_token || "",
    v.line_liff_id || "",
    v.active === false ? false : true,
    new Date().toISOString(),
  ]);
}

function updateVenue(venueId: string, patch: Partial<IVenue>): boolean {
  const sheet = ensureVenuesSheet();
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === venueId) {
      // 列: venue_id / venue_name / planner_line_user_id / line_channel_access_token / line_liff_id / active / created_at
      if (patch.venue_name !== undefined)
        sheet.getRange(i + 1, 2).setValue(patch.venue_name);
      if (patch.planner_line_user_id !== undefined)
        sheet.getRange(i + 1, 3).setValue(patch.planner_line_user_id);
      if (patch.line_channel_access_token !== undefined)
        sheet.getRange(i + 1, 4).setValue(patch.line_channel_access_token);
      if (patch.line_liff_id !== undefined)
        sheet.getRange(i + 1, 5).setValue(patch.line_liff_id);
      if (patch.active !== undefined)
        sheet.getRange(i + 1, 6).setValue(patch.active);
      return true;
    }
  }
  return false;
}

function updateVenueStatus(venueId: string, active: boolean): boolean {
  return updateVenue(venueId, { active });
}

// ─── message_drafts ────────────────────────────────────────

function ensureMessageDraftsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("message_drafts");
  if (!sheet) {
    sheet = ss.insertSheet("message_drafts");
    sheet
      .getRange("A1:H1")
      .setValues([
        [
          "draft_id",
          "venue_id",
          "couple_id",
          "task_id",
          "draft_message",
          "status",
          "created_at",
          "sent_at",
        ],
      ]);
  }
  return sheet;
}

function getMessageDrafts(
  venueId?: string,
  status?: string
): IMessageDraft[] {
  const sheet = ensureMessageDraftsSheet();
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const drafts: IMessageDraft[] = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const d: IMessageDraft = {
      draft_id: String(data[i][0]),
      venue_id: String(data[i][1] || ""),
      couple_id: String(data[i][2] || ""),
      task_id: String(data[i][3] || ""),
      draft_message: String(data[i][4] || ""),
      status: String(data[i][5] || "") as IMessageDraft["status"],
      created_at: String(data[i][6] || ""),
      sent_at: String(data[i][7] || ""),
    };
    if (venueId && d.venue_id !== venueId) continue;
    if (status && d.status !== status) continue;
    drafts.push(d);
  }
  return drafts;
}

// updateTaskMaster / addTaskMaster はここにあったが 2026-08-15 に削除。
// 固定の列番号（venue_id 列が無かった頃の並び）で書き込んでおり、現在の
// task_master（11列）では category が venue_id を上書きするなど破壊的だった。
// どこからも呼ばれていない死にコードだったが、踏むと式場の紐づけが壊れるため撤去。
// 正しい実装は dashboard-server.js の updateTaskField / addBaseTask / addVenueTask
// （いずれも _colMap でヘッダー名から列を解決する）。
