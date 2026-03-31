# 全機能仕様書（Planner AI 記入用テンプレート）

> **Planner AI への指示:**
> このファイルをユーザーの要望に基づいて具体的に埋めること。
> AI機能の組み込み提案（例: ChatGPT APIによるタスク推薦、進捗サマリー自動生成）も積極的に追記すること。
> 記入後、Builder AI はこのファイルを頭から読んで**すべての機能を連続して実装**すること。

---

## 0. アプリ概要

- **アプリ名:** roots-customer（仮）
- **目的:** 結婚式準備タスクをLINE LIFFで新郎新婦が管理し、Googleスプレッドシートでプランナーが管理する
- **技術スタック:**
  - フロントエンド: Next.js 14 (App Router) + TypeScript + Tailwind CSS
  - バックエンド: Google Apps Script (TypeScript / clasp)
  - データベース: Googleスプレッドシート
  - 認証: LINE LIFF SDK

---

## 1. スプレッドシート構造

### シート1: `customers`（顧客一覧）

| 列 | カラム名 | 型 | 説明 |
|----|----------|----|------|
| A | line_id | string | LINE UID（主キー） |
| B | nickname | string | ニックネーム |
| C | created_at | datetime | 初回登録日時 |

### シート2: `task_master`（タスクマスター）

| 列 | カラム名 | 型 | 説明 |
|----|----------|----|------|
| A | task_id | string | タスクID（例: T001） |
| B | title | string | タスク名 |
| C | description | string | タスクの詳細説明 |
| D | manual_url | string | マニュアルPDF/外部リンクURL |
| E | due_offset_days | number | 式当日から何日前が目安か |
| F | is_active | boolean | FALSE で全顧客から非表示 |

### シート3: `task_progress`（顧客別進捗）

| 列 | カラム名 | 型 | 説明 |
|----|----------|----|------|
| A | line_id | string | LINE UID（外部キー） |
| B | task_id | string | タスクID（外部キー） |
| C | is_done | boolean | 完了フラグ |
| D | updated_at | datetime | 最終更新日時 |
| E | is_visible | boolean | FALSEでこの顧客だけ非表示（個別調整用） |

---

## 2. GAS API 仕様

### ベースURL
```
https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
```

### 2-1. ユーザー登録 / 取得

- **Method:** POST
- **Action:** `register`
- **Request Body:**
  ```json
  { "line_id": "Uxxxxxxxx", "nickname": "shun" }
  ```
- **Response (新規):**
  ```json
  { "status": "created", "nickname": "shun" }
  ```
- **Response (既存):**
  ```json
  { "status": "exists", "nickname": "shun" }
  ```

### 2-2. タスク一覧取得

- **Method:** GET
- **Action:** `getTasks`
- **Query Params:** `?action=getTasks&line_id=Uxxxxxxxx`
- **Response:**
  ```json
  {
    "tasks": [
      {
        "task_id": "T001",
        "title": "招待状リストアップ",
        "description": "招待する全員のリストを作成してください",
        "manual_url": "https://...",
        "due_offset_days": 90,
        "is_done": false,
        "is_visible": true
      }
    ]
  }
  ```

### 2-3. タスクステータス更新

- **Method:** POST
- **Action:** `updateTask`
- **Request Body:**
  ```json
  { "line_id": "Uxxxxxxxx", "task_id": "T001", "is_done": true }
  ```
- **Response:**
  ```json
  { "status": "updated" }
  ```

### 共通エラーレスポンス

```json
{ "status": "error", "message": "エラーの説明" }
```

---

## 3. フロントエンド画面仕様

### 3-1. 画面一覧

| 画面ID | 画面名 | パス |
|--------|--------|------|
| P01 | ロード/初期化 | `/` |
| P02 | ニックネーム登録 | `/register` |
| P03 | タスクダッシュボード | `/dashboard` |
| P04 | タスク詳細 | `/tasks/[task_id]` |

### 3-2. P01 ロード/初期化

- LIFF SDKを初期化する（`liff.init({ liffId })`）
- LINEログイン済みでなければ `liff.login()` を呼ぶ
- `liff.getProfile()` でLINE IDを取得
- GAS `/register` APIを呼んで登録済みか確認
  - 未登録 → P02 へリダイレクト
  - 登録済み → P03 へリダイレクト

### 3-3. P02 ニックネーム登録

- ニックネーム入力フォーム（最大20文字）
- 「はじめる」ボタン押下でGAS `/register` APIを呼ぶ
- 成功後 P03 へリダイレクト

### 3-4. P03 タスクダッシュボード

- ヘッダー: 「{nickname}さんの準備ダッシュボード」
- タブ切り替え: 「未完了」「完了済み」
- タスクカード: タイトル、チェックボックス
  - チェックボックスをタップ → GAS `updateTask` を呼ぶ → 楽観的UI更新
- タスクカードをタップ → P04 へ遷移

### 3-5. P04 タスク詳細

- タスクタイトル（大きく表示）
- タスク詳細説明（テキスト）
- 「マニュアルを見る」ボタン → `manual_url` を新しいタブで開く
- 「戻る」ボタン → P03 へ戻る
- チェックボックス（P03 と同期）

---

## 4. AI機能の組み込み提案（オプション）

> ※ 実装優先度は Builder AI が判断し、コア機能完了後に追加すること

### 4-1. 進捗サマリー自動生成（GAS + Gemini API）

- プランナーがスプレッドシートからボタン一つで「全顧客の進捗サマリー」を生成できる
- Gemini API（Google公式のAI）をGASから呼び出してテキストサマリーを作成
- 実装場所: `gas/ai_summary.ts`

### 4-2. 遅延タスクの自動アラート（GAS トリガー）

- 毎朝9時にGASのタイマー機能で全顧客の進捗をチェック
- 予定期日を過ぎたタスクがある顧客を検出し、プランナーにメール通知

---

## 5. 未定義事項（Planner AI が埋めること）

- [ ] LIFFアプリのチャネルID（LINE Developer Consoleで取得）
- [ ] スプレッドシートのID
- [ ] 式当日の基準日（顧客ごとの設定方法）
- [ ] エラー発生時の画面表示の詳細デザイン
