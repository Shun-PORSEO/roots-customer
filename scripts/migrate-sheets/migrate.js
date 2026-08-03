#!/usr/bin/env node
/**
 * migrate.js
 * Google Sheets（GAS 運用）→ Supabase 一回性移行CLI（SaaS化 C7 / roots-concierge#8）
 *
 * 使い方:
 *   # 1. スプレッドシートの各シートを CSV でダウンロードして1つのディレクトリに置く
 *   #    （venues.csv / customers.csv / task_master.csv / task_progress.csv /
 *   #      user_hidden_tasks.csv / task_items.csv / message_drafts.csv）
 *   # 2. まず変換だけ検算（DB 不要）
 *   node scripts/migrate-sheets/migrate.js --dir ./export --plan-only
 *   # 3. DB と突き合わせたドライラン（既定。書き込みなし）
 *   node scripts/migrate-sheets/migrate.js --dir ./export --admin-email owner@example.com \
 *     --database-url "postgres://postgres:postgres@127.0.0.1:54322/postgres"
 *   # 4. 問題なければ投入（1トランザクション・冪等。再実行しても件数は増えない）
 *   node scripts/migrate-sheets/migrate.js --dir ./export --admin-email owner@example.com --apply
 *
 * オプション:
 *   --dir <path>            CSV を置いたディレクトリ（必須）
 *   --company-id <uuid>     投入先テナント。--admin-email とどちらか必須
 *   --admin-email <email>   投入先テナントを tenant_admins のメールから解決する
 *   --database-url <url>    未指定なら env MIGRATE_DATABASE_URL → DATABASE_URL
 *   --task-id-prefix <str>  task_id が他テナントと衝突する場合に全 task_id へ付ける接頭辞
 *   --apply                 実際に書き込む（既定はドライラン）
 *   --plan-only             DB に接続せず CSV の変換結果だけ検算する
 *   --json                  レポートを JSON でも標準出力に出す
 *
 * 前提:
 *   - 1スプレッドシート = 1テナント（companies 1行）。company は事前に存在していること
 *     （/signup → app.provision_tenant() で作られる）。このスクリプトは company を作らない。
 *   - 接続は owner ロール（postgres）。非特権の app_couple では companies / customers /
 *     他人の task_progress に INSERT できない（RLS + grant で塞いである）。
 *   - LINE キーは Sheets に access_token / liff_id しか無い。secret / login_channel_id は
 *     移行後にオンボーディング Step2-3 で式場に入力してもらう（接続テスト全緑がゲート）。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { parseCsv } from "./lib/csv.js";
import { buildPlan } from "./lib/plan.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");

const SHEET_FILES = {
  venues: { required: true },
  customers: { required: true },
  task_master: { required: false },
  task_progress: { required: false },
  user_hidden_tasks: { required: false },
  task_items: { required: false },
  message_drafts: { required: false },
};

// ── 引数 ────────────────────────────────────────────────
function parseArgs(argv) {
  const opts = { apply: false, planOnly: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} には値が必要です`);
      return v;
    };
    switch (a) {
      case "--dir": opts.dir = next(); break;
      case "--company-id": opts.companyId = next(); break;
      case "--admin-email": opts.adminEmail = next(); break;
      case "--database-url": opts.databaseUrl = next(); break;
      case "--task-id-prefix": opts.taskIdPrefix = next(); break;
      case "--apply": opts.apply = true; break;
      case "--plan-only": opts.planOnly = true; break;
      case "--json": opts.json = true; break;
      case "-h":
      case "--help": opts.help = true; break;
      default:
        throw new Error(`不明なオプション: ${a}（--help で使い方を表示）`);
    }
  }
  return opts;
}

function printHelp() {
  const src = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
  const doc = src.slice(src.indexOf("/**"), src.indexOf("*/") + 2);
  console.log(doc.replace(/^\/\*\*|\s*\*\/$/g, "").replace(/^ \* ?/gm, ""));
}

// ── CSV 読み込み ────────────────────────────────────────
function readSheets(dir) {
  if (!fs.existsSync(dir)) throw new Error(`--dir のディレクトリが見つかりません: ${dir}`);
  const sheets = {};
  const missing = [];
  for (const [name, { required }] of Object.entries(SHEET_FILES)) {
    const file = path.join(dir, `${name}.csv`);
    if (!fs.existsSync(file)) {
      if (required) missing.push(`${name}.csv`);
      sheets[name] = [];
      continue;
    }
    sheets[name] = parseCsv(fs.readFileSync(file, "utf8"));
  }
  if (missing.length > 0) {
    throw new Error(
      `必須の CSV がありません: ${missing.join(", ")}\n` +
        `スプレッドシートの各シートを「ファイル > ダウンロード > カンマ区切り形式(.csv)」で保存し、` +
        `シート名と同じファイル名で ${dir} に置いてください。`
    );
  }
  return sheets;
}

