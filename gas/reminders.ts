/**
 * リマインド通知モジュール (GAS用)
 *
 * 【設計】
 * - メッセージは task_master.reminder_message にプランナーが事前設定した固定文を使う(AI生成しない)
 * - プランナー承認は介在せず、毎朝9時に直接カップルへ送信
 * - 送信タイミング: 「3日前」と「当日(0日)」の2回のみ。それ以外の日数は何もしない
 * - 期限切れ(days < 0)タスクは1通にまとめて送る(タスクが複数あっても1メッセージ)
 * - 送信完了後、プランナーに本日の送信結果サマリを通知
 * - 重複防止: message_drafts シートを送信ログとして再利用し、同じ (couple_id, task_id, 当日) の sent があればスキップ
 * - 全メッセージ末尾に「メニューからタスク管理表をご確認ください」CTAを付ける
 *
 * 必要なスクリプトプロパティ:
 *   LINE_CHANNEL_ACCESS_TOKEN  : デフォルトのLINEチャネルアクセストークン(式場固有トークンの fallback)
 *   LIFF_URL                   : アプリURL (例: https://liff.line.me/xxxx) — 任意
 *
 * Apps Script トリガー:
 *   sendReminders を 1 日 1 回 9:00 に実行(setupRemindTrigger で登録)
 */

// ─── 日付ユーティリティ ────────────────────────────────────────────

function calcDueDate(formula: string, weddingDateStr: string): Date | null {
  if (!formula || !weddingDateStr) return null;
  const parts = weddingDateStr.split("-");
  if (parts.length !== 3) return null;
  const wedding = new Date(
    parseInt(parts[0]),
    parseInt(parts[1]) - 1,
    parseInt(parts[2])
  );

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

  if (formula.trim() === "挙式日") return new Date(wedding);
  return null;
}

function daysUntil(targetDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// "YYYY-MM-DD" 形式で今日の日付を返す。
// message_drafts の created_at をこの文字列で前方一致させて「今日もう送ったか」を判定する。
function todayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ─── LINE Push API ────────────────────────────────────────────────

// LINE に1通テキストを送る薄いラッパー。失敗してもジョブ全体は止めない方針。
function pushLineMessage(userId: string, text: string, token?: string): boolean {
  const useToken = token || PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN") || "";
  if (!useToken) {
    console.error("LINE_CHANNEL_ACCESS_TOKEN が未設定です");
    return false;
  }

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
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
      return false;
    }
    return true;
  } catch (e: any) {
    console.error(`LINE Push例外 (${userId}):`, e);
    return false;
  }
}

// CTA文(全メッセージ末尾につける、メニューからタスク管理表を見てもらう導線)
const REMINDER_CTA = "\n\n📋 メニューからタスク管理表をご確認いただけます。";

// 期限切れまとめメッセージ用の擬似 task_id。
// 同じ日に2回まとめが送られないようにするための重複キーとして使う。
const OVERDUE_DIGEST_TASK_ID = "__OVERDUE_DIGEST__";

// ─── 重複送信防止 ────────────────────────────────────────────────

// 今日すでに同じ(couple_id, task_id)で sent が記録されていれば true。
// message_drafts シートを送信ログとして再利用しているため、ここで一覧スキャンする。
// ループの外側で1度だけ呼んで使い回せるよう、venue 単位の sent ドラフト一覧を引数で受ける。
function alreadySentToday(sentDrafts: IMessageDraft[], coupleId: string, taskId: string, today: string): boolean {
  for (const d of sentDrafts) {
    if (d.couple_id !== coupleId) continue;
    if (d.task_id !== taskId) continue;
    // created_at は ISO 8601 文字列。先頭10文字が "YYYY-MM-DD"。
    if ((d.created_at || "").slice(0, 10) === today) return true;
  }
  return false;
}

// ─── メイン処理: リマインド送信 ─────────────────────────────────

/**
 * 毎朝9時に実行。各カップルへ:
 *  - 期限が「3日前」または「当日」のタスクについて固定メッセージを1タスクごとに送信
 *  - 期限切れ(days < 0)のタスクは1通にまとめて送信
 * 送信後、プランナーに完了報告を1通通知する。
 */
