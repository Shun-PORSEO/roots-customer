import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyLineIdToken, LineAuthError } from "@/lib/server/lineAuth";
import { issueSession } from "@/lib/server/session";
import { ok, fail, newRequestId } from "@/lib/server/http";

export const runtime = "nodejs"; // postgres.js / jose を使うため

// POST /api/auth/line  { id_token }
// LINE ID Token を署名まで含めてサーバー検証 → 検証済み line_id で httpOnly セッションを発行。
// これ以降、他の API は line_id をセッションから導出し、ボディからは受け取らない（IDOR 構造根絶）。
const Body = z.object({ id_token: z.string().min(1) });

export async function POST(req: NextRequest) {
  const rid = newRequestId();
  let idToken: string;
  try {
    idToken = Body.parse(await req.json()).id_token;
  } catch {
    return fail("VALIDATION", rid, { message: "id_token が必要です" });
  }

  try {
    const { lineUserId } = await verifyLineIdToken(idToken);
    await issueSession(lineUserId);
    return ok({ status: "ok" }, rid);
  } catch (e) {
    if (e instanceof LineAuthError) {
      return fail("AUTH_REQUIRED", rid, { cause: e });
    }
    return fail("LINE_UPSTREAM", rid, { cause: e });
  }
}