// task_id の接頭辞を全参照に一貫適用する（他テナントとの task_id 衝突回避）
function applyTaskIdPrefix(plan, prefix) {
  if (!prefix) return plan;
  const p = (id) => (id ? `${prefix}${id}` : id);
  for (const t of plan.taskMaster) t.task_id = p(t.task_id);
  for (const t of plan.customTasks) t.task_id = p(t.task_id);
  for (const r of plan.taskProgress) r.task_id = p(r.task_id);
  for (const r of plan.taskVisibility) r.task_id = p(r.task_id);
  for (const r of plan.taskItems) r.task_id = p(r.task_id);
  for (const r of plan.messageDrafts) r.task_id = p(r.task_id);
  return plan;
}

// ── DB ──────────────────────────────────────────────────
function loadPostgres() {
  // src/ の依存を借りる（scripts/ 側に node_modules を増やさない）
  const require = createRequire(pathToFileURL(path.join(REPO_ROOT, "src", "package.json")));
  try {
    return require("postgres");
  } catch {
    throw new Error(
      `postgres クライアントを読み込めませんでした。先に依存をインストールしてください:\n` +
        `  cd ${path.join(REPO_ROOT, "src")} && npm install`
    );
  }
}

// Postgres のバインドパラメータ上限（65535）に当たらないよう、まとめて投げる行数を抑える。
// 最大列数 11（task_master）でも 500 行 = 5,500 パラメータで十分に収まる。
const CHUNK = 500;

function chunked(rows) {
  const out = [];
  for (let i = 0; i < rows.length; i += CHUNK) out.push(rows.slice(i, i + CHUNK));
  return out;
}

async function resolveCompanyId(sql, { companyId, adminEmail }) {
  if (companyId) {
    const rows = await sql`select id, name from companies where id = ${companyId}::uuid`;
    if (rows.length === 0) throw new Error(`company が見つかりません: ${companyId}`);
    return { id: rows[0].id, name: rows[0].name };
  }
  const rows = await sql`
    select c.id, c.name
      from tenant_admins ta
      join companies c on c.id = ta.company_id
     where lower(ta.email) = lower(${adminEmail})`;
  if (rows.length === 0) {
    throw new Error(
      `メール ${adminEmail} に紐づくテナントが見つかりません。` +
        `先に /signup で管理者アカウントを作成してください（app.provision_tenant が company を作ります）。`
    );
  }
  if (rows.length > 1) throw new Error(`メール ${adminEmail} が複数テナントに紐づいています。--company-id で指定してください。`);
  return { id: rows[0].id, name: rows[0].name };
}

// 他テナントが既に持っている ID（グローバル PK）を検出する。上書き事故を防ぐため事前に落とす。
async function detectCrossTenantConflicts(sql, companyId, plan) {
  const conflicts = [];
  const check = async (label, table, idCol, ids) => {
    for (const part of chunked(ids)) {
      if (conflicts.length >= 20) return;
      const rows = await sql`
        select ${sql(idCol)} as id, company_id
          from ${sql(table)}
         where ${sql(idCol)} in ${sql(part)}
           and company_id <> ${companyId}::uuid
         limit 20`;
      for (const r of rows) conflicts.push({ label, table, id: r.id, owner: r.company_id });
    }
  };
  const taskIds = [...plan.taskMaster, ...plan.customTasks].map((t) => t.task_id);
  await check("タスク", "task_master", "task_id", taskIds);
  await check("タスク", "custom_tasks", "task_id", taskIds);
  await check("カップル", "customers", "line_id", plan.customers.map((c) => c.line_id));
  await check("配信ログ", "message_drafts", "draft_id", plan.messageDrafts.map((d) => d.draft_id));
  await check("手配物", "task_items", "item_id", plan.taskItems.map((t) => t.item_id));
  return conflicts;
}

async function fetchExistingLineIds(sql, companyId) {
  const rows = await sql`select line_id from customers where company_id = ${companyId}::uuid`;
  return new Set(rows.map((r) => r.line_id));
}

