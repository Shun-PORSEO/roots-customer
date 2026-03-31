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
