import "server-only";
import { env } from "./env";

// LINE ID Token をサーバー検証する（autoplan Eng critical: aud+exp だけでは署名未検証 = 偽造可）。
// LINE の verify エンドポイントは iss / 署名(ES256) / aud / exp を全てサーバー側で検証してくれる。
// ログイン頻度は低いので 1 リクエスト増は許容（設計の判断どおり）。
// 返すのは検証済みの sub（= LINE userId）のみ。呼び出し側はこれを唯一の line_id ソースにする。
// loginChannelId は venue 別（SaaS化 C2）。呼び出し側が venue から解決して渡す
// （グローバル env 固定を廃止。env はフォールバックとして route 側で解決する）。

const VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

export type VerifiedLineUser = { lineUserId: string };

export async function verifyLineIdToken(
  idToken: string,
  loginChannelId: string
): Promise<VerifiedLineUser> {
  // dev バイパス: "dev:U..." 形式のトークンをそのまま line_id として受ける。
  // env で本番無効化済み（本番混入は env.ts と CI grep で二重ガード）。
  if (env.ALLOW_DEV_LINE_BYPASS && idToken.startsWith("dev:")) {
    const id = idToken.slice(4).trim();
    if (!id) throw new LineAuthError("dev token に line_id がありません");
    return { lineUserId: id };
  }

  if (!loginChannelId) {
    throw new LineAuthError("LINE Login チャネル ID を解決できません（venue 未設定）");
  }

  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: loginChannelId, // aud をこのチャネル ID と一致させて検証させる
    }),
    // 検証は毎回最新で行う
    cache: "no-store",
  });

  if (!res.ok) {
    // 400 = 署名不正 / aud 不一致 / exp 切れ 等。詳細はログのみ。
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      /* noop */
    }
    throw new LineAuthError(`LINE verify 失敗 (${res.status}): ${detail}`);
  }

  const payload = (await res.json()) as { sub?: string; iss?: string };
  // verify エンドポイントが 200 を返した時点で署名/aud/exp は検証済み。iss も念のため確認。
  if (payload.iss !== "https://access.line.me" || !payload.sub) {
    throw new LineAuthError("LINE ID Token の payload が不正です");
  }
  return { lineUserId: payload.sub };
}

export class LineAuthError extends Error {}
