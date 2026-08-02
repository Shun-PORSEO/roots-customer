import "server-only";
import { sql } from "./db";

// venue 別 LINE 設定の解決（SaaS化 C2）。
// Webhook 署名検証・ログイン前の ID Token 検証は検証済みセッションが無い経路なので、
// RLS 例外を閉じ込めた security definer 関数 app.venue_line_config() 経由で読む。
// channel_access_token はこの経路では取得できない（関数が返さない。最小権限）。

export type VenueLineConfig = {
  venueUuid: string;
  code: string;
  active: boolean;
  channelSecret: string;
  loginChannelId: string;
  liffId: string;
};

export async function findVenueLineConfig(by: {
  code?: string;
  liffId?: string;
}): Promise<VenueLineConfig | null> {
  if (!by.code && !by.liffId) return null;
  const rows = await sql()`
    select venue_uuid, code, active, line_channel_secret, line_login_channel_id, line_liff_id
    from app.venue_line_config(${by.code ?? null}, ${by.liffId ?? null})`;
  const row = rows[0];
  if (!row) return null;
  return {
    venueUuid: row.venue_uuid,
    code: row.code,
    active: row.active,
    channelSecret: row.line_channel_secret ?? "",
    loginChannelId: row.line_login_channel_id ?? "",
    liffId: row.line_liff_id ?? "",
  };
}
