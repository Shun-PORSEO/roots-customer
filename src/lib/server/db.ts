import "server-only";
import postgres from "postgres";
import { getEnv } from "./env";

// 非特権ロール app_couple での接続（NOBYPASSRLS）。service_role は使わない。
// → RLS が全クエリに効くので「WHERE 絞り込み忘れ」も DB 側で捕捉できる多層防御（autoplan Eng 訂正）。
// 接続はモジュール評価時ではなく初回利用時に張る（ビルド時に接続文字列を要求しないため）。
let pool: ReturnType<typeof postgres> | null = null;

function sql(): ReturnType<typeof postgres> {
  if (!pool) pool = postgres(getEnv().DATABASE_URL_APP_COUPLE, { prepare: true });
  return pool;
}

// カップルの検証済み line_id をトランザクションスコープの GUC に注入して cb を実行する。
// SET LOCAL 相当を set_config(..., true)=local で行い、RLS ポリシー
//   using ( ... = current_setting('request.line_id') )
// がこの値で行スコープする。cb 内のクエリは同一トランザクションの sql を使うこと。
export async function withLineScope<T>(
  lineId: string,
  cb: (tx: postgres.TransactionSql) => Promise<T>
): Promise<T> {
  // postgres.js の begin は UnwrapPromiseArray<T> を返す（配列of Promise を畳む）。
  // 我々の T は単一オブジェクトなので実体は T。型だけ明示キャストする。
  const result = await sql().begin(async (tx) => {
    await tx`select set_config('request.line_id', ${lineId}, true)`;
    return cb(tx);
  });
  return result as T;
}

// テナント管理者（Supabase Auth）の検証済み auth.users.id を GUC に注入して cb を実行する。
// RLS の管理者ポリシー（app.is_admin() / app.current_company_id()）は tenant_admins を
// この値で解決する。カップル用の request.line_id は設定しない（経路を混ぜない）。
export async function withAdminScope<T>(
  adminId: string,
  cb: (tx: postgres.TransactionSql) => Promise<T>
): Promise<T> {
  const result = await sql().begin(async (tx) => {
    await tx`select set_config('request.admin_id', ${adminId}, true)`;
    return cb(tx);
  });
  return result as T;
}

export { sql };
