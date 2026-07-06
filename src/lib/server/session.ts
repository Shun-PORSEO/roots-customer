import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

// カップルの軽量セッション。LINE ID Token 検証成功後に発行する httpOnly Cookie。
// line_id は「検証済みセッション」からのみ導出し、リクエストボディからは絶対に受け取らない（IDOR 構造根絶）。
const COOKIE = "rc_session";
const TTL_SEC = 60 * 60; // 短命（1h）。切れたらフロントが liff.getIDToken() でサイレント再発行。
const secret = new TextEncoder().encode(env.SESSION_SECRET);

export type Session = { lineId: string };

export async function issueSession(lineId: string): Promise<void> {
  const token = await new SignJWT({ lineId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SEC}s`)
    .sign(secret);

  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "none", // LIFF webview（クロスサイト文脈）で送出させるため
    path: "/",
    maxAge: TTL_SEC,
  });
}

// セッション Cookie を検証して line_id を返す。無効/欠落なら null。
export async function readSession(): Promise<Session | null> {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, secret);
    const lineId = payload.lineId;
    if (typeof lineId !== "string" || !lineId) return null;
    return { lineId };
  } catch {
    return null; // 期限切れ/署名不正 → フロントがサイレント再認証
  }
}

export function clearSession(): void {
  cookies().delete(COOKIE);
}
