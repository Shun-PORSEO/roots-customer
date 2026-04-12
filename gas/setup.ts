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
  const customerRows: any[][] = [];
  const progressRows: any[][] = [];

  for (let i = 0; i < 30; i++) {
    const lineId = "U" + ("dummy" + String(i + 1).padStart(3, "0") + "0000000000000000000000000");
    // 挙式日：-6ヶ月〜+18ヶ月の範囲でランダム
    const offsetDays = Math.floor(Math.random() * (540)) - 180; // -180 〜 +360日
    const weddingDate = new Date(today);
    weddingDate.setDate(weddingDate.getDate() + offsetDays);
    // 土曜日に寄せる
    const dow = weddingDate.getDay();
    if (dow !== 6) weddingDate.setDate(weddingDate.getDate() + (6 - dow));
    const weddingStr = Utilities.formatDate(weddingDate, "Asia/Tokyo", "yyyy-MM-dd");

    const name1 = firstNames[i];
    const name2 = lastNames[i];
    const isAdmin = i === 0; // 先頭の1件だけ管理者
    const createdAt = new Date(weddingDate);
    createdAt.setMonth(createdAt.getMonth() - 8);

    customerRows.push([lineId, weddingStr, createdAt.toISOString(), name1, name2, isAdmin]);

    // タスク進捗：挙式までの残り日数に応じて完了率を決める
    const daysUntil = Math.round((weddingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const allTaskIds = ["T001","T002","T003","T004","T005","T006","T007","T008","T009","T010","T011","T012","T013","T014","T015","T016"];
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
};
