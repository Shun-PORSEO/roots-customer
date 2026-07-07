# Phase A 縦スライス — Supabase + Route Handlers 移行

計画のゲート#2「api.ts シームの縦スライスを貫通」から拡張し、
**フロントが使う全アクション**を `NEXT_PUBLIC_BACKEND=db` で新スタックに切り替え可能にした。
**LINE ID Token 検証 → httpOnly セッション → RLSスコープDB → 既存フロントと同一レスポンス** を維持し、
`src/lib/api.ts` のシームだけで GAS→新スタックに切り替わる（呼び出しUIは無改修）。

## 移行済みスライス
1. **#1 読み取り**: `getTasksAndUser` / `getTasks`（venue 単位のタスク絞り込み対応済み）
2. **#2 カップル書き込み**: `updateTask` / `updateTaskComment`（PATCH /api/tasks）
3. **#3 登録+管理経路（今回）**:
   - カップル: `getUser` / `register`（/api/user。登録は security definer 関数 `app.register_customer` に閉じ込め）
   - 管理: `getVenues` `createVenue` `updateVenue` `updateVenueStatus` `getVenueDetail`
     `getVenueTasks` `updateTaskMaster` `addTaskMaster` `updateTaskManualUrl` `testSendTask`
     `getUsers` `getUsersWithProgress` `getAdminUserTasks` `toggleTaskVisibility`
     `addCustomTask` `deleteCustomTask` `getTaskItems` `addTaskItem` `updateTaskItem`
     `deleteTaskItem` `getTaskItemTemplates` `addTaskItemTemplate`
     `getMessageDrafts` `updateDraftStatus` `updateDraftMessage`（POST /api/admin）
   - LINE push（手配物確定通知・テスト送信）もサーバー側で実装（トークンは venues 列からのみ参照、クライアントへ非露出）

## 認可モデル（訂正版 RLS の維持）
- 接続は常に非特権ロール `app_couple`（NOBYPASSRLS）。service_role は使わない。
- 各リクエストはトランザクション内で `SET LOCAL request.line_id`（検証済みセッション由来）。
- カップル: 自分の行のみ（0001 のポリシー）。
- **管理者**: `customers.is_admin = true`（GAS と同じモデル）。`app.is_admin()` + `app.current_company_id()`
  （security definer）で「自社 company 内」だけ読み書き可能なポリシーを追加（0002）。
  → ハンドラが WHERE を書き落としても他社データに届かない多層防御。
- **register だけ**は customer 行が無い状態で venue 解決・行作成が必要なため、
  security definer 関数 `app.register_customer()` に RLS 例外を限定。line_id は GUC からのみ取得。

## 構成
```
supabase/migrations/0001_init_vertical_slice.sql  スキーマ+RLS+app_coupleロール
supabase/migrations/0002_admin_slice.sql          task_items/message_drafts/venues拡張/管理者RLS/register関数
supabase/seed.sql            ローカル用データ（カップル dev:Udev123 / 管理者 dev:Uadmin123）
src/lib/server/env.ts        env(zod)検証・dev bypass本番ガード
src/lib/server/http.ts       統一エラーDTO {code,message,hint,request_id}
src/lib/server/lineAuth.ts   LINE ID Token 署名検証（+dev bypass）
src/lib/server/session.ts    httpOnly セッション（jose）
src/lib/server/db.ts         postgres.js + withLineScope（SET LOCAL）
src/lib/server/line.ts       LINE Messaging API push（dev bypass 時はログのみ）
src/app/api/auth/line/route.ts   POST: id_token→検証→セッション発行
src/app/api/tasks/route.ts       GET: getTasksAndUser形 / PATCH: updateTask(Comment)
src/app/api/user/route.ts        GET: getUser（target指定は管理者のみ）/ POST: register
src/app/api/admin/route.ts       POST: 管理系 action 一括ディスパッチ（is_admin必須+RLS）
src/lib/api.ts               BACKEND=db 全アクション分岐＋サイレント再認証
```

## 動かし方（要 Docker + Supabase CLI + Bun/Node）
```bash
# 1) ローカル Supabase 起動（初回は数GBのイメージpull）
supabase init          # 既存なら不要
supabase start
supabase db reset      # migrations + seed 適用（app_couple のパスワードも seed で設定）

# 2) 環境変数
cd src && cp .env.example .env.local
#   DATABASE_URL_APP_COUPLE は supabase status の DB URL を app_couple 用に:
#   postgres://app_couple:devpassword@127.0.0.1:54322/postgres
#   SESSION_SECRET は openssl rand -hex 32
#   ALLOW_DEV_LINE_BYPASS=true / NEXT_PUBLIC_BACKEND=db

# 3) 依存インストール＆起動
bun install
bun run dev

# 4) 動作確認（dev バイパスで LINE 実アカウント不要）
#   カップル: セッション発行 → タスク取得/更新
curl -i -X POST localhost:3000/api/auth/line -H 'Content-Type: application/json' \
  -d '{"id_token":"dev:Udev123"}' -c /tmp/rc.cookies
curl -s localhost:3000/api/tasks -b /tmp/rc.cookies | jq
#   管理者: セッション発行 → 進捗一覧/式場一覧
curl -i -X POST localhost:3000/api/auth/line -H 'Content-Type: application/json' \
  -d '{"id_token":"dev:Uadmin123"}' -c /tmp/rc-admin.cookies
curl -s -X POST localhost:3000/api/admin -b /tmp/rc-admin.cookies \
  -H 'Content-Type: application/json' -d '{"action":"getUsersWithProgress"}' | jq
curl -s -X POST localhost:3000/api/admin -b /tmp/rc-admin.cookies \
  -H 'Content-Type: application/json' -d '{"action":"getVenues"}' | jq
#   カップルのセッションで /api/admin を叩くと 403(FORBIDDEN_IDOR) になること。
```

## ⚠️ 検証状況
- `tsc --noEmit` / `next build` は緑（2026-07-08）。
- **注意**: リポジトリの親パスに日本語（NFD 分解文字）を含むローカル環境では、Next.js の
  既知バグで `next build` の prerender が「React Client Manifest」エラーで落ちる。
  ASCII パスへ clone すれば通る（Vercel/Linux のビルドは影響なし）。
- Supabase 実起動での E2E（curl 手順）はこの環境（Docker 無し）では未実行。上記手順で確認するのが次の作業。

## 既知のフォローアップ（スライス外・次以降）
- リマインドエンジン（判定/送信分離・冪等・JST）と観測性テーブル → message_drafts への書き込み経路
- プランナー専用ロール（現状は is_admin の全社管理。式場単位のプランナー権限分離は Phase B）
- app_couple パスワードの本番管理（Vault/Secrets）
- 本番切替時の Sheets → Postgres データ移行スクリプト
