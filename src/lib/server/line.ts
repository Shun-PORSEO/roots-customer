import "server-only";
import { env } from "./env";

// LINE Messaging API へのプッシュ送信（旧 GAS pushLineMessage 相当）。
// チャネルトークンは venues.line_channel_access_token からサーバー側でのみ参照する
// （クライアントには一切返さない）。送信失敗は throw し、通知がベストエフォートで良い
// 呼び出し側（手配物確定など）は catch して握りつぶす。

const PUSH_URL = "https://api.line.me/v2/bot/message/push";

export async function pushLineMessage(
  toLineUserId: string,
  text: string,
  channelAccessToken: string
): Promise<void> {
  if (!toLineUserId) throw new Error("[line] 送信先 LINE userId が未設定です");
  if (!channelAccessToken)
    throw new Error("[line] チャネルアクセストークンが未設定です（式場設定を確認）");

  // dev バイパス時は実送信せずログのみ（ローカルで LINE 実チャネル無しでも経路を通せる）
  if (env.ALLOW_DEV_LINE_BYPASS) {
    console.log(`[line:dev] push to=${toLineUserId}: ${text}`);
    return;
  }

  const res = await fetch(PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({ to: toLineUserId, messages: [{ type: "text", text }] }),
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      /* noop */
    }
    throw new Error(`[line] push 失敗 (${res.status}): ${detail}`);
  }
}
