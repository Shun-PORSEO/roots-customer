import { NextRequest } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/server/session";
import { withLineScope } from "@/lib/server/db";
import { ok, fail, newRequestId } from "@/lib/server/http";

export const runtime = "nodejs";

// GET /api/tasks  → 旧 GAS の getTasksAndUser と同一レスポンス形（api.ts シーム維持）。
// line_id はセッションからのみ導出。全 DB アクセスは app_couple + RLS(request.line_id) 下で行う。
export async function GET() {
  const rid = newRequestId();

  const session = await readSession();
  if (!session) {
    // フロントはこの 401 を受けて liff.getIDToken() でサイレント再認証 → 再試行する
    return fail("AUTH_REQUIRED", rid);
  }

  try {
    const result = await withLineScope(session.lineId, async (tx) => {
      // 自分の customer 行（RLS で自分のみ）。wedding_date は文字列で返す
      // （Date のまま JSON 化すると ISO 時刻付きになり、フロントの split("-") が壊れる）。
      const [customer] = await tx`
        select line_id, company_id, venue_id,
               coalesce(to_char(wedding_date, 'YYYY-MM-DD'), '') as wedding_date,
               name1_kana, name2_kana, is_admin
        from customers where line_id = ${session.lineId}`;
      if (!customer) return null;

      // 共有雛形 + カスタム（RLS で自社/自分のみに絞られる）。
      // 共有雛形は base（venue_id null）+ 自分の式場専用のみ（他式場のタスクは混ぜない）。
      const shared = await tx`
        select task_id, category, task_content, due_formula, due_estimate, memo,
               manual_url, false as is_custom
        from task_master
        where is_active
          and (venue_id is null ${customer.venue_id ? tx`or venue_id = ${customer.venue_id}` : tx``})`;
      const custom = await tx`
        select task_id, category, task_content, due_formula, due_estimate, memo,
               manual_url, true as is_custom
        from custom_tasks where is_active`;

      const progress = await tx`
        select task_id, is_done, comment from task_progress`;
      const hidden = await tx`
        select task_id from task_visibility where hidden`;

      const progMap = new Map(progress.map((p) => [p.task_id, p]));
      const hiddenSet = new Set(hidden.map((h) => h.task_id));

      const tasks = [...shared, ...custom]
        .map((t) => {
          const prog = progMap.get(t.task_id);
          return {
            task_id: t.task_id,
            category: t.category,
            task_content: t.task_content,
            due_formula: t.due_formula,
            due_estimate: t.due_estimate,
            memo: t.memo,
            is_done: prog ? prog.is_done : false,
            is_visible: !hiddenSet.has(t.task_id),
            is_custom: t.is_custom,
            manual_url: t.manual_url ?? "",
            comment: prog ? prog.comment ?? "" : "",
          };
        })
        .filter((t) => t.is_visible);

      return {
        status: "ok" as const,
        tasks,
        wedding_date: customer.wedding_date || undefined,
        name1_kana: customer.name1_kana ?? "",
        name2_kana: customer.name2_kana ?? "",
        is_admin: customer.is_admin ?? false,
      };
    });

    if (!result) return fail("NOT_FOUND", rid, { message: "Customer not found" });
    return ok(result, rid);
  } catch (e) {
    return fail("INTERNAL", rid, { cause: e });
  }
}

// PATCH /api/tasks  → 旧 GAS の updateTask / updateTaskComment 相当（カップル自身の書き込み経路）。
// body: { task_id, is_done?, comment? }。line_id はセッションからのみ導出しボディからは受け取らない。
// task_progress は RLS(couple_own_progress) + grant(insert/update) が既にあるのでマイグレーション不要。
const PatchBody = z
  .object({
    task_id: z.string().min(1),
    is_done: z.boolean().optional(),
    comment: z.string().optional(),
  })
  .refine((b) => b.is_done !== undefined || b.comment !== undefined, {
    message: "is_done か comment のいずれかが必要です",
  });

export async function PATCH(req: NextRequest) {
  const rid = newRequestId();

  const session = await readSession();
  if (!session) return fail("AUTH_REQUIRED", rid);

  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch {
    return fail("VALIDATION", rid);
  }

  // 未指定カラムは既存値を保持したいので null を渡し、ON CONFLICT 側で COALESCE する。
  const isDoneParam = body.is_done ?? null;
  const commentParam = body.comment ?? null;

  try {
    await withLineScope(session.lineId, async (tx) => {
      // 新規行は既定（is_done=false / comment=''）で作成し、既存行は指定カラムのみ更新する upsert。
      // with check(line_id = request.line_id) が RLS 側で自分の行のみに強制する。
      await tx`
        insert into task_progress (line_id, task_id, is_done, comment, updated_at)
        values (${session.lineId}, ${body.task_id},
                ${body.is_done ?? false}, ${body.comment ?? ""}, now())
        on conflict (line_id, task_id) do update set
          is_done   = coalesce(${isDoneParam}::boolean, task_progress.is_done),
          comment   = coalesce(${commentParam}::text,   task_progress.comment),
          updated_at = now()`;
    });
    return ok({ status: "updated" as const }, rid);
  } catch (e) {
    return fail("INTERNAL", rid, { cause: e });
  }
}
