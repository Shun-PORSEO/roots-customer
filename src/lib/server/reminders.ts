import "server-only";
import { sql } from "./db";
import { pushLineMessage } from "./line";

// リマインドエンジン（SaaS化 C5 / roots-concierge#6）。旧 gas/reminders.ts の移植。
//
// 【設計（GAS 版を踏襲）】
// - メッセージは task_master.reminder_message の固定文（無ければ既定文）。AI 生成はしない
// - 送信タイミングは「3日前」と「当日」の2回のみ。期限切れ(days<0)は1通にまとめる
// - 送信後、プランナーへ本日の送信結果サマリを1通通知
// - 全メッセージ末尾に「メニューからタスク管理表」CTA
//
// 【GAS からの変更点】
// - 冪等化: message_drafts.sent_date + ユニークインデックスで DB が重複送信ゼロを保証
//   （claim → 送信の順。多重起動・再実行でも同日同 (couple, task) は1通）
// - プランナーサマリも claim で冪等化（couple_id=venue.code, task_id=__PLANNER_SUMMARY__）
// - task_visibility で非表示にされたタスクはリマインドしない（GAS は未考慮だった改善）
// - 全 company 横断のデータ取得は security definer 関数 app.cron_reminder_data に限定

const REMINDER_CTA = "\n\n📋 メニューからタスク管理表をご確認いただけます。";
// 期限切れまとめ / プランナーサマリの擬似 task_id（同日重複防止の claim キー）
export const OVERDUE_DIGEST_TASK_ID = "__OVERDUE_DIGEST__";
export const PLANNER_SUMMARY_TASK_ID = "__PLANNER_SUMMARY__";

// ─── 日付ユーティリティ（JST 基準）──────────────────────────────────────
// Cron は UTC 0:00（= JST 9:00）に走る。日付判定は全て JST の「今日」で行う。

