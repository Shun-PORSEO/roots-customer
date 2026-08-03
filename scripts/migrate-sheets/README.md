# Sheets → Supabase 移行スクリプト（SaaS化 C7 / roots-concierge#8）

GAS + Google スプレッドシートで運用している既存テナントのデータを、Supabase（Postgres）へ取り込む**一回性の CLI** です。
ドライラン既定・冪等・件数照合レポート付き。

## 前提

- **1スプレッドシート = 1テナント（company）**。company はこのスクリプトでは作りません。
  先に `/signup` で管理者アカウントを作り、`app.provision_tenant()` に company を作らせてください。
- **owner ロールで接続します。** 非特権ロール `app_couple` は RLS と grant により
  `companies` / `customers` / 他人の `task_progress` に INSERT できません（設計どおり）。
  移行は運用者の手作業なので、例外関数を増やさず owner 接続で流す方を選びました。
- 依存は `src/` の `postgres`（postgres.js）を借ります。`scripts/` 側の `npm install` は不要です。

## 手順

### 1. スプレッドシートを CSV で書き出す

各シートを「ファイル > ダウンロード > カンマ区切り形式(.csv)」で保存し、**シート名と同じファイル名**で1つのディレクトリに置きます。

| ファイル | 必須 | 移行先 |
|---|---|---|
| `venues.csv` | ✓ | `venues` |
| `customers.csv` | ✓ | `customers` |
| `task_master.csv` | | `task_master` + `custom_tasks` |
| `task_progress.csv` | | `task_progress`（+ 非表示は `task_visibility`） |
| `user_hidden_tasks.csv` | | `task_visibility` |
| `task_items.csv` | | `task_items` |
| `message_drafts.csv` | | `message_drafts` |

### 2. 変換だけ検算する（DB 不要）

```bash
node scripts/migrate-sheets/migrate.js --dir ./export --plan-only
```

skip される行（孤児・重複・壊れた日付）と件数をレポートします。ここで意図しない skip が無いか確認します。

### 3. DB と突き合わせてドライラン（書き込みなし・既定）

```bash
node scripts/migrate-sheets/migrate.js --dir ./export \
  --admin-email owner@example.com \
  --database-url "postgres://postgres:postgres@127.0.0.1:54322/postgres"
```

投入先テナント・現在の DB 件数・投入予定件数・他テナントとの ID 衝突を照合します。

### 4. 投入する

```bash
node scripts/migrate-sheets/migrate.js --dir ./export --admin-email owner@example.com --apply
```

1トランザクションで実行し、完了後に **DB 件数の before → after（新規／更新の内訳）** を出します。
全て upsert なので、**同じコマンドを再実行しても件数は増えません**（冪等）。

## オプション

| オプション | 意味 |
|---|---|
| `--dir <path>` | CSV を置いたディレクトリ（必須） |
| `--company-id <uuid>` / `--admin-email <email>` | 投入先テナント（どちらか必須） |
| `--database-url <url>` | 未指定なら env `MIGRATE_DATABASE_URL` → `DATABASE_URL` |
| `--task-id-prefix <str>` | `task_id` が他テナントと衝突するときに全 task_id へ付ける接頭辞 |
| `--apply` | 実際に書き込む（既定はドライラン） |
| `--plan-only` | DB に接続せず変換結果だけ検算 |
| `--json` | レポートを JSON でも出力 |

## 変換規則（Sheets と Supabase のズレをどう埋めるか）

正本は `gas/sheets.ts` / `gas/setup.ts` と `supabase/migrations/0001,0002`。

- **`task_master` シートが2テーブルに割れる**: `target_line_id` が空なら `task_master`、
  値があればそのカップル専用の `custom_tasks`。`custom_tasks` には `reminder_message` 列が無いため、
  カスタムタスクの文面は落とします（落とした件数はレポートに出ます）。
- **式場コード → uuid**: Sheets の `venue_id`（`RC001`）は DB では `venues.code`。
  移行時に uuid へ解決して FK を張り替えます。
- **`task_progress` の重複**: 同じ `(line_id, task_id)` が複数行ある場合（LockService 導入前の事故）、
  `updated_at` が最新の1行だけ採用します。DB 側は複合 PK。
- **非表示**: `user_hidden_tasks` の行 ∪ `task_progress.is_visible=FALSE` を
  `task_visibility(hidden=true)` に統合します（DB の `task_progress` に `is_visible` 列はありません）。
- **テンプレ手配物**: `task_items.line_id` の空文字 `""` は `NULL` に変換（0002 の規約）。
- **孤児行**: `customers` に存在しない `line_id` を参照する行は FK 違反になるため skip し、件数を報告します。
- **レガシー `task_master`**: `venue_id` 列が無い8列版のシートはヘッダー列数で判定して読み分けます
  （`gas/sheets.ts` と同じ規則）。全タスクが全式場共通（base）になります。
- **型の揺れ**: boolean は `TRUE`/`true` のみ真、日付は `2026/08/02` 形式も受け付け、
  タイムゾーン情報の無い日時は `Asia/Tokyo`（スプレッドシートの TZ）として解釈します。

## 安全側に倒してあること

- **他テナントとの ID 衝突は中止**: `task_id` / `line_id` / `draft_id` / `item_id` はグローバル PK のため、
  他テナントが使用中の ID を見つけたら投入せず終了します（`--task-id-prefix` でずらして再実行）。
- **upsert は自テナントに限定**: 全ての `on conflict do update` に `company_id = excluded.company_id` を付け、
  万一すり抜けても他テナントの行を書き換えません。
- **進捗は新しい方を残す**: `task_progress` は Sheets の `updated_at` が DB より新しいときだけ上書きします。
  移行後に本番運用が始まっていても、後から再実行して巻き戻すことがありません。

## 移行後にやること

- **LINE キー4点のうち2点が Sheets にありません**（`line_channel_secret` / `line_login_channel_id`）。
  式場ごとに `/onboarding` の Step2-3 で入力し、接続テストが全緑になることを確認してください。
- **管理者権限の根拠は `tenant_admins`（メール認証）** です。旧 `customers.is_admin=TRUE` の担当者には
  `/signup` からの管理者登録を案内してください（`is_admin` はデータとして残るだけで権限になりません）。

## 動作確認用フィクスチャ

`fixtures/` に、重複・孤児・カスタムタスク・テンプレ手配物・存在しない式場コードなどを含むサンプル CSV があります。

```bash
node scripts/migrate-sheets/migrate.js --dir scripts/migrate-sheets/fixtures --plan-only
```
