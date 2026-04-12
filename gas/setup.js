function setupEnvironment() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // 1. customers シートの作成とヘッダー
    let customersSheet = ss.getSheetByName("customers");
    if (!customersSheet) {
        customersSheet = ss.insertSheet("customers");
    }
    customersSheet.getRange("A1:E1").setValues([["line_id", "wedding_date", "created_at", "name1_kana", "name2_kana"]]);
    // 2. task_master シートの作成とヘッダー
    let taskMasterSheet = ss.getSheetByName("task_master");
    if (!taskMasterSheet) {
        taskMasterSheet = ss.insertSheet("task_master");
    }
    taskMasterSheet.getRange("A1:H1").setValues([["task_id", "category", "task_content", "due_formula", "due_estimate", "memo", "is_active", "target_line_id"]]);
    // 初期データの登録（データが空の場合のみ）
    if (taskMasterSheet.getLastRow() <= 1) {
        const INITIAL_TASKS = [
            ["T001", "会場決定", "・会場、日程の決定・お申込書、お内金振り込み", "挙式日 - 180日", "挙式6ヶ月前", "", true, ""],
            ["T002", "手配", "・司会、音響、写真、動画、メイク等の持ち込み有無の確認", "挙式日 - 150日", "挙式5ヶ月前", "", true, ""],
            ["T003", "人数", "・ゲスト人数のカウント（最大数でリストアップ）", "挙式日 - 100日", "挙式3ヶ月半前(招待状発注前)", "", true, ""],
            ["T004", "手配", "・ゲストの飛行機、宿泊の手配有無の確認", "挙式日 - 95日", "挙式約3ヶ月前(招待状発送前)", "", true, ""],
            ["T005", "手配", "・2次会会場の手配（希望エリア、人数）", "挙式日 - 95日", "挙式約3ヶ月前(招待状発送前)", "", true, ""],
            ["T006", "招待状", "・招待状の作成（Web/紙）と発送・案内完了", "挙式日 - 90日", "挙式3ヶ月前", "", true, ""],
            ["T007", "打合せ①", "【第1回打ち合わせ】・進行大枠決定・引き出物の選定・席札・席次表のデザイン・有無決定", "挙式日 - 90日", "挙式3ヶ月前", "", true, ""],
            ["T008", "映像", "・披露宴会場でスクリーン使用有無の決定", "挙式日 - 90日", "挙式3ヶ月前(打合せ①と同日)", "", true, ""],
            ["T009", "打合せ②", "【第2回打ち合わせ】・お花のデザイン決定（会場、ブーケ等）・BGMの選定（披露宴）・写真、映像のお打ち合わせ・ヘアメイクリハーサルの有無決定", "挙式日 - 60日", "挙式2ヶ月前", "", true, ""],
            ["T010", "衣裳", "・衣裳選び（決定）・アクセサリーやインナーなどの購入", "挙式日 - 30日", "挙式1ヶ月前", "", true, ""],
            ["T011", "映像", "・オープニング映像、プロフィール映像、エンドロールの素材提出", "挙式日 - 30日", "挙式1ヶ月前", "", true, ""],
            ["T012", "招待状", "・招待状の返信締切日", "挙式日 - 30日", "挙式1ヶ月前", "", true, ""],
            ["T013", "打合せ③", "【最終打ち合わせ】・進行、持ち物のおさらい", "挙式日 - 21日", "挙式3週間前", "", true, ""],
            ["T014", "最終確定", "・ゲスト人数の最終締切（料理・ドリンク・引き出物の数確定）", "挙式日 - 14日", "挙式2週間前", "", true, ""],
            ["T015", "支払い", "・残額請求お振込", "挙式日 - 7日", "挙式1週間前", "", true, ""],
            ["T016", "当日", "ご結婚式本番！", "挙式日 (±0日)", "当日", "", true, ""]
        ];
        taskMasterSheet.getRange(2, 1, INITIAL_TASKS.length, INITIAL_TASKS[0].length).setValues(INITIAL_TASKS);
    }
    // 3. task_progress シートの作成とヘッダー
    let taskProgressSheet = ss.getSheetByName("task_progress");
    if (!taskProgressSheet) {
        taskProgressSheet = ss.insertSheet("task_progress");
    }
    taskProgressSheet.getRange("A1:E1").setValues([["line_id", "task_id", "is_done", "updated_at", "is_visible"]]);
    // 4. user_hidden_tasks シートの作成とヘッダー
    let userHiddenTasksSheet = ss.getSheetByName("user_hidden_tasks");
    if (!userHiddenTasksSheet) {
        userHiddenTasksSheet = ss.insertSheet("user_hidden_tasks");
    }
    userHiddenTasksSheet.getRange("A1:B1").setValues([["line_id", "task_id"]]);
    return "Setup Completed!";
}
;
