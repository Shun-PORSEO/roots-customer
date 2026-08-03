// Sheets の生データ（ヘッダー行つき二次元配列）→ Supabase 投入プラン への純変換。
// DB には触らない（migrate.js が apply、--plan-only はここまでで完結）。
//
// 変換規則の正本は gas/sheets.ts / gas/setup.ts と supabase/migrations/0001,0002:
//   - task_master シートは target_line_id の有無で task_master / custom_tasks に分割
//   - task_progress は (line_id, task_id) 重複を updated_at 最新のみ採用（DB は複合PK）
//   - 非表示は user_hidden_tasks の行 ∪ task_progress.is_visible=false → task_visibility(hidden=true)
//   - task_items.line_id "" → NULL（テンプレ手配物）
//   - customers に存在しない line_id を参照する行（孤児）は FK 違反になるため skip して報告
//   - task_master レガシー8列（venue_id 列なし）はヘッダー列数で判定（gas/sheets.ts:193-198）

import { toBool, toVisibleBool, toDateOnly, toTimestamp, timestampSortKey } from "./normalize.js";

const HEADERS = {
  venues: ["venue_id", "venue_name", "planner_line_user_id", "line_channel_access_token", "line_liff_id", "active", "created_at"],
  customers: ["line_id", "venue_id", "wedding_date", "created_at", "name1_kana", "name2_kana", "is_admin"],
  task_progress: ["line_id", "task_id", "is_done", "updated_at", "is_visible", "comment"],
  user_hidden_tasks: ["line_id", "task_id"],
  task_items: ["item_id", "task_id", "line_id", "item_name", "quantity", "is_done", "memo", "created_at"],
  message_drafts: ["draft_id", "venue_id", "couple_id", "task_id", "draft_message", "status", "created_at", "sent_at"],
};

function assertHeader(sheetName, rows, expected) {
  const header = (rows[0] || []).map((h) => String(h).trim());
  for (let i = 0; i < expected.length; i++) {
    if (header[i] !== expected[i]) {
      throw new Error(
        `${sheetName}.csv のヘッダーが想定と違います: ${i + 1}列目が "${header[i] ?? ""}"（想定 "${expected[i]}"）。` +
          `スプレッドシートの「${sheetName}」シートをそのまま CSV ダウンロードしたものを置いてください。`
      );
    }
  }
}

function cell(row, i) {
  return String(row[i] ?? "").trim();
}

// タイムスタンプ列を取り込む。解釈不能なら skip 理由を返す。
function ts(row, i, rowNo, colName, skips) {
  const v = toTimestamp(row[i]);
  if (v === undefined) {
    skips.push({ row: rowNo, reason: `${colName} を日時として解釈できません: "${cell(row, i)}"` });
    return undefined;
  }
  return v;
}

