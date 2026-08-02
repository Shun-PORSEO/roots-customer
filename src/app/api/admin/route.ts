import { NextRequest } from "next/server";
import { z } from "zod";
import type postgres from "postgres";
import { readAdminSession } from "@/lib/server/session";
import { withAdminScope } from "@/lib/server/db";
import { ok, fail, newRequestId, type ErrorCode } from "@/lib/server/http";
import { pushLineMessage } from "@/lib/server/line";
import { runLineConnectionTest, type LineTestInput } from "@/lib/server/lineTest";
import { env } from "@/lib/server/env";

export const runtime = "nodejs";

// POST /api/admin  → 旧 GAS doPost のプランナー向け全アクション（GAS と同じ action ディスパッチ形式）。
// - 呼び出し元はテナント管理者セッション（Supabase Auth 検証済みの auth.users.id）で認証する（SaaS化 C1）。
//   旧「LINE ログイン + customers.is_admin」方式は廃止（D4）。
// - 全クエリは app_couple + RLS（管理者ポリシー = tenant_admins 経由で自社 company 内のみ）の下で実行される。
//   → action 実装が WHERE を書き落としても他社データには届かない（多層防御）。
// - venue_id は人間可読コード（RC001 形式 = venues.code）。DB 内部の uuid はここで解決する。

type Tx = postgres.TransactionSql;

// ハンドラ内から HTTP エラーを投げるための例外（外側で統一 DTO に変換）
class HttpError extends Error {
  constructor(public code: ErrorCode, message?: string) {
    super(message);
  }
}

const clampQty = (q: unknown) => Math.max(1, Math.floor(Number(q) || 1));

// LINE push / 接続テストの外部呼び出しは DB トランザクションの外で行う（tx を長引かせない）。
// bestEffort=true（手配物確定通知）は失敗してもレスポンスは成功のまま（GAS と同じ）。
type PushRequest = { to: string; text: string; token: string; bestEffort: boolean };
type HandlerResult = Record<string, unknown> & {
  __push?: PushRequest;
  __lineTest?: Omit<LineTestInput, "expectedWebhookUrl"> & { venueCode: string };
};

// ─── 入力スキーマ（action ごと）─────────────────────────────────────────
const patchStr = z.string().optional();
const Schemas = {
  getVenues: z.object({}),
  createVenue: z.object({
    venue_id: z.string().min(1),
    venue_name: z.string().min(1),
    planner_line_user_id: z.string().optional(),
    line_liff_id: z.string().optional(),
    line_channel_access_token: z.string().optional(),
    line_channel_secret: z.string().optional(),
    line_login_channel_id: z.string().optional(),
  }),
  updateVenue: z.object({
    venue_id: z.string().min(1),
    patch: z.object({
      venue_name: patchStr,
      planner_line_user_id: patchStr,
      line_liff_id: patchStr,
      line_channel_access_token: patchStr,
      line_channel_secret: patchStr,
      line_login_channel_id: patchStr,
    }),
  }),
  updateVenueStatus: z.object({ venue_id: z.string().min(1), active: z.boolean() }),
  testLineConnection: z.object({ venue_id: z.string().min(1) }),
  getVenueDetail: z.object({ venue_id: z.string().min(1) }),
  getVenueTasks: z.object({ venue_id: z.string().optional() }),
  updateTaskMaster: z.object({
    task_id: z.string().min(1),
    patch: z.object({
      category: patchStr,
      task_content: patchStr,
      due_formula: patchStr,
      due_estimate: patchStr,
      memo: patchStr,
      reminder_message: patchStr,
      manual_url: patchStr,
      is_active: z.boolean().optional(),
    }),
  }),
  addTaskMaster: z.object({
    venue_id: z.string().optional(),
    task: z.object({
      category: patchStr,
      task_content: z.string().min(1),
      due_formula: patchStr,
      due_estimate: patchStr,
      memo: patchStr,
      reminder_message: patchStr,
      manual_url: patchStr,
    }),
  }),
  updateTaskManualUrl: z.object({
    task_id: z.string().min(1),
    venue_id: z.string().optional(),
    manual_url: z.string(),
  }),
  testSendTask: z.object({ venue_id: z.string().min(1), task_id: z.string().min(1) }),
  getUsers: z.object({ venue_id: z.string().optional() }),
  getUsersWithProgress: z.object({ venue_id: z.string().optional() }),
  getAdminUserTasks: z.object({ target_line_id: z.string().min(1) }),
  toggleTaskVisibility: z.object({
    target_line_id: z.string().min(1),
    task_id: z.string().min(1),
    is_visible: z.boolean(),
  }),
  addCustomTask: z.object({
    target_line_id: z.string().min(1),
    task: z.object({
      category: patchStr,
      task_content: z.string().min(1),
      due_formula: patchStr,
      due_estimate: patchStr,
      memo: patchStr,
    }),
  }),
  deleteCustomTask: z.object({ task_id: z.string().min(1) }),
  getTaskItems: z.object({ target_line_id: z.string().min(1) }),
  addTaskItem: z.object({
    target_line_id: z.string().min(1),
    task_id: z.string().min(1),
    item_name: z.string().trim().min(1),
    quantity: z.coerce.number().optional(),
    memo: z.string().optional(),
  }),
  updateTaskItem: z.object({
    item_id: z.string().min(1),
    patch: z.object({
      item_name: patchStr,
      quantity: z.coerce.number().optional(),
      is_done: z.boolean().optional(),
      memo: patchStr,
    }),
    // 確定（is_done=true）時のカップル向け LINE 通知用（notify フラグ付きのときだけ送る）
    notify: z.boolean().optional(),
    target_line_id: z.string().optional(),
    item_name: z.string().optional(),
    task_content: z.string().optional(),
  }),
  deleteTaskItem: z.object({ item_id: z.string().min(1) }),
  getTaskItemTemplates: z.object({ task_id: z.string().min(1) }),
  addTaskItemTemplate: z.object({
    task_id: z.string().min(1),
    item_name: z.string().trim().min(1),
    quantity: z.coerce.number().optional(),
    memo: z.string().optional(),
  }),
  getMessageDrafts: z.object({
    venue_id: z.string().optional(),
    status: z.string().optional(),
  }),
  updateDraftStatus: z.object({ draft_id: z.string().min(1), draft_status: z.string().min(1) }),
  updateDraftMessage: z.object({ draft_id: z.string().min(1), message: z.string() }),
} as const;