function sendReminders(): void {
  const venues = getVenues().filter(v => v.active);
  const today = todayDateString();
  let totalIndividualSent = 0;
  let totalOverdueDigestSent = 0;

  for (const venue of venues) {
    const customers = getUsers(venue.venue_id);
    // 各 venue で1回だけ送信ログを取得して、ループ内では使い回す(スプシ読み取りを減らす)
    const sentDrafts = getMessageDrafts(venue.venue_id, "sent");
    // プランナーへの完了報告用のサマリ行
    const reportLines: string[] = [];
    let venueIndividualCount = 0;
    let venueOverdueCount = 0;

    for (const customer of customers) {
      if (!customer.wedding_date) continue;

      const progressData = getTaskProgress(customer.line_id);
      const doneTasks = new Set(progressData.filter(p => p.is_done).map(p => p.task_id));

      const customerTasks = getActiveTasks(venue.venue_id).filter(
        t => !t.target_line_id || t.target_line_id === customer.line_id
      );

      const coupleName = customer.name1_kana && customer.name2_kana
        ? `${customer.name1_kana}＆${customer.name2_kana}`
        : "お二人";

      // 「3日前 or 当日」の対象タスクと「期限切れ」タスクを分けて拾う
      const dueTasks: { task: ITaskMaster; days: number }[] = [];
      const overdueTasks: { task: ITaskMaster; days: number }[] = [];

      for (const task of customerTasks) {
        if (doneTasks.has(task.task_id)) continue;
        const dueDate = calcDueDate(task.due_formula, customer.wedding_date);
        if (!dueDate) continue;
        const days = daysUntil(dueDate);
        if (days === 3 || days === 0) {
          dueTasks.push({ task, days });
        } else if (days < 0) {
          overdueTasks.push({ task, days });
        }
      }

      // ── 個別タスクのリマインドを送信(3日前 / 当日)
      let perCoupleIndividual = 0;
      for (const { task, days } of dueTasks) {
        if (alreadySentToday(sentDrafts, customer.line_id, task.task_id, today)) continue;

        const body = task.reminder_message && task.reminder_message.trim() !== ""
          ? task.reminder_message
          : `「${task.task_content}」のご案内です。\nお手隙の際にご確認・ご対応をお願いいたします🙇`;
        const prefix = days === 0
          ? `【本日が目安日です】${coupleName}様\n\n`
          : `【あと${days}日です】${coupleName}様\n\n`;
        const message = prefix + body + REMINDER_CTA;

        const ok = pushLineMessage(customer.line_id, message, venue.line_channel_access_token);
        if (ok) {
          // 送信ログを残す(重複防止)
          createMessageDraft({
            draft_id: Utilities.getUuid(),
            venue_id: venue.venue_id,
            couple_id: customer.line_id,
            task_id: task.task_id,
            draft_message: message,
            status: "sent",
          });
          perCoupleIndividual++;
          totalIndividualSent++;
          venueIndividualCount++;
        }
        Utilities.sleep(500); // LINE のレート制限を避ける軽いスロットリング
      }

      // ── 期限切れまとめを送信(タスクが何個あっても1通)
      let perCoupleOverdueCount = 0;
      if (overdueTasks.length > 0 && !alreadySentToday(sentDrafts, customer.line_id, OVERDUE_DIGEST_TASK_ID, today)) {
        const lines = overdueTasks.map(({ task, days }) =>
          `・${task.task_content}（${Math.abs(days)}日経過）`
        );
        const message =
          `【期限が過ぎているタスクがあります】${coupleName}様\n\n` +
          lines.join("\n") +
          `\n\nお早めにご対応をお願いいたします🙇` +
          REMINDER_CTA;

        const ok = pushLineMessage(customer.line_id, message, venue.line_channel_access_token);
        if (ok) {
          createMessageDraft({
            draft_id: Utilities.getUuid(),
            venue_id: venue.venue_id,
            couple_id: customer.line_id,
            task_id: OVERDUE_DIGEST_TASK_ID,
            draft_message: message,
            status: "sent",
          });
          perCoupleOverdueCount = overdueTasks.length;
          totalOverdueDigestSent++;
          venueOverdueCount++;
          Utilities.sleep(500);
        }
      }

      if (perCoupleIndividual > 0 || perCoupleOverdueCount > 0) {
        const parts: string[] = [];
        if (perCoupleIndividual > 0) parts.push(`個別${perCoupleIndividual}件`);
        if (perCoupleOverdueCount > 0) parts.push(`期限切れまとめ1件(${perCoupleOverdueCount}タスク)`);
        reportLines.push(`・${coupleName}様: ${parts.join("、")}`);
      }
    }

    // ── プランナーへ本日の送信結果サマリを通知
    if (venue.planner_line_user_id && reportLines.length > 0) {
      const summary =
        `【本日のリマインド送信完了】${venue.venue_name}\n\n` +
        reportLines.join("\n") +
        `\n\n合計: 個別${venueIndividualCount}件 / 期限切れまとめ${venueOverdueCount}件` +
        REMINDER_CTA;
      pushLineMessage(venue.planner_line_user_id, summary, venue.line_channel_access_token);
      Utilities.sleep(500);
    }
  }

  console.log(
    `[sendReminders] 完了: 個別 ${totalIndividualSent} 件 / 期限切れまとめ ${totalOverdueDigestSent} 件`
  );
}

// ─── トリガー管理 ────────────────────────────────────────────────

// Apps Script のタイムベーストリガーを登録する。
// 過去に sendApprovedMessages のトリガーがあれば一緒に削除して、9時の sendReminders だけ残す。
function setupRemindTrigger(): void {
  const existing = ScriptApp.getProjectTriggers();
  for (const trigger of existing) {
    const name = trigger.getHandlerFunction();
    if (name === "sendReminders" || name === "sendApprovedMessages") {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  // 毎朝 9:00 にリマインド送信
  ScriptApp.newTrigger("sendReminders")
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  console.log("リマインドトリガーを設定しました(毎日 9:00 sendReminders)");
}

// 即時実行用(GASエディタから手動実行してテスト)
function testSendReminders(): void {
  console.log("=== testSendReminders 開始 ===");
  sendReminders();
  console.log("=== testSendReminders 終了 ===");
}
