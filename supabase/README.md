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

---

## SaaS化 C1 — テナント管理者認証（Supabase Auth）への置き換え（roots-concierge#2）

管理者の認可モデルを「LINE ログイン + `customers.is_admin`」から
**Supabase Auth（メール） + `tenant_admins`** に置き換えた（D4）。カップル経路（LIFF + `request.line_id`）は無変更。

### 認可モデル（C1 以降）
- `tenant_admins(auth_user_id ↔ company_id)` が管理者の根拠。`customers.is_admin` は deprecated（データのみ残置）。
- 管理リクエストは `SET LOCAL request.admin_id`（検証済み管理者セッション由来の auth.users.id）。
- `app.is_admin()` / `app.current_company_id()` は tenant_admins 経由に差し替え済み
  → **0002 の管理者ポリシーは無改修で新モデルに切り替わる**（関数差し替えのみ）。
- 接続は引き続き非特権ロール `app_couple`。service_role 不使用。
- サインアップ直後のテナント作成は security definer 関数 `app.provision_tenant()` に限定（冪等）。

### 追加ファイル
```
supabase/migrations/0003_tenant_admins.sql  tenant_admins / request.admin_id / is_admin差し替え / provision_tenant
supabase/tests/rls_c1.sql                   クロステナント遮断の受け入れテスト（psql -f で実行）
src/lib/server/supabaseAuth.ts              GoTrue REST 直呼び（SDK なし・トークンはクライアント非露出）
src/app/api/auth/admin/route.ts             POST login/signup / GET セッション確認 / DELETE ログアウト
src/app/login/page.tsx, src/app/signup/page.tsx  管理者ログイン/サインアップ（LIFF 非依存）
```

### 動かし方（追加分）
```bash
supabase db reset   # 0003 + seed（admin@example.com / password123、B社テナント含む）
# .env.local に追加: SUPABASE_URL / SUPABASE_ANON_KEY（supabase status の値）

# 管理者ログイン → 管理 API
curl -i -X POST localhost:3000/api/auth/admin -H 'Content-Type: application/json' \
  -d '{"mode":"login","email":"admin@example.com","password":"password123"}' -c /tmp/rc-admin.cookies
curl -s -X POST localhost:3000/api/admin -b /tmp/rc-admin.cookies \
  -H 'Content-Type: application/json' -d '{"action":"getVenues"}' | jq
# → B社（RB001）が混ざらないこと。旧 dev:Uadmin123 の LINE セッションでは 401/403 になること。

# RLS クロステナントテスト（受け入れ基準の証明）
psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/rls_c1.sql
```

---

## SaaS化 C2 — LINE マルチテナント化（roots-concierge#3）

LINE 連携をテナント（式場）別に解決する。venues がキー4点を持つ:
`line_channel_access_token`（push 送信）/ `line_channel_secret`（Webhook 署名検証）/
`line_login_channel_id`（ID Token の aud 検証）/ `line_liff_id`（LIFF アプリ）。
グローバル env `LINE_LOGIN_CHANNEL_ID` は venue 未特定時のフォールバックに格下げ（optional）。

### 経路
- **Webhook**: `POST /api/line/webhook/[venue_id]`（venue_id = venues.code）。venue 別 secret で
  HMAC-SHA256 署名検証（timingSafeEqual）。venue 未特定 404 / 署名不正・secret 未設定 401。
- **ID Token 検証**: `/api/auth/line` が `liff_id`（クライアントが liff.init に使った ID）または
  `venue_id` から venue を解決し、その `line_login_channel_id` を aud に検証。
- **未認証経路の設定解決**: RLS の例外は security definer 関数 `app.venue_line_config(code, liff_id)`
  1個に限定（access token は返さない。最小権限）。
- **接続テスト**: 管理 API `action:"testLineConnection"`。トークン→`GET /v2/bot/info`、
  Webhook→LINE の endpoint 検証 API（登録 URL 突き合わせ + 署名検証まで end-to-end）、
  Login チャネルID→形式、LIFF ID→形式 + Login チャネルとの整合。キーごとに
  「✓ 接続OK / ✗ エラーと直し方」を返す（式場詳細画面の「LINE接続テスト」カードから実行）。

