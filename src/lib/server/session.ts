import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "./env";

// カップルの軽量セッション。LINE ID Token 検証成功後に発行する httpOnly Cookie。
// line_id は「検証済みセッション」からのみ導出し、リクエストボディからは絶対に受け取らない（IDOR 構造根絶）。
const COOKIE = "rc_session";
const TTL_SEC = 60 * 60; // 短命（1h）。切れたらフロントが liff.getIDToken() でサイレント再発行。

// 署名鍵も初回利用時に解決する（ビルド時に SESSION_SECRET を要求しないため）。
let key: Uint8Array | null = null;

function secret(): Uint8Array {
  if (!key) key = new TextEncoder().encode(getEnv().SESSION_SECRET);
  return key;
}

export type Session = { lineId: string };

export async function issueSession(lineId: string): Promise<void> {
  const token = await new SignJWT({ lineId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SEC}s`)
    .sign(secret());

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
    const { payload } = await jwtVerify(raw, secret());
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

// ─── テナント管理者セッション（SaaS化 C1）────────────────────────────────
// Supabase Auth（メール）でのログイン成功後に発行する httpOnly Cookie。
// adminId = auth.users.id。RLS へは GUC request.admin_id として注入される。
// カップルの rc_session とは Cookie も型も分離（相互に無干渉）。
const ADMIN_COOKIE = "rc_admin_session";
const ADMIN_TTL_SEC = 60 * 60 * 12; // 管理画面はブラウザ利用なので半日

export type AdminSession = { adminId: string; email: string };

export async function issueAdminSession(adminId: string, email: string): Promise<void> {
  const token = await new SignJWT({ adminId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_TTL_SEC}s`)
    .sign(secret());

  cookies().set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax", // 管理画面は通常のブラウザ文脈（LIFF webview ではない）
    path: "/",
    maxAge: ADMIN_TTL_SEC,
  });
}

export async function readAdminSession(): Promise<AdminSession | null> {
  const raw = cookies().get(ADMIN_COOKIE)?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, secret());
    const adminId = payload.adminId;
    const email = payload.email;
    if (typeof adminId !== "string" || !adminId) return null;
    return { adminId, email: typeof email === "string" ? email : "" };
  } catch {
    return null; // 期限切れ/署名不正 → /login へ
  }
}

export function clearAdminSession(): void {
  cookies().delete(ADMIN_COOKIE);
}
