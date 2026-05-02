function generateDummyData() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // --- customers ---
    const customersSheet = ss.getSheetByName("customers");
    if (!customersSheet) {
        Logger.log("customers シートが見つかりません。先に setupEnvironment を実行してください。");
        return;
    }
    // 既存のダミーデータを削除（2行目以降）
    const lastRow = customersSheet.getLastRow();
    if (lastRow > 1) {
        customersSheet.getRange(2, 1, lastRow - 1, customersSheet.getLastColumn()).clearContent();
    }
    const firstNames = [
        "さくら", "はな", "あかり", "みく", "りな", "ゆい", "まい", "なな", "ひな", "れいな",
        "あおい", "ことは", "みお", "りこ", "のぞみ", "めい", "ひより", "みずき", "えま", "るか",
        "いちか", "こはる", "さな", "ゆな", "みお", "はるか", "りさ", "かな", "しおり", "あやか"
    ];
    const lastNames = [
        "たろう", "けんた", "ゆうき", "しょうた", "りょう", "こうき", "はると", "だいき", "ゆうと", "そうた",
        "けいすけ", "まさや", "たくや", "ひろき", "けんじ", "やまと", "しんじ", "みつき", "かずき", "れん",
        "ゆうすけ", "こうへい", "たいが", "りょうた", "しんた", "あきら", "としき", "なおき", "まこと", "ひでき"
    ];
    // 挙式日を過去〜1.5年後に分散（リアルなシナリオ）
    const today = new Date();
    const customerRows = [];
    const progressRows = [];
    for (let i = 0; i < 30; i++) {
        const lineId = "U" + ("dummy" + String(i + 1).padStart(3, "0") + "0000000000000000000000000");
        // 挙式日：-6ヶ月〜+18ヶ月の範囲でランダム
        const offsetDays = Math.floor(Math.random() * (540)) - 180; // -180 〜 +360日
        const weddingDate = new Date(today);
        weddingDate.setDate(weddingDate.getDate() + offsetDays);
        // 土曜日に寄せる
        const dow = weddingDate.getDay();
        if (dow !== 6)
            weddingDate.setDate(weddingDate.getDate() + (6 - dow));
        const weddingStr = Utilities.formatDate(weddingDate, "Asia/Tokyo", "yyyy-MM-dd");
        const name1 = firstNames[i];
        const name2 = lastNames[i];
        const isAdmin = i === 0; // 先頭の1件だけ管理者
        const createdAt = new Date(weddingDate);
        createdAt.setMonth(createdAt.getMonth() - 8);
        customerRows.push([lineId, "", weddingStr, createdAt.toISOString(), name1, name2, isAdmin]);
        // タスク進捗：挙式までの残り日数に応じて完了率を決める
        const daysUntil = Math.round((weddingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const allTaskIds = ["T001", "T002", "T003", "T004", "T005", "T006", "T007", "T008", "T009", "T010", "T011", "T012", "T013", "T014", "T015", "T016"];
        // 挙式まで日数が少ないほど完了タスクが多い
        const doneRatio = daysUntil < 0 ? 1.0
            : daysUntil < 30 ? 0.85 + Math.random() * 0.15
                : daysUntil < 60 ? 0.65 + Math.random() * 0.2
                    : daysUntil < 90 ? 0.45 + Math.random() * 0.25
                        : daysUntil < 180 ? 0.2 + Math.random() * 0.3
                            : Math.random() * 0.2;
        const doneCount = Math.round(allTaskIds.length * doneRatio);
        for (let t = 0; t < allTaskIds.length; t++) {
            const isDone = t < doneCount;
            progressRows.push([lineId, allTaskIds[t], isDone, new Date().toISOString(), true]);
        }
    }
    // customers に書き込み
    customersSheet.getRange(2, 1, customerRows.length, customerRows[0].length).setValues(customerRows);
    // task_progress をクリアして書き込み
    const progressSheet = ss.getSheetByName("task_progress");
    if (progressSheet) {
        const lastPRow = progressSheet.getLastRow();
        if (lastPRow > 1) {
            progressSheet.getRange(2, 1, lastPRow - 1, progressSheet.getLastColumn()).clearContent();
        }
        progressSheet.getRange(2, 1, progressRows.length, progressRows[0].length).setValues(progressRows);
    }
    // キャッシュをクリア
    CacheService.getScriptCache().remove("activeTasks");
    Logger.log(`✅ ダミーデータ生成完了: ${customerRows.length} 件のお客様、${progressRows.length} 件の進捗データ`);
    return `Done: ${customerRows.length} customers, ${progressRows.length} progress rows`;
}
function setupEnvironment() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // 1. venues シートの作成とヘッダー
    let venuesSheet = ss.getSheetByName("venues");
    if (!venuesSheet) {
        venuesSheet = ss.insertSheet("venues");
    }
    venuesSheet.getRange("A1:G1").setValues([["venue_id", "venue_name", "planner_line_user_id", "line_channel_access_token", "line_liff_id", "active", "created_at"]]);
    // 2. customers シートの作成とヘッダー（venue_id カラム追加）
    let customersSheet = ss.getSheetByName("customers");
    if (!customersSheet) {
        customersSheet = ss.insertSheet("customers");
    }
    customersSheet.getRange("A1:G1").setValues([["line_id", "venue_id", "wedding_date", "created_at", "name1_kana", "name2_kana", "is_admin"]]);
    // 3. task_master シートの作成とヘッダー（K列に reminder_message を含む11列）
    let taskMasterSheet = ss.getSheetByName("task_master");
    if (!taskMasterSheet) {
        taskMasterSheet = ss.insertSheet("task_master");
    }
    taskMasterSheet.getRange("A1:K1").setValues([["task_id", "venue_id", "category", "task_content", "due_formula", "due_estimate", "memo", "is_active", "target_line_id", "manual_url", "reminder_message"]]);
    // 4. task_progress シートの作成とヘッダー
    let taskProgressSheet = ss.getSheetByName("task_progress");
    if (!taskProgressSheet) {
        taskProgressSheet = ss.insertSheet("task_progress");
    }
    taskProgressSheet.getRange("A1:E1").setValues([["line_id", "task_id", "is_done", "updated_at", "is_visible"]]);
    // 5. user_hidden_tasks シートの作成とヘッダー
    let userHiddenTasksSheet = ss.getSheetByName("user_hidden_tasks");
    if (!userHiddenTasksSheet) {
        userHiddenTasksSheet = ss.insertSheet("user_hidden_tasks");
    }
    userHiddenTasksSheet.getRange("A1:B1").setValues([["line_id", "task_id"]]);
    // 6. message_drafts シートの作成とヘッダー
    let messageDraftsSheet = ss.getSheetByName("message_drafts");
    if (!messageDraftsSheet) {
        messageDraftsSheet = ss.insertSheet("message_drafts");
    }
    messageDraftsSheet.getRange("A1:H1").setValues([["draft_id", "venue_id", "couple_id", "task_id", "draft_message", "status", "created_at", "sent_at"]]);
    return "Setup Completed!";
}
;
/**
 * 新規式場登録時に、基本タスク(venue_id 列が空 かつ is_active=true)を
 * その式場用にまるごとコピーする。
 *
 * 設計の肝:
 *   - コピー元は task_master シートの基本タスク行(プランナーが共通定義する雛形)
 *   - 新タスクID は `${venueId}-${元タスクID}` (例: RC001-T001)
 *   - manual_url / reminder_message / category / 期限 / memo もそのまま引き継ぐ
 *   - 後から各式場の管理者が各タスクを自由に書き換えられる(独立した行になるので衝突しない)
 *   - **再実行可能**: 既に同じ task_id がある式場では skip するので、
 *     基本タスクが後から追加された場合は本関数を再実行するだけで不足分が補充される
 */