function parse<T extends z.ZodTypeAny>(schema: T, raw: unknown): z.infer<T> {
  const r = schema.safeParse(raw);
  if (!r.success) {
    throw new HttpError("VALIDATION", r.error.issues[0]?.message);
  }
  return r.data;
}

// ─── 共通クエリ ──────────────────────────────────────────────────────────
// secret 系（channel secret / access token）は値を返さず設定済みフラグのみ返す
const VENUE_COLS = (tx: Tx) => tx`
  select code as venue_id, venue_name, planner_line_user_id, line_liff_id,
         line_login_channel_id,
         (line_channel_access_token <> '') as has_channel_access_token,
         (line_channel_secret <> '') as has_channel_secret,
         active,
         coalesce(to_char(created_at, 'YYYY-MM-DD'), '') as created_at
  from venues where code <> '' order by code`;

async function venueByCode(tx: Tx, code: string) {
  const [venue] = await tx`select * from venues where code = ${code} limit 1`;
  return venue as
    | {
        id: string;
        code: string;
        venue_name: string;
        planner_line_user_id: string;
        line_channel_access_token: string;
      }
    | undefined;
}

// 対象カップルが自社に存在することを確認して返す（RLS で他社は最初から見えない）
async function requireTarget(tx: Tx, targetLineId: string) {
  const [target] = await tx`
    select line_id, venue_id from customers where line_id = ${targetLineId}`;
  if (!target) throw new HttpError("NOT_FOUND", "Customer not found");
  return target as { line_id: string; venue_id: string | null };
}

const ITEM_COLS = (tx: Tx) => tx`
  item_id, task_id, coalesce(line_id, '') as line_id, item_name,
  quantity, is_done, memo, created_at`;

