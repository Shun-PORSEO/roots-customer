import { NextRequest } from "next/server";
import { findVenueLineConfig } from "@/lib/server/lineConfig";
import { verifyLineSignature } from "@/lib/server/lineSignature";
import { ok, fail, newRequestId } from "@/lib/server/http";

export const runtime = "nodejs"; // node:crypto / postgres.js を使うため

// POST /api/line/webhook/[venue_id]  — LINE Platform からの Webhook（SaaS化 C2）。
// venue_id は人間可読コード（venues.code, RC001 形式）。venue 別の channel secret で
// 署名検証する（グローバル secret は存在しない）。
//   - venue 未特定 → 404（URL の式場IDが間違っている）
//   - secret 未設定 / 署名不一致 → 401（本文が改ざんされているか secret 不一致）
// イベントの本処理（リマインド等）は別イシュー。ここでは検証と受領（200）まで。
export async function POST(
  req: NextRequest,
  { params }: { params: { venue_id: string } }
) {
  const rid = newRequestId();

  const venue = await findVenueLineConfig({ code: params.venue_id });
  if (!venue) {
    return fail("NOT_FOUND", rid, {
      message: "式場が見つかりません",
      hint: "Webhook URL の式場ID部分（/api/line/webhook/◯◯）が管理画面の式場IDと一致しているか確認してください。",
    });
  }
  if (!venue.channelSecret) {
    return fail("AUTH_REQUIRED", rid, {
      message: "この式場のチャネルシークレットが未設定のため署名検証できません",
      hint: "管理画面の式場設定で LINE チャネルシークレットを登録してください。",
    });
  }

  // 署名は「受信した生のボディ」に対して検証する（JSON parse 後の再構成は不可）
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");
  if (!verifyLineSignature(rawBody, venue.channelSecret, signature)) {
    return fail("AUTH_REQUIRED", rid, {
      message: "署名検証に失敗しました",
      hint: "設定されたチャネルシークレットが Messaging API チャネルのものと一致しているか確認してください。",
    });
  }

  // 検証済み。イベントは現時点ではログのみ（LINE には常に 200 を返して再送を防ぐ）。
  try {
    const body = JSON.parse(rawBody) as { events?: Array<{ type?: string }> };
    const types = (body.events ?? []).map((e) => e.type ?? "unknown");
    console.log(`[${rid}] line webhook venue=${venue.code} events=[${types.join(",")}]`);
  } catch {
    console.warn(`[${rid}] line webhook venue=${venue.code}: body が JSON ではありません`);
  }
  return ok({ status: "ok" }, rid);
}
