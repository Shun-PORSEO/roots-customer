/**
 * リマインド通知モジュール (GAS用)
 *
 * 【フロー】
 * 1. sendReminders()      — 毎朝9時に実行。Claude APIでドラフト生成 → message_drafts に保存 → プランナーに通知
 * 2. sendApprovedMessages() — approved なドラフトをカップルにLINE送信して sent に更新
 *
 * 必要なスクリプトプロパティ:
 *   LINE_CHANNEL_ACCESS_TOKEN  : デフォルトのLINEチャネルアクセストークン（式場固有トークンの fallback）
 *   LIFF_URL                   : アプリURL (例: https://liff.line.me/xxxx)
 *   CLAUDE_API_KEY             : Claude API キー
 */
// ─── 日付ユーティリティ ────────────────────────────────────────────
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
function daysUntil(targetDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
function formatDateJP(date) {
    const DOWS = ["日", "月", "火", "水", "木", "金", "土"];
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${DOWS[date.getDay()]}）`;
}
// ─── LINE Push API ────────────────────────────────────────────────
function pushLineMessage(userId, text, token) {
    const useToken = token || PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN") || "";
    if (!useToken) {
        console.error("LINE_CHANNEL_ACCESS_TOKEN が未設定です");
        return;
    }
    const options = {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: `Bearer ${useToken}` },
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
// ─── メイン処理: ドラフト生成 ─────────────────────────────────────
/**
 * 毎朝9時に実行。
 * 期限3日前タスクを持つカップルを抽出し、Claude APIでメッセージドラフトを生成して
 * message_drafts に保存。プランナーに承認依頼通知を送る。
 */
function sendReminders() {
    const liffUrl = PropertiesService.getScriptProperties().getProperty("LIFF_URL") || "";
    const venues = getVenues().filter(v => v.active);
    let totalDrafts = 0;
    for (const venue of venues) {
        const customers = getUsers(venue.venue_id);
        const pendingByVenue = [];
        for (const customer of customers) {
            if (!customer.wedding_date)
                continue;
            const progressData = getTaskProgress(customer.line_id);
            const doneTasks = new Set(progressData.filter(p => p.is_done).map(p => p.task_id));
            const customerTasks = getActiveTasks(venue.venue_id).filter(t => !t.target_line_id || t.target_line_id === customer.line_id);
            for (const task of customerTasks) {
                if (doneTasks.has(task.task_id))
                    continue;
                const dueDate = calcDueDate(task.due_formula, customer.wedding_date);
                if (!dueDate)
                    continue;
                const days = daysUntil(dueDate);
                if (days < 0 || days > 3)
                    continue;
                const coupleName = customer.name1_kana && customer.name2_kana
                    ? `${customer.name1_kana}＆${customer.name2_kana}`
                    : "お二人";
                const draftMessage = generateReminderMessage(coupleName, task.task_content, days, venue.venue_name);
                const draftId = Utilities.getUuid();
                createMessageDraft({
                    draft_id: draftId,
                    venue_id: venue.venue_id,
                    couple_id: customer.line_id,
                    task_id: task.task_id,
                    draft_message: draftMessage,
                    status: "pending",
                });
                pendingByVenue.push(`・${coupleName}様「${task.task_content}」（あと${days}日）`);
                totalDrafts++;
                Utilities.sleep(500);
            }
        }
        // プランナーへ承認依頼通知
        if (pendingByVenue.length > 0 && venue.planner_line_user_id) {
            const plannerMsg = [
                `【承認待ち ${pendingByVenue.length}件】`,
                ...pendingByVenue,
                "",
                "管理画面から確認・承認をお願いします。",
                liffUrl ? `▶ 管理画面: ${liffUrl}/admin` : "",
            ].filter(l => l !== "").join("\n");
            pushLineMessage(venue.planner_line_user_id, plannerMsg, venue.line_channel_access_token);
            Utilities.sleep(1000);
        }
    }
    console.log(`sendReminders 完了: ${totalDrafts} 件のドラフトを生成`);
}
// ─── 承認済みメッセージ送信 ──────────────────────────────────────
/**
 * status=approved のドラフトをカップルにLINE送信して sent に更新する。
 * 承認後に即時実行、またはトリガーで定期実行。
 */
function sendApprovedMessages() {
    const venues = getVenues().filter(v => v.active);
    let sentCount = 0;
    for (const venue of venues) {
        const approvedDrafts = getMessageDrafts(venue.venue_id, "approved");
        for (const draft of approvedDrafts) {
            pushLineMessage(draft.couple_id, draft.draft_message, venue.line_channel_access_token);
            updateDraftStatus(draft.draft_id, "sent");
            sentCount++;
            Utilities.sleep(1000);
        }
    }
    console.log(`sendApprovedMessages 完了: ${sentCount} 件を送信`);
}
// ─── トリガー管理 ────────────────────────────────────────────────
function setupRemindTrigger() {
    const existing = ScriptApp.getProjectTriggers();
    for (const trigger of existing) {
        if (trigger.getHandlerFunction() === "sendReminders" ||
            trigger.getHandlerFunction() === "sendApprovedMessages") {
            ScriptApp.deleteTrigger(trigger);
        }
    }
    // 毎朝 9:00 にドラフト生成
    ScriptApp.newTrigger("sendReminders")
        .timeBased()
        .everyDays(1)
        .atHour(9)
        .create();
    // 毎朝 10:00 に承認済みを送信（プランナーが9〜10時に確認する想定）
    ScriptApp.newTrigger("sendApprovedMessages")
        .timeBased()
        .everyDays(1)
        .atHour(10)
        .create();
    console.log("リマインドトリガーを設定しました（毎日 9:00 ドラフト生成 / 10:00 送信）");
}
function testSendReminders() {
    console.log("=== テスト実行開始 ===");
    sendReminders();
    console.log("=== テスト実行完了 ===");
}
