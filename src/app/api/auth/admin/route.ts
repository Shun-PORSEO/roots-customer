import { NextRequest } from "next/server";
import { z } from "zod";
import {
  issueAdminSession,
  readAdminSession,
  clearAdminSession,
} from "@/lib/server/session";
import {
  signInWithPassword,
  signUpWithPassword,
  SupabaseAuthError,
} from "@/lib/server/supabaseAuth";
import { withAdminScope } from "@/lib/server/db";
import { ok, fail, newRequestId } from "@/lib/server/http";

export const runtime = "nodejs";

// テナント管理者の認証（SaaS化 C1）。
//   POST {mode:"login",  email, password}                → Supabase Auth 検証 → httpOnly セッション
//   POST {mode:"signup", email, password, company_name}  → ユーザー作成 → セッション → テナント作成
//   GET                                                  → セッション確認（AuthGate 用）
//   DELETE                                               → ログアウト
// アクセストークンはクライアントへ渡さない。DB へは GUC request.admin_id で伝搬し、
// RLS（tenant_admins 経由の app.is_admin() / app.current_company_id()）が自社スコープを保証する。

const Body = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("login"),
    email: z.string().email("メールアドレスの形式が正しくありません"),
    password: z.string().min(1, "パスワードを入力してください"),
  }),
  z.object({
    mode: z.literal("signup"),
    email: z.string().email("メールアドレスの形式が正しくありません"),
    password: z.string().min(8, "パスワードは8文字以上にしてください"),
    company_name: z.string().trim().min(1, "会社名（式場運営会社）を入力してください"),
  }),
]);

// tenant_admins の自社 company を解決（未プロビジョニングなら null）
async function resolveCompany(adminId: string): Promise<string | null> {
  return withAdminScope(adminId, async (tx) => {
    const [row] = await tx`
      select company_id from tenant_admins where auth_user_id = app.current_admin_id()`;
    return (row?.company_id as string | undefined) ?? null;
  });
}

export async function POST(req: NextRequest) {
  const rid = newRequestId();

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message : undefined;
    return fail("VALIDATION", rid, { message, hint: message });
  }

  try {
    if (body.mode === "login") {
      const user = await signInWithPassword(body.email, body.password);
      await issueAdminSession(user.id, user.email || body.email);
      const companyId = await resolveCompany(user.id);
      return ok(
        { status: "ok", email: user.email || body.email, provisioned: companyId !== null },
        rid
      );
    }

    // signup: Auth ユーザー作成 → セッション発行 → テナント作成（冪等）
    const user = await signUpWithPassword(body.email, body.password);
    await issueAdminSession(user.id, user.email || body.email);
    await withAdminScope(user.id, async (tx) => {
      await tx`select app.provision_tenant(${body.company_name}, ${body.email}) as result`;
    });
    return ok({ status: "ok", email: user.email || body.email, provisioned: true }, rid);
  } catch (e) {
    if (e instanceof SupabaseAuthError) {
      const code = e.status === 401 ? "AUTH_REQUIRED" : e.status >= 500 ? "INTERNAL" : "VALIDATION";
      return fail(code, rid, { message: e.message, hint: e.hint });
    }
    return fail("INTERNAL", rid, { cause: e });
  }
}

export async function GET() {
  const rid = newRequestId();
  const session = await readAdminSession();
  if (!session) return fail("AUTH_REQUIRED", rid, {
    message: "ログインが必要です",
    hint: "/login からメールアドレスでログインしてください。",
  });
  try {
    const companyId = await resolveCompany(session.adminId);
    return ok(
      { status: "ok", email: session.email, provisioned: companyId !== null },
      rid
    );
  } catch (e) {
    return fail("INTERNAL", rid, { cause: e });
  }
}

export async function DELETE() {
  const rid = newRequestId();
  clearAdminSession();
  return ok({ status: "ok" }, rid);
}
