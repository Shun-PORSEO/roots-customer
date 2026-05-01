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
        customerRows.push([lineId, weddingStr, createdAt.toISOString(), name1, name2, isAdmin]);
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
    // 3. task_master シートの作成とヘッダー
    let taskMasterSheet = ss.getSheetByName("task_master");
    if (!taskMasterSheet) {
        taskMasterSheet = ss.insertSheet("task_master");
    }
    taskMasterSheet.getRange("A1:J1").setValues([["task_id", "venue_id", "category", "task_content", "due_formula", "due_estimate", "memo", "is_active", "target_line_id", "manual_url"]]);
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
 * 新規式場登録時にデフォルトタスクマスターを自動挿入する。
 * RC仕様の10タスクをセットする。
 */
function setupDefaultTaskMaster(venueId) {
    const sheet = getSheet("task_master");
    if (!sheet)
        return;
    const DEFAULT_TASKS = [
        [`${venueId}-T001`, venueId, "general", "ご挨拶・初回ご連絡", "挙式日 - 180日", "挙式6ヶ月前", "", true, "", ""],
        [`${venueId}-T002`, venueId, "dress", "ドレス試着のご案内", "挙式日 - 150日", "挙式5ヶ月前", "", true, "", ""],
        [`${venueId}-T003`, venueId, "catering", "お料理試食のご案内", "挙式日 - 120日", "挙式4ヶ月前", "", true, "", ""],
        [`${venueId}-T004`, venueId, "general", "招待状発送確認", "挙式日 - 90日", "挙式3ヶ月前", "", true, "", ""],
        [`${venueId}-T005`, venueId, "dress", "ドレス最終確認", "挙式日 - 60日", "挙式2ヶ月前", "", true, "", ""],
        [`${venueId}-T006`, venueId, "general", "席次表・引き出物確認", "挙式日 - 45日", "挙式1ヶ月半前", "", true, "", ""],
        [`${venueId}-T007`, venueId, "ceremony", "最終打ち合わせ", "挙式日 - 30日", "挙式1ヶ月前", "", true, "", ""],
        [`${venueId}-T008`, venueId, "general", "2週間前ご確認", "挙式日 - 14日", "挙式2週間前", "", true, "", ""],
        [`${venueId}-T009`, venueId, "ceremony", "1週間前リマインド", "挙式日 - 7日", "挙式1週間前", "", true, "", ""],
        [`${venueId}-T010`, venueId, "ceremony", "前日ご確認", "挙式日 - 1日", "挙式前日", "", true, "", ""],
    ];
    sheet.getRange(sheet.getLastRow() + 1, 1, DEFAULT_TASKS.length, DEFAULT_TASKS[0].length).setValues(DEFAULT_TASKS);
    CacheService.getScriptCache().remove("activeTasks");
}
