/**
 * リマインド通知モジュール (GAS用)
 *
 * setupRemindTrigger() を一度GASエディタから実行すると、
 * 毎朝 9:00 に sendReminders() が自動実行される。
 *
 * 必要なスクリプトプロパティ:
 *   LINE_CHANNEL_ACCESS_TOKEN  : LINE チャネルアクセストークン
 *   LIFF_URL                   : アプリURL (例: https://liff.line.me/xxxx)
 */
// ─── 日付ユーティリティ ────────────────────────────────────────────
/** "挙式日 - 180日" / "挙式日 - 6ヶ月" を解析して Date を返す */
function calcDueDate(formula, weddingDateStr) {
    if (!formula || !weddingDateStr)
        return null;
    const parts = weddingDateStr.split("-");
    if (parts.length !== 3)
        return null;
    const wedding = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const dayMatch = formula.match(/挙式日\s*[-−]\s*(\d+)\s*日/);
    if (dayMatch) {
        const result = new Date(wedding);
        result.setDate(result.getDate() - parseInt(dayMatch[1]));
        return result;
    }
    const monthMatch = formula.match(/挙式日\s*[-−]\s*(\d+)\s*[ヶか]月/);
    if (monthMatch) {
        const result = new Date(wedding);
        result.setMonth(result.getMonth() - parseInt(monthMatch[1]));
        return result;
    }
    if (formula.trim() === "挙式日")
        return new Date(wedding);
    return null;
}
/** 今日から targetDate までの日数（当日=0、過去は負値） */
function daysUntil(targetDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
/** Date → "YYYY年M月D日（曜）" */
function formatDateJP(date) {
    const DOWS = ["日", "月", "火", "水", "木", "金", "土"];
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${DOWS[date.getDay()]}）`;
}
// ─── LINE Push API ────────────────────────────────────────────────
function pushLineMessage(userId, text) {
    const token = PropertiesService.getScriptProperties()
        .getProperty("LINE_CHANNEL_ACCESS_TOKEN") || "";
    if (!token) {
        console.error("LINE_CHANNEL_ACCESS_TOKEN が未設定です");
        return;
    }
    const options = {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: `Bearer ${token}` },
        payload: JSON.stringify({
            to: userId,
            messages: [{ type: "text", text }],
        }),
        muteHttpExceptions: true,
    };
    try {
        const res = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", options);
        if (res.getResponseCode() !== 200) {
            console.error(`LINE Push失敗 (${userId}):`, res.getContentText());
        }
    }
    catch (e) {
        console.error(`LINE Push例外 (${userId}):`, e);
    }
}
// ─── メイン処理 ────────────────────────────────────────────────────
/**
 * 毎日定時に呼び出されるリマインド送信関数。
 * 期限の 3日前・2日前・1日前・当日 に未完了タスクを通知する。
 */
function sendReminders() {
    const liffUrl = PropertiesService.getScriptProperties()
        .getProperty("LIFF_URL") || "";
    const customers = getUsers();
    const allTasks = getActiveTasks();
    let sentCount = 0;
    for (const customer of customers) {
        if (!customer.wedding_date)
            continue;
        const progressData = getTaskProgress(customer.line_id);
        const doneTasks = new Set(progressData.filter(p => p.is_done).map(p => p.task_id));
        // 該当ユーザーのタスク（共通 + 個別）
        const customerTasks = allTasks.filter(t => !t.target_line_id || t.target_line_id === customer.line_id);
        // 期限 0〜3日以内の未完了タスクを収集
        const remindItems = [];
        for (const task of customerTasks) {
            if (doneTasks.has(task.task_id))
                continue;
            const dueDate = calcDueDate(task.due_formula, customer.wedding_date);
            if (!dueDate)
                continue;
            const days = daysUntil(dueDate);
            if (days >= 0 && days <= 3) {
                remindItems.push({ task, days, dueDate });
            }
        }
        if (remindItems.length === 0)
            continue;
        // メッセージ組み立て
        const name1 = customer.name1_kana || "";
        const name2 = customer.name2_kana || "";
        const coupleLabel = name1 && name2 ? `${name1}＆${name2}` : "お二人";
        const lines = [
            `${coupleLabel}さん、結婚式準備のリマインドです💍`,
            "",
        ];
        for (const { task, days, dueDate } of remindItems) {
            const daysLabel = days === 0 ? "今日が期限です！" : `あと${days}日`;
            lines.push(`📌 【${task.category}】`);
            lines.push(`${task.task_content}`);
            lines.push(`⏰ ${formatDateJP(dueDate)}（${daysLabel}）`);
            lines.push("");
        }
        if (liffUrl) {
            lines.push("▶ タスクを確認する");
            lines.push(liffUrl);
        }
        const message = lines.join("\n").trim();
        pushLineMessage(customer.line_id, message);
        sentCount++;
        // LINE API レート制限対策（1秒待機）
        if (customers.indexOf(customer) < customers.length - 1) {
            Utilities.sleep(1000);
        }
    }
    console.log(`sendReminders 完了: ${customers.length}人中 ${sentCount}人に送信`);
}
// ─── トリガー管理 ────────────────────────────────────────────────
/**
 * 毎朝9時に sendReminders() を実行するトリガーを登録する。
 * GASエディタから一度だけ手動実行すること。
 * 既存のトリガーがあれば削除してから再登録する。
 */
function setupRemindTrigger() {
    // 既存の sendReminders トリガーを全削除
    const existing = ScriptApp.getProjectTriggers();
    for (const trigger of existing) {
        if (trigger.getHandlerFunction() === "sendReminders") {
            ScriptApp.deleteTrigger(trigger);
            console.log("既存トリガーを削除しました");
        }
    }
    // 毎朝 9:00〜10:00 に実行（GASは1時間幅で指定）
    ScriptApp.newTrigger("sendReminders")
        .timeBased()
        .everyDays(1)
        .atHour(9)
        .create();
    console.log("リマインドトリガーを設定しました（毎日 9:00 実行）");
}
/**
 * テスト用: sendReminders() を即時実行して動作確認する。
 * 実際には送信されるので注意。
 */
function testSendReminders() {
    console.log("=== テスト実行開始 ===");
    sendReminders();
    console.log("=== テスト実行完了 ===");
}
