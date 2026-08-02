import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyLineIdToken, LineAuthError } from "@/lib/server/lineAuth";
import { findVenueLineConfig } from "@/lib/server/lineConfig";
import { issueSession } from "@/lib/server/session";
import { ok, fail, newRequestId } from "@/lib/server/http";
import { env } from "@/lib/server/env";

export const runtime = "nodejs"; // postgres.js / jose を使うため

// POST /api/auth/line  { id_token, liff_id?, venue_id? }
// LINE ID Token を署名まで含めてサーバー検証 → 検証済み line_id で httpOnly セッションを発行。
// これ以降、他の API は line_id をセッションから導出し、ボディからは受け取らない（IDOR 構造根絶）。
//
// aud（Login チャネル ID）は venue 別に解決する（SaaS化 C2）:
//   1. liff_id（クライアントが liff.init に使った ID）→ venues.line_liff_id で venue 特定
//   2. venue_id（式場コード。QR 経由の登録画面などで既知の場合）
//   3. どちらも解決できなければ env.LINE_LOGIN_CHANNEL_ID にフォールバック（単一テナント互換）
const Body = z.object({
  id_token: z.string().min(1),
  liff_id: z.string().optional(),
  venue_id: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const rid = newRequestId();
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return fail("VALIDATION", rid, { message: "id_token が必要です" });
  }

  try {
    let loginChannelId = "";
    if (body.liff_id || body.venue_id) {
      const venue = await findVenueLineConfig({
        liffId: body.liff_id,
        code: body.venue_id,
      });
      loginChannelId = venue?.loginChannelId ?? "";
    }
    if (!loginChannelId) loginChannelId = env.LINE_LOGIN_CHANNEL_ID ?? "";

    // dev バイパス（"dev:U..."）は verifyLineIdToken 内で channel 不要のまま通る
    if (!loginChannelId && !(env.ALLOW_DEV_LINE_BYPASS && body.id_token.startsWith("dev:"))) {
      return fail("VALIDATION", rid, {
        message: "この式場の LINE Login チャネル ID が未設定です",
        hint: "管理画面の式場設定で「LINE Login チャネルID」を登録してください（接続テストで確認できます）。",
      });
    }

    const { lineUserId } = await verifyLineIdToken(body.id_token, loginChannelId);
    await issueSession(lineUserId);
    return ok({ status: "ok" }, rid);
  } catch (e) {
    if (e instanceof LineAuthError) {
      return fail("AUTH_REQUIRED", rid, { cause: e });
    }
    return fail("LINE_UPSTREAM", rid, { cause: e });
  }
}