// getUsersWithProgress / getVenueDetail 共通:
// 表示対象タスク（base + 自 venue の共有雛形 + 本人のカスタム − 非表示）を数える（GAS と同じ規則）
async function usersWithProgress(tx: Tx, venueCode?: string) {
  const customers = await tx`
    select c.line_id,
           coalesce(v.code, '') as venue_id,
           c.venue_id as venue_uuid,
           coalesce(to_char(c.wedding_date, 'YYYY-MM-DD'), '') as wedding_date,
           coalesce(to_char(c.created_at, 'YYYY-MM-DD'), '') as created_at,
           c.name1_kana, c.name2_kana, c.is_admin
    from customers c
    left join venues v on v.id = c.venue_id
    ${venueCode ? tx`where v.code = ${venueCode}` : tx``}
    order by c.created_at`;

  const master = await tx`select task_id, venue_id from task_master where is_active`;
  const customs = await tx`select task_id, target_line_id from custom_tasks where is_active`;
  const progress = await tx`select line_id, task_id, is_done from task_progress`;
  const hidden = await tx`select line_id, task_id from task_visibility where hidden`;

  const doneByUser = new Map<string, Set<string>>();
  for (const p of progress) {
    if (!p.is_done) continue;
    if (!doneByUser.has(p.line_id)) doneByUser.set(p.line_id, new Set());
    doneByUser.get(p.line_id)!.add(p.task_id);
  }
  const hiddenByUser = new Map<string, Set<string>>();
  for (const h of hidden) {
    if (!hiddenByUser.has(h.line_id)) hiddenByUser.set(h.line_id, new Set());
    hiddenByUser.get(h.line_id)!.add(h.task_id);
  }

  return customers.map((c) => {
    const hiddenSet = hiddenByUser.get(c.line_id) ?? new Set<string>();
    const visibleIds = [
      ...master
        .filter((t) => !t.venue_id || t.venue_id === c.venue_uuid)
        .map((t) => t.task_id as string),
      ...customs
        .filter((t) => t.target_line_id === c.line_id)
        .map((t) => t.task_id as string),
    ].filter((id) => !hiddenSet.has(id));
    const doneSet = doneByUser.get(c.line_id) ?? new Set<string>();
    return {
      line_id: c.line_id,
      venue_id: c.venue_id,
      wedding_date: c.wedding_date,
      created_at: c.created_at,
      name1_kana: c.name1_kana ?? "",
      name2_kana: c.name2_kana ?? "",
      is_admin: c.is_admin ?? false,
      total_tasks: visibleIds.length,
      done_tasks: visibleIds.filter((id) => doneSet.has(id)).length,
    };
  });
}