function setupDefaultTaskMaster(venueId) {
    const sheet = getSheet("task_master");
    if (!sheet)
        return { added: 0, skipped: 0 };
    const data = sheet.getDataRange().getValues();
    if (data.length < 2)
        return { added: 0, skipped: 0 };
    const hasVenueCol = data[0].length >= 9;
    if (!hasVenueCol) {
        console.log("[setupDefaultTaskMaster] レガシースキーマ(venue_id列無し)はサポート対象外");
        return { added: 0, skipped: 0 };
    }
    const hasManualUrlCol = data[0].length >= 10;
    const hasReminderMsgCol = data[0].length >= 11;
    // 既存の task_id 集合を作って衝突を回避(再実行時の skip 判定用)
    const existingTaskIds = new Set();
    for (let i = 1; i < data.length; i++) {
        const id = String(data[i][0] || "");
        if (id)
            existingTaskIds.add(id);
    }
    const newRows = [];
    let skipped = 0;
    for (let i = 1; i < data.length; i++) {
        const baseTaskId = String(data[i][0] || "");
        const baseVenueId = String(data[i][1] || "");
        const isActive = data[i][7] === true || String(data[i][7]).toLowerCase() === "true";
        if (!baseTaskId)
            continue;
        if (baseVenueId !== "")
            continue; // 基本タスク以外(他式場の固有タスク等)は除外
        if (!isActive)
            continue;
        const newTaskId = `${venueId}-${baseTaskId}`;
        if (existingTaskIds.has(newTaskId)) {
            // 既にこの式場用にコピー済み → 再実行時は触らない(管理者が編集した内容を守る)
            skipped++;
            continue;
        }
        newRows.push([
            newTaskId,
            venueId,
            String(data[i][2] || ""), // category
            String(data[i][3] || ""), // task_content
            String(data[i][4] || ""), // due_formula
            String(data[i][5] || ""), // due_estimate
            String(data[i][6] || ""), // memo
            true, // is_active
            "", // target_line_id (式場用は基本的に空)
            hasManualUrlCol ? String(data[i][9] || "") : "", // manual_url を引き継ぎ
            hasReminderMsgCol ? String(data[i][10] || "") : "", // reminder_message を引き継ぎ
        ]);
    }
    if (newRows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
    }
    // 該当式場と全体のキャッシュを念のため両方クリア
    const cache = CacheService.getScriptCache();
    cache.remove("activeTasks");
    cache.remove(`activeTasks_${venueId}`);
    const result = { added: newRows.length, skipped };
    console.log(`[setupDefaultTaskMaster ${venueId}] ` + JSON.stringify(result));
    return result;
}
/**
 * 既存の全式場に対して setupDefaultTaskMaster を再実行するメンテ関数。
 * 基本タスクを後から追加・修正した時、既存式場の不足分だけ補充するために使う。
 * GASエディタから手動実行する想定。
 */
function syncAllVenuesWithBaseTasks() {
    const venues = getVenues();
    let totalAdded = 0;
    let totalSkipped = 0;
    for (const v of venues) {
        const r = setupDefaultTaskMaster(v.venue_id);
        totalAdded += r.added;
        totalSkipped += r.skipped;
    }
    const summary = { venues: venues.length, added: totalAdded, skipped: totalSkipped };
    console.log("[syncAllVenuesWithBaseTasks] " + JSON.stringify(summary));
    return summary;
}
