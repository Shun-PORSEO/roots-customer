# Phase A 縦スライス #1 — getTasksAndUser（Supabase + Route Handlers）

計画のゲート#2「api.ts シームの縦スライスを1本貫通」の実装。
**LINE ID Token 検証 → httpOnly セッション → RLSスコープDB → 既存フロントと同一レスポンス** を通し、
`src/lib/api.ts` のシームだけで GAS→新スタックに切り替わること（呼び出しUIは無改修）を実証する。

## このスライスが実証すること（＝計画の核心の検証）
- **api.ts シームが壊れない**: `apiClient.get("getTasksAndUser", lineId)` のシグネチャ不変。`NEXT_PUBLIC_BACKEND=db` で中身だけ差し替わる。
- **line_id をボディから受けない**（IDOR構造根絶）: サーバーが検証済みセッションから導出。
- **RLS/service_role 訂正版の実装可能性**: `app_couple` 非特権ロール＋`SET LOCAL request.line_id`＋RLSポリシー（service_roleを使わない多層防御）。
- **サイレント再認証**（Design critical）: 401→`liff.getIDToken()`で再認証→透過リトライ（api.ts に実装済み）。
- **ID Token 署名検証**（Eng critical）: LINE verify エンドポイントで iss/aud/exp/署名を検証。

## 構成
```
supabase/migrations/0001_init_vertical_slice.sql  スキーマ+RLS+app_coupleロール
supabase/seed.sql                                 ローカル用データ（dev line_id=Udev123）
src/lib/server/env.ts        env(zod)検証・dev bypass本番ガード
src/lib/server/http.ts       統一エラーDTO {code,message,hint,request_id}
src/lib/server/lineAuth.ts   LINE ID Token 署名検証（+dev bypass）
src/lib/server/session.ts    httpOnly セッション（jose）
src/lib/server/db.ts         postgres.js + withLineScope（SET LOCAL）
src/app/api/auth/line/route.ts   POST: id_token→検証→セッション発行
src/app/api/tasks/route.ts       GET: セッション→RLS DB→getTasksAndUser形
src/lib/api.ts               BACKEND=db 分岐＋サイレント再認証
```

## 動かし方（要 Docker + Supabase CLI + Node/Bun）
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
bun install            # or npm install
bun run dev            # or npm run dev

# 4) 動作確認（dev バイパスで LINE 実アカウント不要）
#   セッション発行:
curl -i -X POST localhost:3000/api/auth/line -H 'Content-Type: application/json' \
  -d '{"id_token":"dev:Udev123"}' -c /tmp/rc.cookies
#   タスク取得（getTasksAndUser 形が返る）:
curl -s localhost:3000/api/tasks -b /tmp/rc.cookies | jq
#   → seed の T001(完了)/T003(コメント)/T005/CUST-1 が返れば貫通成功。
#   セッション無しで叩くと 401(AUTH_REQUIRED)。
```

## ⚠️ この環境（node無し・Supabase未起動）では未実行
コードは書き切っているが、`bun install`＋`supabase start`＋`.env.local` が揃うまで
実ビルド/実行の検証はできていない。上記手順で最初の1本を実際に緑にするのが次の作業。

## 既知のフォローアップ（スライス外・次以降）
- venue 単位のタスク絞り込み（現状は company 単位）
- プランナー経路（Supabase Auth / auth.uid RLS）
- リマインドエンジン（判定/送信分離・冪等・JST）と観測性テーブル
- app_couple パスワードの本番管理（Vault/Secrets）
