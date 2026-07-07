import { NextRequest } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/server/session";
import { withLineScope } from "@/lib/server/db";
import { ok, fail, newRequestId } from "@/lib/server/http";

export const runtime = "nodejs";

// GET /api/user(?target_line_id=)  → 旧 GAS の getUser。
// 自分自身の照会: exists / planner / not_found（LIFF ルートの振り分け・useAdminAuth の is_admin 判定）。
// target_line_id 指定（管理画面がカップル情報を出すケース）は呼び出し元が管理者のときのみ許可。
// line_id は常に検証済みセッション由来。target は「誰を見るか」の指定であって認証情報ではない。
export async function GET(req: NextRequest) {
  const rid = newRequestId();

  const session = await readSession();
  if (!session) return fail("AUTH_REQUIRED", rid);

  const target =
    req.nextUrl.searchParams.get("target_line_id") || session.lineId;

  try {
    const result = await withLineScope(session.lineId, async (tx) => {
      if (target !== session.lineId) {
        const [me] = await tx`
          select is_admin from customers where line_id = ${session.lineId}`;
        if (!me?.is_admin) return { forbidden: true as const };
      }

      // RLS: 自分の行、または（管理者なら）自社顧客の行だけが見える
      const [customer] = await tx`
        select c.line_id,
               coalesce(v.code, '') as venue_code,
               coalesce(to_char(c.wedding_date, 'YYYY-MM-DD'), '') as wedding_date,
               c.name1_kana, c.name2_kana, c.is_admin
        from customers c
        left join venues v on v.id = c.venue_id
        where c.line_id = ${target}`;

      if (customer) {
        return {
          status: "exists" as const,
          venue_id: customer.venue_code,
          wedding_date: customer.wedding_date,
          name1_kana: customer.name1_kana ?? "",
          name2_kana: customer.name2_kana ?? "",
          is_admin: customer.is_admin ?? false,
        };
      }

      if (target === session.lineId) {
        // customer 未登録でも、式場の担当プランナーなら planner として案内（GAS と同じ）
        const [venue] = await tx`
          select code, venue_name from venues
          where planner_line_user_id = ${session.lineId}
          limit 1`;
        if (venue) {
          return {
            status: "planner" as const,
            venue_id: venue.code,
            venue_name: venue.venue_name,
          };
        }
      }

      return { status: "not_found" as const };
    });

    if ("forbidden" in result) return fail("FORBIDDEN_IDOR", rid);
    return ok(result, rid);
  } catch (e) {
    return fail("INTERNAL", rid, { cause: e });
  }
}

// POST /api/user  → 旧 GAS の register。
// 未登録状態で venue 解決＋customer 作成が必要なため、RLS の例外は
// security definer 関数 app.register_customer() の中だけに閉じている。
const RegisterBody = z.object({
  wedding_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "wedding_date は YYYY-MM-DD 形式")
    .optional(),
  name1_kana: z.string().optional(),
  name2_kana: z.string().optional(),
  venue_id: z.string().optional(), // QR 経由の式場コード（RC001 形式）
});

export async function POST(req: NextRequest) {
  const rid = newRequestId();

  const session = await readSession();
  if (!session) return fail("AUTH_REQUIRED", rid);

  let body: z.infer<typeof RegisterBody>;
  try {
    body = RegisterBody.parse(await req.json());
  } catch {
    return fail("VALIDATION", rid);
  }

  try {
    const result = await withLineScope(session.lineId, async (tx) => {
      const [row] = await tx`
        select app.register_customer(
          ${body.wedding_date ?? null},
          ${body.name1_kana ?? ""},
          ${body.name2_kana ?? ""},
          ${body.venue_id ?? ""}) as result`;
      return row.result as Record<string, unknown>;
    });
    return ok(result, rid);
  } catch (e) {
    return fail("INTERNAL", rid, { cause: e });
  }
}