export function buildPlan(sheets, { existingLineIds = new Set() } = {}) {
  const report = { sheets: {}, warnings: [], infos: [] };
  const plan = {
    venues: [],
    customers: [],
    taskMaster: [],
    customTasks: [],
    taskProgress: [],
    taskVisibility: [],
    taskItems: [],
    messageDrafts: [],
  };

  function sheetReport(name, read) {
    const r = { read, planned: 0, skips: [] };
    report.sheets[name] = r;
    return r;
  }

  // ── venues ──────────────────────────────────────────────
  {
    const rows = sheets.venues;
    assertHeader("venues", rows, HEADERS.venues);
    const r = sheetReport("venues", rows.length - 1);
    const seen = new Set();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const code = cell(row, 0);
      if (!code) {
        r.skips.push({ row: i + 1, reason: "venue_id が空" });
        continue;
      }
      if (seen.has(code)) {
        r.skips.push({ row: i + 1, reason: `venue_id "${code}" が重複（先勝ち）` });
        continue;
      }
      seen.add(code);
      const created_at = ts(row, 6, i + 1, "created_at", r.skips);
      if (created_at === undefined) continue;
      plan.venues.push({
        code,
        venue_name: cell(row, 1) || code,
        planner_line_user_id: cell(row, 2),
        line_channel_access_token: cell(row, 3),
        line_liff_id: cell(row, 4),
        active: toBool(row[5]),
        created_at,
      });
      r.planned++;
    }
  }
  const venueCodes = new Set(plan.venues.map((v) => v.code));

  // ── customers ───────────────────────────────────────────
  {
    const rows = sheets.customers;
    assertHeader("customers", rows, HEADERS.customers);
    const r = sheetReport("customers", rows.length - 1);
    const seen = new Set();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const line_id = cell(row, 0);
      if (!line_id) {
        r.skips.push({ row: i + 1, reason: "line_id が空" });
        continue;
      }
      if (seen.has(line_id)) {
        r.skips.push({ row: i + 1, reason: `line_id "${line_id}" が重複（先勝ち。GAS getCustomer と同じ）` });
        continue;
      }
      seen.add(line_id);
      const venue_code = cell(row, 1) || null;
      if (venue_code && !venueCodes.has(venue_code)) {
        report.warnings.push(
          `customers ${i + 1}行目: venue_id "${venue_code}" が venues シートに無いため所属式場なし（NULL）で取り込みます`
        );
      }
      const wedding_date = toDateOnly(row[2]);
      if (wedding_date === undefined) {
        r.skips.push({ row: i + 1, reason: `wedding_date を日付として解釈できません: "${cell(row, 2)}"` });
        continue;
      }
      const created_at = ts(row, 3, i + 1, "created_at", r.skips);
      if (created_at === undefined) continue;
      const is_admin = toBool(row[6]);
      if (is_admin) {
        report.infos.push(
          `customers ${i + 1}行目: is_admin=TRUE (${line_id})。新システムの管理者権限は tenant_admins（メール認証）なので、` +
            `この担当者には /signup からの管理者登録を案内してください（is_admin はデータとして保持されるだけで権限になりません）`
        );
      }
      plan.customers.push({
        line_id,
        venue_code: venue_code && venueCodes.has(venue_code) ? venue_code : null,
        wedding_date,
        name1_kana: cell(row, 4),
        name2_kana: cell(row, 5),
        is_admin,
        created_at,
      });
      r.planned++;
    }
  }

  // 孤児判定用: 今回取り込むカップル ∪ DB に既にいるカップル
  const knownLineIds = new Set([...existingLineIds, ...plan.customers.map((c) => c.line_id)]);

  // ── task_master（→ task_master / custom_tasks に分割）──
  {
    const rows = sheets.task_master ?? [];
    const r = sheetReport("task_master", Math.max(rows.length - 1, 0));
    if (rows.length > 0) {
      // レガシー判定はヘッダー列数（gas/sheets.ts:193-198 と同じ規則）
      const width = rows[0].length;
      const hasVenueCol = width >= 9;
      const off = hasVenueCol ? 1 : 0;
      const hasManualUrl = hasVenueCol && width >= 10;
      const hasReminderMsg = hasVenueCol && width >= 11;
      if (cell(rows[0], 0) !== "task_id") {
        throw new Error(`task_master.csv のヘッダー1列目が "task_id" ではありません: "${cell(rows[0], 0)}"`);
      }
      if (!hasVenueCol) {
        report.warnings.push("task_master: レガシー8列スキーマ（venue_id 列なし）として読み込みます。全タスクを全式場共通（base）にします");
      }
      const seen = new Set();
      let droppedReminder = 0;
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const task_id = cell(row, 0);
        if (!task_id) {
          r.skips.push({ row: i + 1, reason: "task_id が空" });
          continue;
        }
        if (seen.has(task_id)) {
          r.skips.push({ row: i + 1, reason: `task_id "${task_id}" が重複（先勝ち）` });
          continue;
        }
        seen.add(task_id);
        const venue_code = hasVenueCol ? cell(row, 1) : "";
        if (venue_code && !venueCodes.has(venue_code)) {
          // NULL(base) に落とすと全式場に見えてしまうため取り込まない
          r.skips.push({ row: i + 1, reason: `venue_id "${venue_code}" が venues シートに無い（base に落とすと全式場に露出するため skip）` });
          continue;
        }
        const common = {
          task_id,
          category: cell(row, 1 + off),
          task_content: cell(row, 2 + off),
          due_formula: cell(row, 3 + off),
          due_estimate: cell(row, 4 + off),
          memo: cell(row, 5 + off),
          is_active: toBool(row[6 + off]),
          manual_url: hasManualUrl ? cell(row, 8 + off) : "",
        };
        const target_line_id = cell(row, 7 + off);
        const reminder_message = hasReminderMsg ? cell(row, 9 + off) : "";
        if (target_line_id) {
          // カップル専用のカスタムタスク → custom_tasks（DB 側に reminder_message 列は無い）
          if (!knownLineIds.has(target_line_id)) {
            r.skips.push({ row: i + 1, reason: `target_line_id "${target_line_id}" のカップルが存在しない（孤児）` });
            continue;
          }
          if (reminder_message) droppedReminder++;
          plan.customTasks.push({ ...common, target_line_id });
        } else {
          plan.taskMaster.push({ ...common, venue_code: venue_code || null, reminder_message });
        }
        r.planned++;
      }
      if (droppedReminder > 0) {
        report.warnings.push(
          `task_master: カスタムタスク ${droppedReminder} 件の reminder_message は移行先（custom_tasks）に列が無いため落としました`
        );
      }
    }
  }
  const knownTaskIds = new Set([...plan.taskMaster, ...plan.customTasks].map((t) => t.task_id));

  // ── task_progress（重複は updated_at 最新のみ）──────────
  const explicitlyHidden = new Set(); // "lineId|taskId"
  {
    const rows = sheets.task_progress ?? [];
    const r = sheetReport("task_progress", Math.max(rows.length - 1, 0));
    if (rows.length > 0) assertHeader("task_progress", rows, HEADERS.task_progress);
    const latest = new Map(); // key → { candidate, sortKey, rowNo }
    let duplicates = 0;
    let orphans = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const line_id = cell(row, 0);
      const task_id = cell(row, 1);
      if (!line_id || !task_id) {
        r.skips.push({ row: i + 1, reason: "line_id または task_id が空" });
        continue;
      }
      if (!knownLineIds.has(line_id)) {
        orphans++;
        r.skips.push({ row: i + 1, reason: `line_id "${line_id}" のカップルが存在しない（孤児）` });
        continue;
      }
      const updated_at = ts(row, 3, i + 1, "updated_at", r.skips);
      if (updated_at === undefined) continue;
      const key = `${line_id}|${task_id}`;
      const candidate = {
        line_id,
        task_id,
        is_done: toBool(row[2]),
        comment: cell(row, 5),
        updated_at,
        visible: toVisibleBool(row[4]),
      };
      const sortKey = timestampSortKey(row[3]);
      const prev = latest.get(key);
      if (prev) {
        duplicates++;
        if (sortKey <= prev.sortKey) continue;
      }
      latest.set(key, { candidate, sortKey });
    }
    for (const { candidate } of latest.values()) {
      const { visible, ...progressRow } = candidate;
      plan.taskProgress.push(progressRow);
      if (!visible) explicitlyHidden.add(`${candidate.line_id}|${candidate.task_id}`);
      if (!knownTaskIds.has(candidate.task_id)) {
        report.warnings.push(
          `task_progress: task_id "${candidate.task_id}" はタスクマスタに無いまま取り込みます（DB に FK は無く GAS 時代と同じ挙動）`
        );
      }
    }
    r.planned = plan.taskProgress.length;
    if (duplicates > 0) {
      report.infos.push(`task_progress: (line_id, task_id) の重複 ${duplicates} 行を updated_at 最新のみ採用で解決しました`);
    }
    if (orphans > 0) {
      report.infos.push(`task_progress: 孤児 ${orphans} 行を skip しました（退会・テストデータ由来の可能性）`);
    }
  }

  // ── user_hidden_tasks ∪ is_visible=false → task_visibility ──
  {
    const rows = sheets.user_hidden_tasks ?? [];
    const r = sheetReport("user_hidden_tasks", Math.max(rows.length - 1, 0));
    if (rows.length > 0) assertHeader("user_hidden_tasks", rows, HEADERS.user_hidden_tasks);
    const hidden = new Map(); // key → {line_id, task_id}
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const line_id = cell(row, 0);
      const task_id = cell(row, 1);
      if (!line_id || !task_id) {
        r.skips.push({ row: i + 1, reason: "line_id または task_id が空" });
        continue;
      }
      if (!knownLineIds.has(line_id)) {
        r.skips.push({ row: i + 1, reason: `line_id "${line_id}" のカップルが存在しない（孤児）` });
        continue;
      }
      hidden.set(`${line_id}|${task_id}`, { line_id, task_id });
    }
    let fromProgress = 0;
    for (const key of explicitlyHidden) {
      if (!hidden.has(key)) {
        const [line_id, task_id] = key.split("|");
        hidden.set(key, { line_id, task_id });
        fromProgress++;
      }
    }
    plan.taskVisibility = [...hidden.values()].map((h) => ({ ...h, hidden: true }));
    r.planned = plan.taskVisibility.length;
    if (fromProgress > 0) {
      report.infos.push(`task_visibility: task_progress.is_visible=FALSE 由来の非表示 ${fromProgress} 件を統合しました`);
    }
  }

  // ── task_items ──────────────────────────────────────────
  {
    const rows = sheets.task_items ?? [];
    const r = sheetReport("task_items", Math.max(rows.length - 1, 0));
    if (rows.length > 0) assertHeader("task_items", rows, HEADERS.task_items);
    const seen = new Set();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const item_id = cell(row, 0);
      if (!item_id) {
        r.skips.push({ row: i + 1, reason: "item_id が空" });
        continue;
      }
      if (seen.has(item_id)) {
        r.skips.push({ row: i + 1, reason: `item_id "${item_id}" が重複（先勝ち）` });
        continue;
      }
      seen.add(item_id);
      const rawLineId = cell(row, 2);
      if (rawLineId && !knownLineIds.has(rawLineId)) {
        r.skips.push({ row: i + 1, reason: `line_id "${rawLineId}" のカップルが存在しない（孤児）` });
        continue;
      }
      const created_at = ts(row, 7, i + 1, "created_at", r.skips);
      if (created_at === undefined) continue;
      plan.taskItems.push({
        item_id,
        task_id: cell(row, 1),
        line_id: rawLineId || null, // "" = テンプレ → NULL（0002 の規約）
        item_name: cell(row, 3),
        quantity: Math.max(1, Math.floor(Number(row[4]) || 1)),
        is_done: toBool(row[5]),
        memo: cell(row, 6),
        created_at,
      });
      r.planned++;
    }
  }

  // ── message_drafts ──────────────────────────────────────
  {
    const rows = sheets.message_drafts ?? [];
    const r = sheetReport("message_drafts", Math.max(rows.length - 1, 0));
    if (rows.length > 0) assertHeader("message_drafts", rows, HEADERS.message_drafts);
    const seen = new Set();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const draft_id = cell(row, 0);
      if (!draft_id) {
        r.skips.push({ row: i + 1, reason: "draft_id が空" });
        continue;
      }
      if (seen.has(draft_id)) {
        r.skips.push({ row: i + 1, reason: `draft_id "${draft_id}" が重複（先勝ち）` });
        continue;
      }
      seen.add(draft_id);
      const venue_code = cell(row, 1);
      if (venue_code && !venueCodes.has(venue_code)) {
        report.warnings.push(`message_drafts ${i + 1}行目: venue_id "${venue_code}" が venues に無いため式場なし（NULL）で取り込みます`);
      }
      const created_at = ts(row, 6, i + 1, "created_at", r.skips);
      if (created_at === undefined) continue;
      const sent_at = ts(row, 7, i + 1, "sent_at", r.skips);
      if (sent_at === undefined) continue;
      plan.messageDrafts.push({
        draft_id,
        venue_code: venue_code && venueCodes.has(venue_code) ? venue_code : null,
        couple_id: cell(row, 2),
        task_id: cell(row, 3),
        draft_message: cell(row, 4),
        status: cell(row, 5) || "pending",
        created_at,
        sent_at,
      });
      r.planned++;
    }
  }

  return { plan, report };
}
