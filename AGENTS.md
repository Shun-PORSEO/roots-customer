# AGENTS.md — エージェント作業マップ

## セッション開始時の必須手順

1. **`init.sh` を最初に実行すること**
   ```bash
   bash init.sh
   ```

2. **`docs/spec.md` を読み、記載された全機能を連続して一気に実装すること**
   - 実装を途中で止めない。1機能ずつ区切らず、最後まで走りきること
   - 不明点があれば `docs/spec.md` を再確認し、それでも不明なら `docs/explanation.md` を参照

3. **作業完了後、QAエージェントは `scripts/e2e-tests/` を用いてアプリ全体を検証すること**

---

## 役割と担当ファイル

| 役割 | 担当 | 参照ファイル |
|------|------|-------------|
| Planner AI | 仕様策定 | `docs/spec.md`, `docs/architecture.md`, `docs/design.md` |
| Builder AI | 実装 | `src/`, `gas/`, `docs/spec.md` |
| QA AI | 検証・報告 | `scripts/e2e-tests/`, `docs/spec.md` |

---

## ディレクトリ構造

```
roots-customer/
├── AGENTS.md              ← 本ファイル（常にここを起点にする）
├── init.sh                ← 環境セットアップ
├── docs/
│   ├── explanation.md     ← ユーザー向け解説（非エンジニア向け）
│   ├── spec.md            ← 全機能仕様書（Planner AIが記入）
│   ├── architecture.md    ← モジュール境界・依存ルール
│   └── design.md          ← UI/UXデザイン原則
├── src/                   ← LINE LIFF フロントエンド（Next.js）
│   ├── app/
│   ├── components/
│   └── lib/
├── gas/                   ← Google Apps Script バックエンド
│   └── Code.ts
└── scripts/
    ├── custom-linters/    ← アーキテクチャ違反チェック
    └── e2e-tests/         ← Playwright E2Eテスト
```

---

## アーキテクチャ原則（詳細は `docs/architecture.md`）

- `src/` はフロントエンド専用。GAS のロジックを直接呼ばない
- 外部通信は必ず `src/lib/api.ts` を経由する
- GAS のエンドポイントは `gas/Code.ts` に一元化する

---

## ミス防止注意事項（ここに追記していくこと）

<!-- Builder AI / QA AI: ミスが発生したら以下に追記する -->
<!-- 例: 2026-04-01 - LIFF初期化前にユーザーIDを取得しようとしてエラー → liff.init()のawait完了後にgetProfile()を呼ぶこと -->
