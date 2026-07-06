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
      // 自分の customer 行（RLS で自分のみ）
      const [customer] = await tx`
        select line_id, company_id, wedding_date, name1_kana, name2_kana, is_admin
        from customers where line_id = ${session.lineId}`;
      if (!customer) return null;

      // 共有雛形 + カスタム（RLS で自社/自分のみに絞られる）
      const shared = await tx`
        select task_id, category, task_content, due_formula, due_estimate, memo,
               manual_url, false as is_custom
        from task_master where is_active`;
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
        wedding_date: customer.wedding_date ?? undefined,
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
