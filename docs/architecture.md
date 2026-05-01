# アーキテクチャ規約

## モジュール境界ルール

```
src/app/          ← Next.js ルーティング・ページコンポーネントのみ
src/components/   ← 再利用可能なUIコンポーネント（ロジックを持たない）
src/lib/          ← 外部通信・ビジネスロジック・型定義
src/hooks/        ← Reactカスタムフック
gas/              ← Google Apps Script（バックエンド全体）
```

### 依存方向（一方通行）

```
src/app → src/components
src/app → src/hooks
src/hooks → src/lib
src/lib → (外部API: GAS endpoint, LIFF SDK)

GAS内: Code.ts → sheets.ts → types.ts
```

### 禁止事項

- `src/app/` から直接 `fetch()` を呼ぶことを禁止。必ず `src/lib/api.ts` 経由にする
- `src/components/` にビジネスロジック（API呼び出し、データ変換）を書くことを禁止
- `gas/Code.ts` 以外のファイルが `doGet` / `doPost` を定義することを禁止

---

## 命名規則

| 対象 | 規則 | 例 |
|------|------|----|
| コンポーネント | PascalCase | `TaskCard.tsx` |
| フック | `use` + PascalCase | `useTaskList.ts` |
| ユーティリティ関数 | camelCase | `formatDate.ts` |
| 型定義 | `I` プレフィックス or `Type` サフィックス | `ITask`, `TaskType` |
| 定数 | UPPER_SNAKE_CASE | `GAS_ENDPOINT` |
| GAS関数 | camelCase | `getTasksByLineId()` |

---

## 型定義の一元管理

すべての共有型は `src/lib/types.ts` に定義する。

```typescript
// src/lib/types.ts の構造例
export interface ITask {
  task_id: string;
  title: string;
  description: string;
  manual_url: string;
  due_offset_days: number;
  is_done: boolean;
  is_visible: boolean;
}

export interface ICustomer {
  line_id: string;
  nickname: string;
}
```

---

## GAS レスポンス規約

GASのすべてのAPIは以下の形式で返す。

```typescript
// 成功
{ status: "ok" | "created" | "exists" | "updated", ...data }

// 失敗
{ status: "error", message: string }
```

フロントエンドは `status === "error"` のときは必ずユーザーに通知すること。

---

## セキュリティ規約

1. GASの各エンドポイントは必ず `line_id` パラメータの存在を検証する
2. `line_id` が空・null・undefined の場合は即座に `{ status: "error", message: "Unauthorized" }` を返す
3. `task_progress` シートの読み書きは、リクエストの `line_id` と一致する行のみ許可する
4. LIFF IDはフロントエンドの環境変数（`NEXT_PUBLIC_LIFF_ID`）から取得する。ハードコードしない
5. GAS のデプロイ設定は「自分のみ」ではなく「全員（匿名を含む）」で実行する（LIFF からアクセスするため）

---

## エラーハンドリング規約

- フロントエンド: `src/lib/api.ts` に集中してエラー処理し、`throw` してフックに伝播させる
- フック: try/catch でエラーを受け取り `error` stateに格納
- コンポーネント: `error` stateが truthy なら `<ErrorMessage>` コンポーネントを表示
- GAS: try/catch ですべての関数をラップし、予期しないエラーも `status: "error"` で返す

---

## マルチテナント方針

本アプリの「テナント」階層は **2層** で設計する。

```
企業（Wedding Company）          ← 1デプロイ = 1企業
  └─ 式場（Venue, venue_id）     ← 同一企業内に複数あり、carry by customers.venue_id
       └─ ペア（Customer, line_id）  ← 1ペアは必ず1式場に所属
```

### 同一企業・複数式場（同一デプロイ内）

- 同じスプレッドシート・同じ GAS・同じ LINE 公式アカウント・同じ LIFF を共有する
- 各式場の識別は `venues` シートの `venue_id` で行う
- ペア登録時の式場特定は次の順で決まる:
  1. LIFF URL の `?venue=XXX` クエリ（**式場ごとに専用QRを発行する運用**を推奨）
  2. URLにない場合は登録画面のドロップダウンで顧客自身が選択
- タスクマスター (`task_master`) は `venue_id` 列で式場ごとに分離。空欄は全式場共通タスクとして扱う
- 管理者 (`is_admin = true`) は管理画面で「全式場まとめて表示」「特定の式場のみ表示」を切替可能

### 別企業への横展開（=新規テナント）

異なるウェディング企業に提供する場合は **同じコードベースから別デプロイを立てる** 方式を取る。
1スプレッドシートに複数企業のデータを混在させる方式は **採用しない**（個人情報の混在リスク・GAS実行クォータの逼迫・契約上の責任分界点があいまいになるため）。

#### 別企業への展開チェックリスト

| # | やること | なぜ必要か |
|---|---------|-----------|
| 1 | 新しい Google スプレッドシートを作成し、`gas/setup.ts` の `setupEnvironment()` を実行 | 企業単位でデータを物理分離するため |
| 2 | 新しい GAS プロジェクトを `clasp` で作成し、デプロイIDを取得 | スプレッドシートと1対1で対応する API エンドポイントを得るため |
| 3 | LINE Developers で新しい Provider / Messaging API チャネル / LIFF アプリを作成 | 企業ごとに別ブランドのLINE公式アカウントから配信するため |
| 4 | フロントを Vercel などで別デプロイし、環境変数を新企業のもので上書き<br>`NEXT_PUBLIC_GAS_ENDPOINT` / `NEXT_PUBLIC_LIFF_ID` / `NEXT_PUBLIC_ADMIN_PASSWORD` | 1リポジトリから複数企業向けに配信するため |
| 5 | LINE 公式アカウントの応答メッセージ・リッチメニュー URL を新フロントの LIFF URL に向ける | 顧客が LINE からアプリに入れるようにするため |
| 6 | 新企業の式場（`venues` シート）を初期登録 → 式場ごとの QR を発行 | 顧客に渡せる導線を作るため |
| 7 | `DESIGN.md` のブランドカラー（必要に応じて）を企業向けにフォークして適用 | 企業ごとに見た目を変える要望が出る場合の対応 |

#### コード共通化の考え方

**コードは1リポジトリで共通化、ブランディング・接続先は環境変数で切替**を原則とする。
別企業のために `if (companyId === 'X')` のような分岐を入れるのは禁止（横展開のたびにコードが膨張するため）。
企業ごとの違いは次の3層で吸収する:

1. **環境変数**: GASエンドポイント、LIFF ID、管理パスワード
2. **デザイントークン** (`DESIGN.md` / `tailwind.config.ts`): カラー、フォント
3. **データ** (`venues`, `task_master` シート): 式場名、デフォルトタスク内容

これらすべてが「コード変更なし」で切り替えられる範囲に収まるよう、新機能を入れる際も常にこの3層原則を守る。