async function countRows(sql, companyId) {
  const one = async (q) => Number((await q)[0].count);
  return {
    venues: await one(sql`select count(*)::int as count from venues where company_id = ${companyId}::uuid`),
    customers: await one(sql`select count(*)::int as count from customers where company_id = ${companyId}::uuid`),
    task_master: await one(sql`select count(*)::int as count from task_master where company_id = ${companyId}::uuid`),
    custom_tasks: await one(sql`select count(*)::int as count from custom_tasks where company_id = ${companyId}::uuid`),
    task_items: await one(sql`select count(*)::int as count from task_items where company_id = ${companyId}::uuid`),
    message_drafts: await one(sql`select count(*)::int as count from message_drafts where company_id = ${companyId}::uuid`),
    task_progress: await one(sql`
      select count(*)::int as count from task_progress p
        join customers c on c.line_id = p.line_id where c.company_id = ${companyId}::uuid`),
    task_visibility: await one(sql`
      select count(*)::int as count from task_visibility v
        join customers c on c.line_id = v.line_id where c.company_id = ${companyId}::uuid`),
  };
}

// 実投入。1トランザクション。全て upsert なので再実行しても件数は増えない（冪等）。
async function applyPlan(sql, companyId, plan) {
  await sql.begin(async (tx) => {
    // venues: (company_id, code) が一意（0002 の部分ユニークインデックス）。code → uuid を解決して以降の FK に使う。
    for (const v of plan.venues) {
      await tx`
        insert into venues (company_id, code, venue_name, planner_line_user_id,
                            line_channel_access_token, line_liff_id, active, created_at)
        values (${companyId}::uuid, ${v.code}, ${v.venue_name}, ${v.planner_line_user_id},
                ${v.line_channel_access_token}, ${v.line_liff_id}, ${v.active}, ${v.created_at}::timestamptz)
        on conflict (company_id, code) where code <> '' do update set
          venue_name = excluded.venue_name,
          planner_line_user_id = excluded.planner_line_user_id,
          line_channel_access_token = excluded.line_channel_access_token,
          line_liff_id = excluded.line_liff_id,
          active = excluded.active`;
    }
    const venueRows = await tx`select id, code from venues where company_id = ${companyId}::uuid and code <> ''`;
    const venueIdOf = new Map(venueRows.map((r) => [r.code, r.id]));

    {
      const rows = plan.customers.map((c) => ({
        line_id: c.line_id,
        company_id: companyId,
        venue_id: c.venue_code ? venueIdOf.get(c.venue_code) ?? null : null,
        wedding_date: c.wedding_date,
        name1_kana: c.name1_kana,
        name2_kana: c.name2_kana,
        is_admin: c.is_admin,
        created_at: c.created_at,
      }));
      for (const part of chunked(rows)) await tx`
        insert into customers ${tx(part, "line_id", "company_id", "venue_id", "wedding_date", "name1_kana", "name2_kana", "is_admin", "created_at")}
        on conflict (line_id) do update set
          venue_id = excluded.venue_id, wedding_date = excluded.wedding_date,
          name1_kana = excluded.name1_kana, name2_kana = excluded.name2_kana,
          is_admin = excluded.is_admin
        where customers.company_id = excluded.company_id`;
    }

    {
      const rows = plan.taskMaster.map((t) => ({
        task_id: t.task_id,
        company_id: companyId,
        venue_id: t.venue_code ? venueIdOf.get(t.venue_code) ?? null : null,
        category: t.category, task_content: t.task_content, due_formula: t.due_formula,
        due_estimate: t.due_estimate, memo: t.memo, manual_url: t.manual_url,
        reminder_message: t.reminder_message, is_active: t.is_active,
      }));
      for (const part of chunked(rows)) await tx`
        insert into task_master ${tx(part, "task_id", "company_id", "venue_id", "category", "task_content", "due_formula", "due_estimate", "memo", "manual_url", "reminder_message", "is_active")}
        on conflict (task_id) do update set
          venue_id = excluded.venue_id, category = excluded.category,
          task_content = excluded.task_content, due_formula = excluded.due_formula,
          due_estimate = excluded.due_estimate, memo = excluded.memo,
          manual_url = excluded.manual_url, reminder_message = excluded.reminder_message,
          is_active = excluded.is_active
        where task_master.company_id = excluded.company_id`;
    }

    {
      const rows = plan.customTasks.map((t) => ({
        task_id: t.task_id, company_id: companyId, target_line_id: t.target_line_id,
        category: t.category, task_content: t.task_content, due_formula: t.due_formula,
        due_estimate: t.due_estimate, memo: t.memo, manual_url: t.manual_url, is_active: t.is_active,
      }));
      for (const part of chunked(rows)) await tx`
        insert into custom_tasks ${tx(part, "task_id", "company_id", "target_line_id", "category", "task_content", "due_formula", "due_estimate", "memo", "manual_url", "is_active")}
        on conflict (task_id) do update set
          target_line_id = excluded.target_line_id, category = excluded.category,
          task_content = excluded.task_content, due_formula = excluded.due_formula,
          due_estimate = excluded.due_estimate, memo = excluded.memo,
          manual_url = excluded.manual_url, is_active = excluded.is_active
        where custom_tasks.company_id = excluded.company_id`;
    }

    // 進捗は「Sheets の方が新しいときだけ」上書きする（移行後に本番運用が始まっていても壊さない）
    for (const part of chunked(plan.taskProgress)) await tx`
      insert into task_progress ${tx(part, "line_id", "task_id", "is_done", "comment", "updated_at")}
      on conflict (line_id, task_id) do update set
        is_done = excluded.is_done, comment = excluded.comment, updated_at = excluded.updated_at
      where task_progress.updated_at <= excluded.updated_at`;

    for (const part of chunked(plan.taskVisibility)) await tx`
      insert into task_visibility ${tx(part, "line_id", "task_id", "hidden")}
      on conflict (line_id, task_id) do update set hidden = excluded.hidden`;

    {
      const rows = plan.taskItems.map((t) => ({ ...t, company_id: companyId }));
      for (const part of chunked(rows)) await tx`
        insert into task_items ${tx(part, "item_id", "company_id", "task_id", "line_id", "item_name", "quantity", "is_done", "memo", "created_at")}
        on conflict (item_id) do update set
          task_id = excluded.task_id, line_id = excluded.line_id, item_name = excluded.item_name,
          quantity = excluded.quantity, is_done = excluded.is_done, memo = excluded.memo
        where task_items.company_id = excluded.company_id`;
    }

    {
      const rows = plan.messageDrafts.map((d) => ({
        draft_id: d.draft_id, company_id: companyId,
        venue_id: d.venue_code ? venueIdOf.get(d.venue_code) ?? null : null,
        couple_id: d.couple_id, task_id: d.task_id, draft_message: d.draft_message,
        status: d.status, created_at: d.created_at, sent_at: d.sent_at,
      }));
      for (const part of chunked(rows)) await tx`
        insert into message_drafts ${tx(part, "draft_id", "company_id", "venue_id", "couple_id", "task_id", "draft_message", "status", "created_at", "sent_at")}
        on conflict (draft_id) do update set
          venue_id = excluded.venue_id, couple_id = excluded.couple_id, task_id = excluded.task_id,
          draft_message = excluded.draft_message, status = excluded.status, sent_at = excluded.sent_at
        where message_drafts.company_id = excluded.company_id`;
    }
  });
}