// ─── ハンドラ本体 ────────────────────────────────────────────────────────
async function dispatch(tx: Tx, action: string, raw: unknown): Promise<HandlerResult> {
  switch (action) {
    // ── 式場 ──────────────────────────────────────────────
    case "getVenues": {
      const venues = await VENUE_COLS(tx);
      return { status: "ok", venues };
    }
    case "createVenue": {
      const p = parse(Schemas.createVenue, raw);
      await tx`
        insert into venues (company_id, code, venue_name, planner_line_user_id, line_liff_id,
                            line_channel_access_token, line_channel_secret, line_login_channel_id)
        values (app.current_company_id(), ${p.venue_id}, ${p.venue_name},
                ${p.planner_line_user_id ?? ""}, ${p.line_liff_id ?? ""},
                ${p.line_channel_access_token ?? ""}, ${p.line_channel_secret ?? ""},
                ${p.line_login_channel_id ?? ""})`;
      return { status: "created" };
    }
    case "updateVenue": {
      const p = parse(Schemas.updateVenue, raw);
      const r = await tx`
        update venues set
          venue_name                = coalesce(${p.patch.venue_name ?? null}, venue_name),
          planner_line_user_id      = coalesce(${p.patch.planner_line_user_id ?? null}, planner_line_user_id),
          line_liff_id              = coalesce(${p.patch.line_liff_id ?? null}, line_liff_id),
          line_channel_access_token = coalesce(${p.patch.line_channel_access_token ?? null}, line_channel_access_token),
          line_channel_secret       = coalesce(${p.patch.line_channel_secret ?? null}, line_channel_secret),
          line_login_channel_id     = coalesce(${p.patch.line_login_channel_id ?? null}, line_login_channel_id)
        where code = ${p.venue_id}`;
      if (r.count === 0) throw new HttpError("NOT_FOUND", "Venue not found");
      return { status: "updated" };
    }
    case "testLineConnection": {
      const p = parse(Schemas.testLineConnection, raw);
      // secret/token は tx 内で読むだけ（クライアントには返さない）。実際の外部呼び出しは
      // __push と同じくトランザクション確定後に POST ハンドラ側で行う。
      const [venue] = await tx`
        select code, line_channel_access_token, line_channel_secret,
               line_login_channel_id, line_liff_id
        from venues where code = ${p.venue_id} limit 1`;
      if (!venue) throw new HttpError("NOT_FOUND", "Venue not found");
      return {
        status: "ok",
        __lineTest: {
          venueCode: venue.code,
          channelAccessToken: venue.line_channel_access_token ?? "",
          channelSecret: venue.line_channel_secret ?? "",
          loginChannelId: venue.line_login_channel_id ?? "",
          liffId: venue.line_liff_id ?? "",
        },
      };
    }
    case "updateVenueStatus": {
      const p = parse(Schemas.updateVenueStatus, raw);
      const r = await tx`update venues set active = ${p.active} where code = ${p.venue_id}`;
      if (r.count === 0) throw new HttpError("NOT_FOUND", "Venue not found");
      return { status: "updated" };
    }
    case "getVenueDetail": {
      const p = parse(Schemas.getVenueDetail, raw);
      const [venue] = await tx`
        select code as venue_id, venue_name, planner_line_user_id, line_liff_id,
               line_login_channel_id,
               (line_channel_access_token <> '') as has_channel_access_token,
               (line_channel_secret <> '') as has_channel_secret,
               active,
               coalesce(to_char(created_at, 'YYYY-MM-DD'), '') as created_at
        from venues where code = ${p.venue_id} limit 1`;
      if (!venue) throw new HttpError("NOT_FOUND", "Venue not found");
      const users = await usersWithProgress(tx, p.venue_id);
      const [pending] = await tx`
        select count(*)::int as count
        from message_drafts d join venues v on v.id = d.venue_id
        where v.code = ${p.venue_id} and d.status = 'pending'`;
      return { status: "ok", venue, users, pending_drafts_count: pending?.count ?? 0 };
    }

    // ── タスク雛形 ────────────────────────────────────────
    case "getVenueTasks": {
      const p = parse(Schemas.getVenueTasks, raw);
      let venueUuid: string | null = null;
      if (p.venue_id) {
        const venue = await venueByCode(tx, p.venue_id);
        if (!venue) throw new HttpError("NOT_FOUND", "Venue not found");
        venueUuid = venue.id;
      }
      // base（venue_id null）は常に含め、式場選択時はその式場専用タスクも返す。
      // 停止中（is_active=false）も返す（管理画面に「停止中」フィルタがあるため）。
      const tasks = await tx`
        select task_id, category, task_content, due_formula, due_estimate, memo,
               manual_url, reminder_message, is_active
        from task_master
        where (venue_id is null ${venueUuid ? tx`or venue_id = ${venueUuid}` : tx``})
        order by task_id`;
      return { status: "ok", tasks };
    }
    case "updateTaskMaster": {
      const p = parse(Schemas.updateTaskMaster, raw);
      const r = await tx`
        update task_master set
          category         = coalesce(${p.patch.category ?? null}, category),
          task_content     = coalesce(${p.patch.task_content ?? null}, task_content),
          due_formula      = coalesce(${p.patch.due_formula ?? null}, due_formula),
          due_estimate     = coalesce(${p.patch.due_estimate ?? null}, due_estimate),
          memo             = coalesce(${p.patch.memo ?? null}, memo),
          reminder_message = coalesce(${p.patch.reminder_message ?? null}, reminder_message),
          manual_url       = coalesce(${p.patch.manual_url ?? null}, manual_url),
          is_active        = coalesce(${p.patch.is_active ?? null}::boolean, is_active)
        where task_id = ${p.task_id}`;
      if (r.count === 0) throw new HttpError("NOT_FOUND", "Task not found");
      return { status: "updated" };
    }
    case "addTaskMaster": {
      const p = parse(Schemas.addTaskMaster, raw);
      let venueUuid: string | null = null;
      if (p.venue_id) {
        const venue = await venueByCode(tx, p.venue_id);
        if (!venue) throw new HttpError("NOT_FOUND", "Venue not found");
        venueUuid = venue.id;
      }
      const taskId = `T-${Date.now()}`;
      await tx`
        insert into task_master (task_id, company_id, venue_id, category, task_content,
                                 due_formula, due_estimate, memo, reminder_message, manual_url)
        values (${taskId}, app.current_company_id(), ${venueUuid},
                ${p.task.category ?? ""}, ${p.task.task_content},
                ${p.task.due_formula ?? ""}, ${p.task.due_estimate ?? ""},
                ${p.task.memo ?? ""}, ${p.task.reminder_message ?? ""}, ${p.task.manual_url ?? ""})`;
      return { status: "created", task_id: taskId };
    }
    case "updateTaskManualUrl": {
      const p = parse(Schemas.updateTaskManualUrl, raw);
      const url = p.manual_url.trim();
      if (url && !/^https?:\/\//.test(url)) {
        throw new HttpError("VALIDATION", "URLは http(s):// で始めてください");
      }
      const r = await tx`
        update task_master set manual_url = ${url} where task_id = ${p.task_id}`;
      if (r.count === 0) throw new HttpError("NOT_FOUND", "Task not found");
      return { status: "updated" };
    }
    case "testSendTask": {
      const p = parse(Schemas.testSendTask, raw);
      const venue = await venueByCode(tx, p.venue_id);
      if (!venue) throw new HttpError("NOT_FOUND", "Venue not found");
      if (!venue.planner_line_user_id) {
        throw new HttpError("VALIDATION", "この式場のプランナー LINE user_id が未設定です");
      }
      if (!venue.line_channel_access_token && !env.ALLOW_DEV_LINE_BYPASS) {
        throw new HttpError("VALIDATION", "この式場のチャネルアクセストークンが未設定です");
      }
      const [task] = await tx`
        select task_content, reminder_message from task_master where task_id = ${p.task_id}`;
      if (!task) throw new HttpError("NOT_FOUND", "Task not found");
      const body =
        (task.reminder_message ?? "").trim() ||
        `「${task.task_content}」のご案内です。\nお手隙の際にご確認・ご対応をお願いいたします🙇`;
      return {
        status: "ok",
        __push: {
          to: venue.planner_line_user_id,
          text: `【テスト送信】\n${body}`,
          token: venue.line_channel_access_token,
          bestEffort: false,
        },
      };
    }

    // ── 顧客 ──────────────────────────────────────────────
    case "getUsers": {
      const p = parse(Schemas.getUsers, raw);
      const users = await tx`
        select c.line_id,
               coalesce(v.code, '') as venue_id,
               coalesce(to_char(c.wedding_date, 'YYYY-MM-DD'), '') as wedding_date,
               coalesce(to_char(c.created_at, 'YYYY-MM-DD'), '') as created_at,
               c.name1_kana, c.name2_kana, c.is_admin
        from customers c
        left join venues v on v.id = c.venue_id
        ${p.venue_id ? tx`where v.code = ${p.venue_id}` : tx``}
        order by c.created_at`;
      return { status: "ok", users };
    }
    case "getUsersWithProgress": {
      const p = parse(Schemas.getUsersWithProgress, raw);
      return { status: "ok", users: await usersWithProgress(tx, p.venue_id) };
    }
    case "getAdminUserTasks": {
      const p = parse(Schemas.getAdminUserTasks, raw);
      const target = await requireTarget(tx, p.target_line_id);
      const shared = await tx`
        select task_id, category, task_content, due_formula, due_estimate, memo,
               manual_url, reminder_message, false as is_custom
        from task_master
        where is_active
          and (venue_id is null ${target.venue_id ? tx`or venue_id = ${target.venue_id}` : tx``})`;
      const custom = await tx`
        select task_id, category, task_content, due_formula, due_estimate, memo,
               manual_url, '' as reminder_message, true as is_custom
        from custom_tasks
        where is_active and target_line_id = ${target.line_id}`;
      const progress = await tx`
        select task_id, is_done, comment from task_progress where line_id = ${target.line_id}`;
      const hidden = await tx`
        select task_id from task_visibility where line_id = ${target.line_id} and hidden`;

      const progMap = new Map(progress.map((r) => [r.task_id, r]));
      const hiddenSet = new Set(hidden.map((h) => h.task_id));
      // 管理画面は非表示タスクも一覧する（is_visible フラグ付きで全件返す。GAS と同じ）
      const tasks = [...shared, ...custom].map((t) => {
        const prog = progMap.get(t.task_id);
        return {
          ...t,
          is_visible: !hiddenSet.has(t.task_id),
          is_done: prog ? prog.is_done : false,
          comment: prog ? prog.comment ?? "" : "",
        };
      });
      return { status: "ok", tasks };
    }
    case "toggleTaskVisibility": {
      const p = parse(Schemas.toggleTaskVisibility, raw);
      await requireTarget(tx, p.target_line_id);
      await tx`
        insert into task_visibility (line_id, task_id, hidden)
        values (${p.target_line_id}, ${p.task_id}, ${!p.is_visible})
        on conflict (line_id, task_id) do update set hidden = ${!p.is_visible}`;
      return { status: "updated" };
    }
    case "addCustomTask": {
      const p = parse(Schemas.addCustomTask, raw);
      await requireTarget(tx, p.target_line_id);
      const taskId = `CUST-${Date.now()}`;
      await tx`
        insert into custom_tasks (task_id, company_id, target_line_id, category,
                                  task_content, due_formula, due_estimate, memo)
        values (${taskId}, app.current_company_id(), ${p.target_line_id},
                ${p.task.category ?? "追加タスク"}, ${p.task.task_content},
                ${p.task.due_formula ?? ""}, ${p.task.due_estimate ?? ""}, ${p.task.memo ?? ""})`;
      return { status: "created", task_id: taskId };
    }
    case "deleteCustomTask": {
      const p = parse(Schemas.deleteCustomTask, raw);
      await tx`delete from custom_tasks where task_id = ${p.task_id}`;
      return { status: "deleted" };
    }

    // ── 手配物（task_items）──────────────────────────────
    case "getTaskItems": {
      const p = parse(Schemas.getTaskItems, raw);
      const items = await tx`
        select ${ITEM_COLS(tx)} from task_items
        where line_id = ${p.target_line_id} order by created_at`;
      return { status: "ok", items };
    }
    case "addTaskItem": {
      const p = parse(Schemas.addTaskItem, raw);
      await requireTarget(tx, p.target_line_id);
      const [item] = await tx`
        insert into task_items (company_id, task_id, line_id, item_name, quantity, memo)
        values (app.current_company_id(), ${p.task_id}, ${p.target_line_id},
                ${p.item_name}, ${clampQty(p.quantity)}, ${p.memo ?? ""})
        returning ${ITEM_COLS(tx)}`;
      return { status: "created", item };
    }
    case "updateTaskItem": {
      const p = parse(Schemas.updateTaskItem, raw);
      const qty = p.patch.quantity !== undefined ? clampQty(p.patch.quantity) : null;
      const [row] = await tx`
        update task_items set
          item_name = coalesce(${p.patch.item_name ?? null}, item_name),
          quantity  = coalesce(${qty}::int, quantity),
          is_done   = coalesce(${p.patch.is_done ?? null}::boolean, is_done),
          memo      = coalesce(${p.patch.memo ?? null}, memo)
        where item_id = ${p.item_id}
        returning coalesce(line_id, '') as line_id, item_name`;
      if (!row) throw new HttpError("NOT_FOUND", "Item not found");

      // 「確定」(is_done=true) かつ notify のときだけ、カップルへ LINE で確定案内（GAS と同じ文面）
      if (p.patch.is_done === true && p.notify) {
        const targetLineId = p.target_line_id || row.line_id;
        if (targetLineId) {
          const [dest] = await tx`
            select v.line_channel_access_token as token
            from customers c join venues v on v.id = c.venue_id
            where c.line_id = ${targetLineId}`;
          const itemName = p.item_name || row.item_name || "";
          const taskContent = p.task_content || "";
          const label = taskContent ? `「${taskContent}」のタスクの手配物` : "手配物";
          const namePart = itemName ? `「${itemName}」` : "";
          return {
            status: "updated",
            __push: {
              to: targetLineId,
              text: `${label}${namePart}が確定しました。\n確定後24時間は変更できませんのでご了承ください。`,
              token: dest?.token ?? "",
              bestEffort: true, // 通知失敗でも更新自体は成功扱い（GAS と同じ）
            },
          };
        }
      }
      return { status: "updated" };
    }
    case "deleteTaskItem": {
      const p = parse(Schemas.deleteTaskItem, raw);
      const r = await tx`delete from task_items where item_id = ${p.item_id}`;
      if (r.count === 0) throw new HttpError("NOT_FOUND", "Item not found");
      return { status: "deleted" };
    }
    case "getTaskItemTemplates": {
      const p = parse(Schemas.getTaskItemTemplates, raw);
      const items = await tx`
        select ${ITEM_COLS(tx)} from task_items
        where line_id is null and task_id = ${p.task_id} order by created_at`;
      return { status: "ok", items };
    }
    case "addTaskItemTemplate": {
      const p = parse(Schemas.addTaskItemTemplate, raw);
      const [item] = await tx`
        insert into task_items (company_id, task_id, line_id, item_name, quantity, memo)
        values (app.current_company_id(), ${p.task_id}, null,
                ${p.item_name}, ${clampQty(p.quantity)}, ${p.memo ?? ""})
        returning ${ITEM_COLS(tx)}`;
      return { status: "created", item };
    }

    // ── 配信ログ（message_drafts）────────────────────────
    case "getMessageDrafts": {
      const p = parse(Schemas.getMessageDrafts, raw);
      const drafts = await tx`
        select d.draft_id, coalesce(v.code, '') as venue_id, d.couple_id, d.task_id,
               d.draft_message, d.status, d.created_at, d.sent_at
        from message_drafts d
        left join venues v on v.id = d.venue_id
        where (${p.venue_id ?? null}::text is null or v.code = ${p.venue_id ?? null})
          and (${p.status ?? null}::text is null or d.status = ${p.status ?? null})
        order by d.created_at desc`;
      return { status: "ok", drafts };
    }
    case "updateDraftStatus": {
      const p = parse(Schemas.updateDraftStatus, raw);
      const r = await tx`
        update message_drafts set
          status = ${p.draft_status},
          sent_at = case when ${p.draft_status} = 'sent' then now() else sent_at end
        where draft_id = ${p.draft_id}`;
      if (r.count === 0) throw new HttpError("NOT_FOUND", "Draft not found");
      return { status: "updated" };
    }
    case "updateDraftMessage": {
      const p = parse(Schemas.updateDraftMessage, raw);
      const r = await tx`
        update message_drafts set draft_message = ${p.message}
        where draft_id = ${p.draft_id}`;
      if (r.count === 0) throw new HttpError("NOT_FOUND", "Draft not found");
      return { status: "updated" };
    }

    default:
      throw new HttpError("VALIDATION", "Invalid action");
  }
}

