import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E テスト設定
 *
 * QA AIへの指示:
 * ──────────────────────────────────────────────────────────────────────
 * このテストは「Builder AI がすべての実装を完了した後」に実行すること。
 * 実行前に以下を確認すること:
 *   1. `cd src && npm run build && npm run start` でフロントエンドが起動していること
 *   2. GAS が本番環境にデプロイされていること
 *   3. .env.local に有効な LIFF ID と GAS エンドポイントが設定されていること
 *
 * テストの目的:
 *   実際の人間のユーザーがLINEアプリからアクセスするような操作をシミュレートし、
 *   すべての画面・機能・UIが仕様通りに動作することを確認・報告する。
 *
 * テスト完了後、QA AI は以下の形式でレポートを出力すること:
 *   - 合格した機能のリスト
 *   - 失敗した機能のリスト（スクリーンショット付き）
 *   - 修正が必要な箇所の具体的な指摘
 * ──────────────────────────────────────────────────────────────────────
 */

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 1,
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
  ],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // LINE LIFF はモバイル表示を前提とする
    ...devices["iPhone 13"],
  },
  projects: [
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] },
    },
  ],
});