// ── レポート ────────────────────────────────────────────
const TABLE_OF = {
  venues: "venues", customers: "customers", task_master: ["task_master", "custom_tasks"],
  task_progress: "task_progress", user_hidden_tasks: "task_visibility",
  task_items: "task_items", message_drafts: "message_drafts",
};

function printReport({ mode, company, report, plan, before, after, conflicts }) {
  const line = "─".repeat(62);
  console.log(`\n${line}`);
  console.log(`Sheets → Supabase 移行レポート（${mode}）`);
  if (company) console.log(`投入先テナント: ${company.name}（${company.id}）`);
  console.log(line);

  console.log("\n■ シート別の読み取りと変換");
  for (const [name, r] of Object.entries(report.sheets)) {
    const dest = TABLE_OF[name];
    const destLabel = Array.isArray(dest) ? dest.join(" + ") : dest;
    console.log(`  ${name.padEnd(18)} 読取 ${String(r.read).padStart(5)} 行 → 投入予定 ${String(r.planned).padStart(5)} 件  (→ ${destLabel})`);
    if (r.skips.length > 0) {
      console.log(`    skip ${r.skips.length} 件:`);
      for (const s of r.skips.slice(0, 10)) console.log(`      ${name}.csv ${s.row}行目: ${s.reason}`);
      if (r.skips.length > 10) console.log(`      … 他 ${r.skips.length - 10} 件`);
    }
  }

  console.log("\n■ 投入予定の内訳（テーブル別）");
  const planned = {
    venues: plan.venues.length, customers: plan.customers.length,
    task_master: plan.taskMaster.length, custom_tasks: plan.customTasks.length,
    task_progress: plan.taskProgress.length, task_visibility: plan.taskVisibility.length,
    task_items: plan.taskItems.length, message_drafts: plan.messageDrafts.length,
  };
  for (const [table, n] of Object.entries(planned)) {
    if (before && after) {
      const b = before[table] ?? 0;
      const a = after[table] ?? 0;
      const diff = a - b;
      console.log(`  ${table.padEnd(18)} 投入 ${String(n).padStart(5)} 件  DB ${String(b).padStart(5)} → ${String(a).padStart(5)}（新規 ${diff}・更新 ${n - diff}）`);
    } else if (before) {
      console.log(`  ${table.padEnd(18)} 投入予定 ${String(n).padStart(5)} 件  現在の DB ${String(before[table] ?? 0).padStart(5)} 件`);
    } else {
      console.log(`  ${table.padEnd(18)} 投入予定 ${String(n).padStart(5)} 件`);
    }
  }

  if (conflicts && conflicts.length > 0) {
    console.log("\n■ 他テナントとの ID 衝突（投入を中止しました）");
    for (const c of conflicts) console.log(`  ${c.label}: ${c.table}.${c.id} は別テナント（${c.owner}）が使用中`);
    console.log(`  → --task-id-prefix "RC-" のように接頭辞を付けて ID をずらしてから再実行してください。`);
  }

  if (report.infos.length > 0) {
    console.log("\n■ 補足");
    for (const m of report.infos) console.log(`  - ${m}`);
  }
  if (report.warnings.length > 0) {
    console.log("\n■ 要確認");
    for (const m of report.warnings) console.log(`  ! ${m}`);
  }

  console.log("\n■ 移行後にやること");
  console.log("  - LINE の channel_secret / login_channel_id は Sheets に無いため空です。");
  console.log("    /onboarding の Step2-3 で式場ごとに入力し、接続テストが全緑になることを確認してください。");
  console.log("  - 管理者は tenant_admins（メール認証）が根拠です。旧 is_admin=TRUE の担当者には /signup を案内してください。");
  console.log(`${line}\n`);
}