export async function POST(req: NextRequest) {
  const rid = newRequestId();

  const session = await readAdminSession();
  if (!session) {
    return fail("AUTH_REQUIRED", rid, {
      message: "ログインが必要です",
      hint: "/login からメールアドレスでログインしてください。",
    });
  }

  let raw: { action?: unknown } & Record<string, unknown>;
  try {
    raw = await req.json();
  } catch {
    return fail("VALIDATION", rid);
  }
  const action = typeof raw.action === "string" ? raw.action : "";
  if (!action) return fail("VALIDATION", rid);

  try {
    const result = await withAdminScope(session.adminId, async (tx) => {
      // tenant_admins に行があること（= テナント作成済み）を必須にする。
      // RLS は「自社内のみ」を二重で保証する。
      const [me] = await tx`select app.is_admin() as is_admin`;
      if (!me?.is_admin) throw new HttpError("FORBIDDEN_IDOR", "Forbidden");
      return dispatch(tx, action, raw);
    });

    // LINE push はトランザクション確定後に送る
    const push = result.__push;
    if (push) {
      delete result.__push;
      try {
        await pushLineMessage(push.to, push.text, push.token);
      } catch (e) {
        if (!push.bestEffort) {
          return fail("LINE_UPSTREAM", rid, { cause: e });
        }
        console.error(`[${rid}] 確定通知の送信に失敗（更新は成功扱い）:`, e);
      }
    }
    // 接続テストもトランザクション確定後に外部呼び出しする（LINE API 待ちで tx を塞がない）
    const lineTest = result.__lineTest;
    if (lineTest) {
      delete result.__lineTest;
      const expectedWebhookUrl = `${req.nextUrl.origin}/api/line/webhook/${lineTest.venueCode}`;
      result.results = await runLineConnectionTest({ ...lineTest, expectedWebhookUrl });
    }
    return ok(result, rid);
  } catch (e) {
    if (e instanceof HttpError) {
      return fail(e.code, rid, { message: e.message || undefined });
    }
    // unique violation（式場コード重複など）は入力起因として返す
    if ((e as { code?: string })?.code === "23505") {
      return fail("VALIDATION", rid, { message: "IDが重複しています（既に登録済みです）" });
    }
    return fail("INTERNAL", rid, { cause: e });
  }
}
