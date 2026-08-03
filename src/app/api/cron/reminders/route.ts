import { NextRequest } from "next/server";
import { getEnv } from "@/lib/server/env";
import { ok, fail, newRequestId } from "@/lib/server/http";
import { runReminders } from "@/lib/server/reminders";

export const runtime = "nodejs";
// GET の Route Handler は既定でビルド時に静的評価される。ここは env / DB / LINE を
// 触るため、静的評価されると next build が env 未設定で落ちる（Vercel Preview が必ず失敗する）。
// 実行時のみ動くことを明示する。
export const dynamic = "force-dynamic";
// 全アクティブ venue × カップルを順に処理して LINE push するため長め（Pro の上限内）
export const maxDuration = 300;

// GET /api/cron/reminders — 毎朝9:00 JST のリマインド送信（SaaS化 C5 / 旧 GAS sendReminders）。
// vercel.json の crons（"0 0 * * *" UTC = 9:00 JST）から起動される。
// 認可: Vercel Cron が付与する Authorization: Bearer ${CRON_SECRET} を検証する
// （手動実行するときも同じヘッダを付ける）。冪等なので同日に何度呼んでも重複送信はゼロ。
export async function GET(req: NextRequest) {
  const rid = newRequestId();

  const secret = getEnv().CRON_SECRET;
  if (!secret) {
    return fail("INTERNAL", rid, {
      message: "CRON_SECRET が未設定です",
      hint: "Vercel の環境変数に CRON_SECRET を設定してください。",
    });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return fail("AUTH_REQUIRED", rid, {
      message: "Cron 認証に失敗しました",
      hint: "Authorization: Bearer <CRON_SECRET> を付けて呼び出してください。",
    });
  }

  try {
    const summary = await runReminders();
    return ok({ status: "ok", summary }, rid);
  } catch (e) {
    return fail("INTERNAL", rid, { cause: e });
  }
}
