import "server-only";
import postgres from "postgres";
import { env } from "./env";

// 非特権ロール app_couple での接続（NOBYPASSRLS）。service_role は使わない。
// → RLS が全クエリに効くので「WHERE 絞り込み忘れ」も DB 側で捕捉できる多層防御（autoplan Eng 訂正）。
const sql = postgres(env.DATABASE_URL_APP_COUPLE, { prepare: true });

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
  const result = await sql.begin(async (tx) => {
    await tx`select set_config('request.line_id', ${lineId}, true)`;
    return cb(tx);
  });
  return result as T;
}

export { sql };