// ── main ────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) return printHelp();
  if (!opts.dir) throw new Error("--dir が必要です（--help で使い方を表示）");
  if (opts.apply && opts.planOnly) throw new Error("--apply と --plan-only は同時に指定できません");

  const sheets = readSheets(path.resolve(opts.dir));

  if (opts.planOnly) {
    const { plan, report } = buildPlan(sheets);
    applyTaskIdPrefix(plan, opts.taskIdPrefix);
    printReport({ mode: "変換の検算のみ（DB 未接続）", report, plan });
    if (opts.json) console.log(JSON.stringify({ report, planned: plan }, null, 2));
    return;
  }

  if (!opts.companyId && !opts.adminEmail) {
    throw new Error("--company-id または --admin-email で投入先テナントを指定してください");
  }
  const databaseUrl = opts.databaseUrl || process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "接続先がありません。--database-url か env MIGRATE_DATABASE_URL を指定してください。\n" +
        "  例（ローカル）: postgres://postgres:postgres@127.0.0.1:54322/postgres\n" +
        "  ※ owner ロールで接続します（app_couple では RLS/grant により customers 等に INSERT できません）"
    );
  }

  const postgres = loadPostgres();
  const sql = postgres(databaseUrl, { prepare: false, onnotice: () => {} });
  try {
    const company = await resolveCompanyId(sql, opts);
    const existingLineIds = await fetchExistingLineIds(sql, company.id);
    const { plan, report } = buildPlan(sheets, { existingLineIds });
    applyTaskIdPrefix(plan, opts.taskIdPrefix);

    const conflicts = await detectCrossTenantConflicts(sql, company.id, plan);
    const before = await countRows(sql, company.id);

    if (conflicts.length > 0) {
      printReport({ mode: "中止", company, report, plan, before, conflicts });
      process.exitCode = 1;
      return;
    }

    if (!opts.apply) {
      printReport({ mode: "ドライラン（書き込みなし）", company, report, plan, before });
      console.log("投入するには同じコマンドに --apply を付けて再実行してください。\n");
      if (opts.json) console.log(JSON.stringify({ company, report, planned: plan, before }, null, 2));
      return;
    }

    await applyPlan(sql, company.id, plan);
    const after = await countRows(sql, company.id);
    printReport({ mode: "投入完了", company, report, plan, before, after });
    if (opts.json) console.log(JSON.stringify({ company, report, before, after }, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(`\n[ERROR] ${err.message}\n`);
  process.exitCode = 1;
});
