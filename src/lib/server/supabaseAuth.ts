import "server-only";
import { getEnv } from "./env";

// Supabase Auth（GoTrue）REST の薄いラッパー（SaaS化 C1）。
// テナント管理者のメール+パスワード認証にだけ使う。SDK は入れず fetch 直呼びで、
// アクセストークンはクライアントへ渡さない（成功したら自前 httpOnly セッションを発行する）。

export class SupabaseAuthError extends Error {
  constructor(message: string, public hint: string, public status: number) {
    super(message);
    this.name = "SupabaseAuthError";
  }
}

type AuthUser = { id: string; email: string };

function baseConfig(): { url: string; anonKey: string } {
  const env = getEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new SupabaseAuthError(
      "Supabase Auth が未設定です",
      "SUPABASE_URL / SUPABASE_ANON_KEY を設定してください（ローカルは supabase status の API URL / anon key）。",
      500
    );
  }
  return { url: env.SUPABASE_URL.replace(/\/$/, ""), anonKey: env.SUPABASE_ANON_KEY };
}

// GoTrue のエラーメッセージを式場担当者が自己解決できる日本語に写像する
function mapAuthError(status: number, body: Record<string, unknown>): SupabaseAuthError {
  const raw = String(body.error_description ?? body.msg ?? body.message ?? "");
  if (/invalid login credentials/i.test(raw)) {
    return new SupabaseAuthError(
      "メールアドレスまたはパスワードが違います",
      "入力内容をご確認ください。パスワードを忘れた場合は運営までご連絡ください。",
      401
    );
  }
  if (/already registered|already been registered/i.test(raw)) {
    return new SupabaseAuthError(
      "このメールアドレスは登録済みです",
      "ログイン画面からログインしてください。",
      409
    );
  }
  if (/password.*(short|at least|characters)/i.test(raw)) {
    return new SupabaseAuthError(
      "パスワードが短すぎます",
      "8文字以上のパスワードを設定してください。",
      400
    );
  }
  if (/email.*(invalid|format)/i.test(raw) || /validate email/i.test(raw)) {
    return new SupabaseAuthError(
      "メールアドレスの形式が正しくありません",
      "入力内容をご確認ください。",
      400
    );
  }
  return new SupabaseAuthError(
    "認証サーバーでエラーが発生しました",
    "時間をおいて再度お試しください。解消しない場合は運営までご連絡ください。",
    status >= 500 ? 502 : 400
  );
}

async function authRequest(
  path: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { url, anonKey } = baseConfig();
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (e) {
    throw new SupabaseAuthError(
      "認証サーバーに接続できません",
      "SUPABASE_URL の設定と Supabase の起動状態を確認してください。",
      502
    );
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw mapAuthError(res.status, data);
  return data;
}

function extractUser(data: Record<string, unknown>): AuthUser {
  // token grant は { user: {...} }、signup は { user: {...} } または user 直下（確認メール設定による）
  const user = (data.user ?? data) as { id?: unknown; email?: unknown };
  if (typeof user.id !== "string" || !user.id) {
    throw new SupabaseAuthError(
      "認証結果を確認できませんでした",
      "メール確認が必要な設定になっている可能性があります。受信メールを確認するか、運営までご連絡ください。",
      502
    );
  }
  return { id: user.id, email: typeof user.email === "string" ? user.email : "" };
}

// メール+パスワードでログイン。成功時は auth.users の id / email を返す。
export async function signInWithPassword(email: string, password: string): Promise<AuthUser> {
  const data = await authRequest("/auth/v1/token?grant_type=password", { email, password });
  return extractUser(data);
}

// メール+パスワードでサインアップ。ローカル/MVP はメール確認オフ前提で即セッション相当。
export async function signUpWithPassword(email: string, password: string): Promise<AuthUser> {
  const data = await authRequest("/auth/v1/signup", { email, password });
  return extractUser(data);
}