### 追加ファイル
```
supabase/migrations/0004_line_multitenant.sql  line_channel_secret / line_login_channel_id / venue_line_config
supabase/tests/line_c2.sql                     未認証経路の解決と RLS 維持の受け入れテスト
src/lib/server/lineConfig.ts                   venue 別 LINE 設定リゾルバ
src/lib/server/lineSignature.ts                Webhook 署名検証（HMAC-SHA256）
src/lib/server/lineTest.ts                     接続テスト（キー4点の実検証と直し方の文言）
src/app/api/line/webhook/[venue_id]/route.ts   venue 別 Webhook エンドポイント
```

### 動かし方（追加分）
```bash
supabase db reset   # 0004 + seed（RC001 に dev 用のダミー LINE キーが入る）

# Webhook 署名検証（seed の secret: dev-channel-secret）
BODY='{"events":[]}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac 'dev-channel-secret' -binary | base64)
curl -i -X POST localhost:3000/api/line/webhook/RC001 \
  -H 'Content-Type: application/json' -H "x-line-signature: $SIG" -d "$BODY"   # → 200
curl -i -X POST localhost:3000/api/line/webhook/RC001 \
  -H 'Content-Type: application/json' -H "x-line-signature: xxx" -d "$BODY"    # → 401
curl -i -X POST localhost:3000/api/line/webhook/NOPE -d '{}'                   # → 404

# DB 層の受け入れテスト
psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/line_c2.sql
```

---

## SaaS化 C3 — オンボーディングウィザード（roots-concierge#4）

サインアップ後の `/onboarding` で、式場担当者がセルフサーブで
**Step1 式場情報 → Step2 LINEキー4点入力（スクショ風マニュアル付き）→ Step3 接続テスト全緑 → Step4 利用開始**
まで完走する。進捗は `onboarding_progress`（company 単位で1行）に保存され、中断→再開できる。

### 設計の要点
- **進捗保存**: `onboarding_progress(company_id PK, current_step, venue_code, line_test_passed_at, completed_at)`。
  Step 内の入力値は venues 等の実体に保存されるため、この行は「どこまで進んだか」だけを持つ。
- **偽装不可のゲート**: `line_test_passed_at` はクライアント申告では書かず、
  `testLineConnection` の実結果（4点全て✓）を見て API サーバーが更新する。
  `saveOnboarding` は Step4 進行・完了時にこの列を必須チェックする。
- **RLS**: 既存の管理者ポリシーと同型（`app.is_admin()` + 自社 `company_id`）。security definer の例外は増やしていない。
- **再開導線**: `GET/POST /api/auth/admin` が `onboarding_pending`（未完了行の有無）を返し、
  ログイン後に `/onboarding` へ誘導。C3 以前からの既存テナント（行なし）は影響を受けない。
- **Step4**: 現状は「トライアル開始」の確定のみ（D9 の料金表示つき）。
  Stripe Checkout（C4 roots-concierge#5）が入ったら確定ボタンを Checkout リダイレクトに差し替える。

### 追加ファイル
```
supabase/migrations/0005_onboarding.sql        onboarding_progress + RLS
supabase/tests/onboarding_c3.sql               進捗保存とテナント分離の受け入れテスト
src/app/onboarding/page.tsx                    ウィザード本体（Step1〜4・再開対応）
src/components/onboarding/LineSetupManual.tsx  LINE設定マニュアル（模式図・Webhook URLコピー付き）
```

### 動かし方（追加分）
```bash
supabase db reset   # 0005 + seed

# ウィザードの通し確認（ブラウザ）
#   /signup で新規登録 → /onboarding に遷移 → Step1 で式場作成 →
#   Step2 でキー4点入力 → Step3 でテスト（実 LINE チャネルが必要）→ Step4 で完了 → /admin
#   途中でタブを閉じて /login からログインし直すと、保存済みステップから再開される。

# DB 層の受け入れテスト
psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/onboarding_c3.sql
```
