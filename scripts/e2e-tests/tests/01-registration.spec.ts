import { test, expect } from "@playwright/test";

/**
 * テストシナリオ: 初回登録フロー
 *
 * QA AI へ: このテストは LIFF 環境をモック（擬似化）して動作確認します。
 * 実際のLINE認証は自動テストで再現不可能なため、LINE SDKをモックに差し替えます。
 */

test.describe("初回登録フロー", () => {
  test.beforeEach(async ({ page }) => {
    // LIFF SDKをモックに置き換えて、LINE IDを固定値で返す
    await page.addInitScript(() => {
      (window as any).__LIFF_MOCK__ = {
        line_id: "U_TEST_USER_001",
        nickname_display: "テストユーザー",
      };
    });
  });

  test("初回アクセス時にニックネーム登録画面が表示される", async ({ page }) => {
    await page.goto("/");
    // ロード画面を経てニックネーム登録画面に到達する
    await expect(page.getByRole("heading", { name: /ニックネーム/ })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("textbox")).toBeVisible();
    await expect(page.getByRole("button", { name: /はじめる/ })).toBeVisible();
  });

  test("ニックネームを入力して登録するとダッシュボードへ遷移する", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("textbox").fill("テスト太郎");
    await page.getByRole("button", { name: /はじめる/ }).click();
    // ダッシュボード画面に遷移し、ニックネームが表示される
    await expect(page.getByText("テスト太郎さんの準備ダッシュボード")).toBeVisible({ timeout: 10000 });
  });

  test("ニックネームが空のまま登録ボタンを押してもエラーが表示される", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: /はじめる/ }).click();
    await expect(page.getByText(/ニックネームを入力/)).toBeVisible();
  });
});
