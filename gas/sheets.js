// types.ts interfaces are global
const getSheet = (name) => SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
// ─── Venues ────────────────────────────────────────────────────────
function getVenues() {
    const sheet = getSheet("venues");
    if (!sheet)
        return [];
    const data = sheet.getDataRange().getValues();
    const venues = [];
    for (let i = 1; i < data.length; i++) {
        if (!data[i][0])
            continue;
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
function getVenue(venueId) {
    const venues = getVenues();
    return venues.find(v => v.venue_id === venueId) || null;
}
function getVenueByPlannerId(plannerLineId) {
    const venues = getVenues();
    return venues.find(v => v.planner_line_user_id === plannerLineId) || null;
}
// 失敗時はクライアント側 diagnose() が拾える英文キーワードを含むエラーを投げる。
function createVenue(venue) {
    const sheet = getSheet("venues");
    if (!sheet) {
        throw new Error("venues シートが見つかりません。setupEnvironment を実行してください。");
    }
    if (!venue.venue_id || !venue.venue_name) {
        throw new Error("venue_id と venue_name は必須です");
    }
    if (getVenue(venue.venue_id)) {
        throw new Error(`venue_id "${venue.venue_id}" は already exists`);
    }
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
function updateVenueStatus(venueId, active) {
    const sheet = getSheet("venues");
    if (!sheet)
        return;
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === venueId) {
            sheet.getRange(i + 1, 6).setValue(active);
            return;
        }
    }
}
// ─── Message Drafts ─────────────────────────────────────────────────
function getMessageDrafts(venueId, status) {
    const sheet = getSheet("message_drafts");
    if (!sheet)
        return [];
    const data = sheet.getDataRange().getValues();
    const drafts = [];
    for (let i = 1; i < data.length; i++) {
        if (!data[i][0])
            continue;
        if (String(data[i][1]) !== venueId)
            continue;
        const draftStatus = String(data[i][5]);
        if (status && draftStatus !== status)
            continue;
        drafts.push({
            draft_id: String(data[i][0]),
            venue_id: String(data[i][1]),
            couple_id: String(data[i][2]),
            task_id: String(data[i][3]),
            draft_message: String(data[i][4]),
            status: draftStatus,
            created_at: String(data[i][6]),
            sent_at: String(data[i][7] || ""),
        });
    }
    return drafts;
}
function createMessageDraft(draft) {
    const sheet = getSheet("message_drafts");
    if (!sheet)
        return;
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
function updateDraftStatus(draftId, status) {
    const sheet = getSheet("message_drafts");
    if (!sheet)
        return;
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
function updateDraftMessage(draftId, message) {
    const sheet = getSheet("message_drafts");
    if (!sheet)
        return;
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === draftId) {
            sheet.getRange(i + 1, 5).setValue(message);
            return;
        }
    }
}
// Google Sheetsが日付セルをDateオブジェクトとして返すため、"YYYY-MM-DD"形式に変換する
function formatDateCell(value) {
    if (value instanceof Date) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, "0");
        const d = String(value.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }
    return String(value);
}
function getCustomer(lineId) {
    const sheet = getSheet("customers");
    if (!sheet)
        return null;
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
}
;
function createCustomer(lineId, weddingDate, name1Kana, name2Kana, venueId) {
    const sheet = getSheet("customers");
    if (!sheet)
        return;
    sheet.appendRow([lineId, venueId || "", weddingDate, new Date().toISOString(), name1Kana || "", name2Kana || ""]);
}
;
function updateCustomerNames(lineId, name1Kana, name2Kana) {
    const sheet = getSheet("customers");
    if (!sheet)
        return;
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === lineId) {
            sheet.getRange(i + 1, 5).setValue(name1Kana);
            sheet.getRange(i + 1, 6).setValue(name2Kana);
            return;
        }
    }
}
;
function getUsers(venueId) {
    const sheet = getSheet("customers");
    if (!sheet)
        return [];
    const data = sheet.getDataRange().getValues();
    const users = [];
    for (let i = 1; i < data.length; i++) {
        if (!data[i][0])
            continue;
        const customerVenueId = String(data[i][1] || "");
        if (venueId && customerVenueId !== venueId)
            continue;
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
}
;
function getUsersWithProgress(venueId) {
    const users = getUsers(venueId);
    if (users.length === 0)
        return [];
    const allTasks = getActiveTasks(); // キャッシュ済み
    // task_progress シートを一括読み込み
    const progressSheet = getSheet("task_progress");
    const progressData = progressSheet ? progressSheet.getDataRange().getValues() : [];
    // user_hidden_tasks シートを一括読み込み
    const hiddenSheet = getSheet("user_hidden_tasks");
    const hiddenData = hiddenSheet ? hiddenSheet.getDataRange().getValues() : [];
    return users.map(user => {
        // 非表示タスクを収集
        const hiddenIds = new Set();
        for (let i = 1; i < hiddenData.length; i++) {
            if (String(hiddenData[i][0]) === user.line_id) {
                hiddenIds.add(String(hiddenData[i][1]));
            }
        }
        // 完了状況を収集
        const progressMap = new Map();
        for (let i = 1; i < progressData.length; i++) {
            if (progressData[i][0] === user.line_id) {
                const isDone = progressData[i][2] === true || String(progressData[i][2]).toLowerCase() === "true";
                progressMap.set(String(progressData[i][1]), isDone);
            }
        }
        // 表示対象タスクを絞り込み
        const visibleTasks = allTasks.filter(t => (!t.target_line_id || t.target_line_id === user.line_id) &&
            !hiddenIds.has(t.task_id));
        const doneCount = visibleTasks.filter(t => progressMap.get(t.task_id) === true).length;
        return {
            ...user,
            total_tasks: visibleTasks.length,
            done_tasks: doneCount,
        };
    });
}
;
function getActiveTasks(venueId) {
    const cache = CacheService.getScriptCache();
    const cacheKey = venueId ? `activeTasks_${venueId}` : "activeTasks";
    const cached = cache.get(cacheKey);
    if (cached)
        return JSON.parse(cached);
    const sheet = getSheet("task_master");
    if (!sheet)
        return [];
    const data = sheet.getDataRange().getValues();
    const tasks = [];
    // Newest schema: A=task_id, B=venue_id, C=category, D=task_content, E=due_formula, F=due_estimate, G=memo, H=is_active, I=target_line_id, J=manual_url, K=reminder_message
    // Legacy schema (no venue_id col): A=task_id, B=category, C=task_content, D=due_formula, E=due_estimate, F=memo, G=is_active, H=target_line_id
    const hasVenueCol = data[0].length >= 9;
    const colOffset = hasVenueCol ? 1 : 0;
    const hasManualUrlCol = hasVenueCol && data[0].length >= 10;
    const hasReminderMsgCol = hasVenueCol && data[0].length >= 11;
    for (let i = 1; i < data.length; i++) {
        const taskVenueId = hasVenueCol ? String(data[i][1] || "") : "";
        if (venueId && taskVenueId && taskVenueId !== venueId)
            continue;
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
}
;
// task_master シートに reminder_message 列(K列)を用意し、
// 各タスクの空セルにデフォルトの通知文面を流し込む初期化関数。
// プランナーがスプシで自由に文面を書き換えられるようにし、書き換え済みのものは尊重する(上書きしない)。
// GAS エディタから1度実行する想定。
function setupReminderMessages() {
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
        if (!taskId || !taskContent)
            continue;
        if (!isActive)
            continue;
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
    for (const v of venues)
        cache.remove(`activeTasks_${v.venue_id}`);
    const result = { added, skipped };
    console.log("[setupReminderMessages] " + JSON.stringify(result));
    return result;
}
;
// reminder_message のデフォルト雛形。
// プランナーが書き換える前提なので、丁寧かつ無難な定型文にする。
// メニューからタスク管理表への導線(CTA)を必ず含める。
function buildDefaultReminderMessage(taskContent, dueEstimate) {
    const tail = "\n\n📋 メニューからタスク管理表をご確認いただけます。";
    if (dueEstimate) {
        return `「${taskContent}」のご案内です（${dueEstimate}）。\nお手隙の際にご確認・ご対応をお願いいたします🙇` + tail;
    }
    return `「${taskContent}」のご案内です。\nお手隙の際にご確認・ご対応をお願いいたします🙇` + tail;
}
;
function getTaskProgress(lineId) {
    const cache = CacheService.getScriptCache();
    const cacheKey = "progress_" + lineId;
    const cached = cache.get(cacheKey);
    if (cached)
        return JSON.parse(cached);
    const sheet = getSheet("task_progress");
    if (!sheet)
        return [];
    const data = sheet.getDataRange().getValues();
    // 同じ task_id が複数行ある場合、最新（updated_at が新しい）行だけを採用する。
    // 過去に LockService 無しで重複が積もっていた事象（PDFで RC001-T006 が2行）に対して
    // 読み込み時点でも自己防衛しておく。
    const latest = new Map();
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) !== String(lineId))
            continue;
        const taskId = String(data[i][1]);
        const updatedAt = String(data[i][3] || "");
        const candidate = {
            line_id: String(data[i][0]),
            task_id: taskId,
            is_done: data[i][2] === true || String(data[i][2]).toLowerCase() === "true",
            updated_at: updatedAt,
            is_visible: data[i][4] === true || String(data[i][4]).toLowerCase() === "true" || data[i][4] === "",
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
}
;
// タスク完了状態をスプシに保存する。
// LockService で同時実行をシリアライズしないと、連打や複数タブからの同時POSTで
// 同じ (lineId, taskId) の行が複数 append されてしまう（PDF調査で T006 が2行重複していた事象）。
// また、既に重複行がある状態を見つけたら、ここでまとめて1行に整理する（自己修復）。
// さらに、文字列セルを比較するときは String() で揃える ── スプシは型をよしなに変えてくるので
// === での厳密比較だと「見た目は同じ文字列だが片方が数値」みたいなケースで一致せず append される事故が起きる。
function updateOrCreateTaskProgress(lineId, taskId, isDone) {
    const lock = LockService.getDocumentLock();
    // 連打されても 10 秒待てばだいたい順番に処理できる
    lock.waitLock(10000);
    try {
        const sheet = getSheet("task_progress");
        if (!sheet)
            return;
        const data = sheet.getDataRange().getValues();
        // 同じ (lineId, taskId) の行をすべて拾う（過去の重複に対する自己修復のため）
        const matchedRows = [];
        for (let i = 1; i < data.length; i++) {
            if (String(data[i][0]) === String(lineId) && String(data[i][1]) === String(taskId)) {
                matchedRows.push(i + 1); // setRange は 1-indexed
            }
        }
        if (matchedRows.length === 0) {
            sheet.appendRow([lineId, taskId, isDone, new Date().toISOString(), true]);
        }
        else {
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
    }
    finally {
        lock.releaseLock();
    }
}
;
// 既に重複行が積もってしまったスプシを掃除する手動メンテ関数。
// Apps Script エディタから 1 度だけ実行する想定。
// 同じ (line_id, task_id) が複数あれば、updated_at が最新の行だけ残し、それ以外を削除する。
function cleanupDuplicateTaskProgress() {
    const lock = LockService.getDocumentLock();
    lock.waitLock(20000);
    try {
        const sheet = getSheet("task_progress");
        if (!sheet)
            return { scanned: 0, removed: 0 };
        const data = sheet.getDataRange().getValues();
        // key="lineId|taskId" → そのキーで「最新の updated_at を持つ行 index」
        const latestRowOfKey = new Map();
        const rowsToDelete = [];
        for (let i = 1; i < data.length; i++) {
            const lineId = String(data[i][0] || "");
            const taskId = String(data[i][1] || "");
            if (!lineId || !taskId)
                continue;
            const key = lineId + "|" + taskId;
            const currTime = String(data[i][3] || "");
            if (!latestRowOfKey.has(key)) {
                latestRowOfKey.set(key, i);
                continue;
            }
            const prevIndex = latestRowOfKey.get(key);
            const prevTime = String(data[prevIndex][3] || "");
            // ISO 8601 文字列は辞書順で時刻順にソートできる
            if (currTime > prevTime) {
                rowsToDelete.push(prevIndex + 1);
                latestRowOfKey.set(key, i);
            }
            else {
                rowsToDelete.push(i + 1);
            }
        }
        // 後ろから削除して index ずれを回避
        rowsToDelete.sort((a, b) => b - a);
        for (const r of rowsToDelete)
            sheet.deleteRow(r);
        // 進捗キャッシュは line_id ごとに分かれているため、まとめてクリアできる API がない。
        // 影響を受けた line_id のキャッシュだけ消す。
        const affectedLineIds = new Set();
        for (const key of latestRowOfKey.keys()) {
            affectedLineIds.add(key.split("|")[0]);
        }
        const cache = CacheService.getScriptCache();
        affectedLineIds.forEach(id => cache.remove("progress_" + id));
        const result = { scanned: data.length - 1, removed: rowsToDelete.length };
        // GAS エディタの「実行ログ」に結果を出すため。戻り値だけだと表示されない。
        console.log("[cleanupDuplicateTaskProgress] " + JSON.stringify(result));
        return result;
    }
    finally {
        lock.releaseLock();
    }
}
;
// 指定 line_id の進捗をすべて削除する。
// 「同じ LINE で過去にテストして残ってしまった TRUE が、新規ペア作成後も残って見える」という
// PDF で確認した事象（Ue18f55fa0ff... に RC001-T002/T005/T006 が is_done=TRUE で残存）を
// register 時に解消するために用意。
function deleteAllTaskProgress(lineId) {
    const lock = LockService.getDocumentLock();
    lock.waitLock(10000);
    try {
        const sheet = getSheet("task_progress");
        if (!sheet)
            return 0;
        const data = sheet.getDataRange().getValues();
        const rowsToDelete = [];
        for (let i = 1; i < data.length; i++) {
            if (String(data[i][0]) === String(lineId)) {
                rowsToDelete.push(i + 1);
            }
        }
        rowsToDelete.sort((a, b) => b - a);
        for (const r of rowsToDelete)
            sheet.deleteRow(r);
        CacheService.getScriptCache().remove("progress_" + lineId);
        return rowsToDelete.length;
    }
    finally {
        lock.releaseLock();
    }
}
;
function getHiddenTasks(lineId) {
    const cache = CacheService.getScriptCache();
    const cacheKey = "hidden_" + lineId;
    const cached = cache.get(cacheKey);
    if (cached)
        return new Set(JSON.parse(cached));
    const sheet = getSheet("user_hidden_tasks");
    if (!sheet)
        return new Set();
    const data = sheet.getDataRange().getValues();
    const hidden = new Set();
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === lineId) {
            hidden.add(String(data[i][1]));
        }
    }
    cache.put(cacheKey, JSON.stringify(Array.from(hidden)), 900);
    return hidden;
}
;
function toggleHiddenTask(lineId, taskId, isHidden) {
    const sheet = getSheet("user_hidden_tasks");
    if (!sheet)
        return;
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
}
;
function addCustomTask(task) {
    const sheet = getSheet("task_master");
    if (!sheet)
        return;
    const lastCol = sheet.getLastColumn();
    const hasVenueCol = lastCol >= 9;
    const hasManualUrlCol = lastCol >= 10;
    if (hasVenueCol) {
        const row = [
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
        if (hasManualUrlCol)
            row.push(task.manual_url || "");
        sheet.appendRow(row);
    }
    else {
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
    if (task.venue_id)
        CacheService.getScriptCache().remove(`activeTasks_${task.venue_id}`);
}
;
function updateTaskManualUrl(taskId, manualUrl) {
    const sheet = getSheet("task_master");
    if (!sheet)
        return false;
    const data = sheet.getDataRange().getValues();
    const hasVenueCol = data[0].length >= 9;
    if (!hasVenueCol)
        return false; // legacy 形式は manual_url 非対応
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
            if (venueId)
                cache.remove(`activeTasks_${venueId}`);
            return true;
        }
    }
    return false;
}
;
function deleteCustomTask(taskId) {
    const sheet = getSheet("task_master");
    if (!sheet)
        return;
    const data = sheet.getDataRange().getValues();
    const hasVenueCol = data[0].length >= 9;
    const isActiveCol = hasVenueCol ? 8 : 7;
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === taskId) {
            sheet.getRange(i + 1, isActiveCol).setValue(false);
            CacheService.getScriptCache().remove("activeTasks");
            const venueId = hasVenueCol ? String(data[i][1] || "") : "";
            if (venueId)
                CacheService.getScriptCache().remove(`activeTasks_${venueId}`);
            return;
        }
    }
}
;