export function jstTodayString(now: Date = new Date()): string {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

// "挙式日 - N日" / "挙式日 - Nヶ月" / "挙式日" を期日(YYYY-MM-DD)に解決（GAS と同じ規則）
export function calcDueDate(formula: string, weddingDateStr: string): Date | null {
  if (!formula || !weddingDateStr) return null;
  const parts = weddingDateStr.split("-");
  if (parts.length !== 3) return null;
  const wedding = new Date(
    Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
  );
  if (Number.isNaN(wedding.getTime())) return null;

  const dayMatch = formula.match(/挙式日\s*[-−]\s*(\d+)\s*日/);
  if (dayMatch) {
    const result = new Date(wedding);
    result.setUTCDate(result.getUTCDate() - parseInt(dayMatch[1]));
    return result;
  }
  const monthMatch = formula.match(/挙式日\s*[-−]\s*(\d+)\s*[ヶか]月/);
  if (monthMatch) {
    const result = new Date(wedding);
    result.setUTCMonth(result.getUTCMonth() - parseInt(monthMatch[1]));
    return result;
  }
  if (formula.trim() === "挙式日") return wedding;
  return null;
}

export function daysUntil(target: Date, todayStr: string): number {
  const t = todayStr.split("-");
  const today = Date.UTC(parseInt(t[0]), parseInt(t[1]) - 1, parseInt(t[2]));
  return Math.round((target.getTime() - today) / (1000 * 60 * 60 * 24));
}

// ─── cron_reminder_data の行型 ───────────────────────────────────────────
type VenueRow = {
  id: string;
  company_id: string;
  code: string;
  venue_name: string;
  planner_line_user_id: string;
  line_channel_access_token: string;
};
type CustomerRow = {
  line_id: string;
  company_id: string;
  venue_id: string;
  wedding_date: string;
  name1_kana: string;
  name2_kana: string;
};
type TaskRow = {
  task_id: string;
  company_id: string;
  venue_id: string | null;
  task_content: string;
  due_formula: string;
  reminder_message: string;
};
type CustomTaskRow = {
  task_id: string;
  target_line_id: string;
  task_content: string;
  due_formula: string;
};
type ReminderData = {
  venues: VenueRow[];
  customers: CustomerRow[];
  tasks: TaskRow[];
  custom_tasks: CustomTaskRow[];
  done: Array<{ line_id: string; task_id: string }>;
  hidden: Array<{ line_id: string; task_id: string }>;
  sent_today: Array<{ couple_id: string; task_id: string }>;
};

export type ReminderSummary = {
  date: string;
  individual_sent: number;
  overdue_digest_sent: number;
  planner_reports_sent: number;
  skipped_already_sent: number;
  failed: number;
};

function buildBody(taskContent: string, reminderMessage: string): string {
  return (
    (reminderMessage ?? "").trim() ||
    `「${taskContent}」のご案内です。\nお手隙の際にご確認・ご対応をお願いいたします🙇`
  );
}

// claim（冪等化）→ 送信 → 失敗なら failed へ。送れたら true。
async function claimAndPush(opts: {
  companyId: string;
  venueId: string;
  coupleId: string;
  taskId: string;
  message: string;
  today: string;
  to: string;
  token: string;
  summary: ReminderSummary;
}): Promise<boolean> {
  const [claim] = await sql()`
    select app.cron_claim_reminder(
      ${opts.companyId}::uuid, ${opts.venueId}::uuid,
      ${opts.coupleId}, ${opts.taskId}, ${opts.message}, ${opts.today}::date
    ) as draft_id`;
  const draftId = claim?.draft_id as string | null;
  if (!draftId) {
    opts.summary.skipped_already_sent++;
    return false; // 同日送信済み（多重起動・再実行）
  }
  try {
    await pushLineMessage(opts.to, opts.message, opts.token);
    return true;
  } catch (e) {
    opts.summary.failed++;
    console.error(`[reminders] 送信失敗 to=${opts.to} task=${opts.taskId}:`, e);
    await sql()`select app.cron_mark_failed(${draftId})`.catch(() => undefined);
    return false;
  }
}

/**
 * 毎朝 9:00 JST に実行。各カップルへ:
 *  - 期限が「3日前」または「当日」のタスクの固定メッセージを1タスク1通
 *  - 期限切れ(days<0)タスクは1通にまとめて送信
 * 送信後、プランナーへ完了報告を1通通知する。
 */
export async function runReminders(now: Date = new Date()): Promise<ReminderSummary> {
  const today = jstTodayString(now);
  const summary: ReminderSummary = {
    date: today,
    individual_sent: 0,
    overdue_digest_sent: 0,
    planner_reports_sent: 0,
    skipped_already_sent: 0,
    failed: 0,
  };

  const [row] = await sql()`select app.cron_reminder_data(${today}::date) as data`;
  const data = row?.data as ReminderData | undefined;
  if (!data) return summary;

  const doneByUser = new Map<string, Set<string>>();
  for (const p of data.done) {
    if (!doneByUser.has(p.line_id)) doneByUser.set(p.line_id, new Set());
    doneByUser.get(p.line_id)!.add(p.task_id);
  }
  const hiddenByUser = new Map<string, Set<string>>();
  for (const h of data.hidden) {
    if (!hiddenByUser.has(h.line_id)) hiddenByUser.set(h.line_id, new Set());
    hiddenByUser.get(h.line_id)!.add(h.task_id);
  }
  const sentToday = new Set(data.sent_today.map((s) => `${s.couple_id}|${s.task_id}`));
  const customsByUser = new Map<string, CustomTaskRow[]>();
  for (const ct of data.custom_tasks) {
    if (!customsByUser.has(ct.target_line_id)) customsByUser.set(ct.target_line_id, []);
    customsByUser.get(ct.target_line_id)!.push(ct);
  }

  for (const venue of data.venues) {
    const venueCustomers = data.customers.filter((c) => c.venue_id === venue.id);
    // base（venue_id null・自社）+ この式場専用のタスク雛形
    const venueTasks = data.tasks.filter(
      (t) => t.company_id === venue.company_id && (!t.venue_id || t.venue_id === venue.id)
    );
    const reportLines: string[] = [];
    let venueIndividualCount = 0;
    let venueOverdueCount = 0;

    for (const customer of venueCustomers) {
      const done = doneByUser.get(customer.line_id) ?? new Set<string>();
      const hidden = hiddenByUser.get(customer.line_id) ?? new Set<string>();
      const coupleName =
        customer.name1_kana && customer.name2_kana
          ? `${customer.name1_kana}＆${customer.name2_kana}`
          : "お二人";

      // 共有雛形 + 本人のカスタムタスク（reminder_message はカスタムに無いので既定文）
      const candidates = [
        ...venueTasks.map((t) => ({
          task_id: t.task_id,
          task_content: t.task_content,
          due_formula: t.due_formula,
          reminder_message: t.reminder_message,
        })),
        ...(customsByUser.get(customer.line_id) ?? []).map((t) => ({
          task_id: t.task_id,
          task_content: t.task_content,
          due_formula: t.due_formula,
          reminder_message: "",
        })),
      ];

      const dueTasks: Array<{ task: (typeof candidates)[number]; days: number }> = [];
      const overdueTasks: Array<{ task: (typeof candidates)[number]; days: number }> = [];
      for (const task of candidates) {
        if (done.has(task.task_id) || hidden.has(task.task_id)) continue;
        const dueDate = calcDueDate(task.due_formula, customer.wedding_date);
        if (!dueDate) continue;
        const days = daysUntil(dueDate, today);
        if (days === 3 || days === 0) dueTasks.push({ task, days });
        else if (days < 0) overdueTasks.push({ task, days });
      }

      // ── 個別リマインド（3日前 / 当日）
      let perCoupleIndividual = 0;
      for (const { task, days } of dueTasks) {
        if (sentToday.has(`${customer.line_id}|${task.task_id}`)) {
          summary.skipped_already_sent++;
          continue;
        }
        const prefix =
          days === 0
            ? `【本日が目安日です】${coupleName}様\n\n`
            : `【あと${days}日です】${coupleName}様\n\n`;
        const message = prefix + buildBody(task.task_content, task.reminder_message) + REMINDER_CTA;
        const sent = await claimAndPush({
          companyId: venue.company_id,
          venueId: venue.id,
          coupleId: customer.line_id,
          taskId: task.task_id,
          message,
          today,
          to: customer.line_id,
          token: venue.line_channel_access_token,
          summary,
        });
        if (sent) {
          perCoupleIndividual++;
          summary.individual_sent++;
          venueIndividualCount++;
        }
      }

      // ── 期限切れまとめ（何件あっても1通）
      let perCoupleOverdueCount = 0;
      if (
        overdueTasks.length > 0 &&
        !sentToday.has(`${customer.line_id}|${OVERDUE_DIGEST_TASK_ID}`)
      ) {
        const lines = overdueTasks.map(
          ({ task, days }) => `・${task.task_content}（${Math.abs(days)}日経過）`
        );
        const message =
          `【期限が過ぎているタスクがあります】${coupleName}様\n\n` +
          lines.join("\n") +
          `\n\nお早めにご対応をお願いいたします🙇` +
          REMINDER_CTA;
        const sent = await claimAndPush({
          companyId: venue.company_id,
          venueId: venue.id,
          coupleId: customer.line_id,
          taskId: OVERDUE_DIGEST_TASK_ID,
          message,
          today,
          to: customer.line_id,
          token: venue.line_channel_access_token,
          summary,
        });
        if (sent) {
          perCoupleOverdueCount = overdueTasks.length;
          summary.overdue_digest_sent++;
          venueOverdueCount++;
        }
      }

      if (perCoupleIndividual > 0 || perCoupleOverdueCount > 0) {
        const parts: string[] = [];
        if (perCoupleIndividual > 0) parts.push(`個別${perCoupleIndividual}件`);
        if (perCoupleOverdueCount > 0)
          parts.push(`期限切れまとめ1件(${perCoupleOverdueCount}タスク)`);
        reportLines.push(`・${coupleName}様: ${parts.join("、")}`);
      }
    }

    // ── プランナーへ本日の送信結果サマリ（venue 単位・冪等）
    if (venue.planner_line_user_id && reportLines.length > 0) {
      const message =
        `【本日のリマインド送信完了】${venue.venue_name}\n\n` +
        reportLines.join("\n") +
        `\n\n合計: 個別${venueIndividualCount}件 / 期限切れまとめ${venueOverdueCount}件`;
      const sent = await claimAndPush({
        companyId: venue.company_id,
        venueId: venue.id,
        coupleId: venue.code, // カップルではないので venue code を claim キーに使う
        taskId: PLANNER_SUMMARY_TASK_ID,
        message,
        today,
        to: venue.planner_line_user_id,
        token: venue.line_channel_access_token,
        summary,
      });
      if (sent) summary.planner_reports_sent++;
    }
  }

  console.log(
    `[reminders] ${today} 完了: 個別 ${summary.individual_sent} / まとめ ${summary.overdue_digest_sent} / ` +
      `サマリ ${summary.planner_reports_sent} / 重複スキップ ${summary.skipped_already_sent} / 失敗 ${summary.failed}`
  );
  return summary;
}
