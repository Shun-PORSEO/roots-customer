-- SaaS化 C2 — LINE マルチテナント化（roots-concierge#3）
--
-- venues がテナント別の LINE キー4点を持つ:
--   line_channel_access_token … Messaging API 送信（0002 で追加済み）
--   line_channel_secret       … Webhook 署名検証（本 migration）
--   line_login_channel_id     … ID Token の aud 検証（本 migration。env 固定を廃止）
--   line_liff_id              … LIFF アプリ ID（0002 で追加済み）
--
-- 認可モデルへの影響:
--   Webhook 署名検証とログイン前の ID Token 検証は「検証済みセッションがまだ無い」
--   状態で venue の設定を読む必要がある（GUC 未設定 → RLS では 0 行）。
--   register_customer / provision_tenant と同じく、RLS の例外を security definer
--   関数 1 個（app.venue_line_config）に限定して解決する。
--   channel_access_token はこの関数からは返さない（Webhook/認証には不要。最小権限）。

-- ─── venues 拡張（キー4点の残り2点）─────────────────────────────────────
alter table venues add column line_channel_secret text not null default '';
alter table venues add column line_login_channel_id text not null default '';

-- ─── 未認証経路用の venue 設定解決 ───────────────────────────────────────
-- p_code = venues.code（Webhook URL の /api/line/webhook/[venue_id]）、
-- p_liff_id = クライアントが liff.init に使った LIFF ID（ログイン時の venue 特定）。
-- どちらか一致した 1 行のみ返す。空文字は照合しない（default '' の全件一致を防ぐ）。
create or replace function app.venue_line_config(
  p_code text default null,
  p_liff_id text default null
) returns table (
  venue_uuid uuid,
  code text,
  active boolean,
  line_channel_secret text,
  line_login_channel_id text,
  line_liff_id text
)
language sql stable security definer set search_path = public
as $$
  select id, code, active, line_channel_secret, line_login_channel_id, line_liff_id
  from venues
  where (coalesce(p_code, '') <> '' and code = p_code)
     or (coalesce(p_liff_id, '') <> '' and line_liff_id = p_liff_id)
  limit 1
$$;

revoke all on function app.venue_line_config(text, text) from public;
grant execute on function app.venue_line_config(text, text) to app_couple;
