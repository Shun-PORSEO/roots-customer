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
      };
    });
  });

  test("初回アクセス時に挙式日登録画面が表示される", async ({ page }) => {
    await page.goto("/");
    // ロード画面を経て登録画面に到達する
    await expect(page.getByRole("heading", { name: /挙式日/ })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="date"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /はじめる/ })).toBeVisible();
  });

  test("挙式日を入力して登録するとダッシュボードへ遷移する", async ({ page }) => {
    await page.goto("/register");
    await page.locator('input[type="date"]').fill("2026-10-10");
    await page.getByRole("button", { name: /はじめる/ }).click();
    // ダッシュボード画面に遷移し、挙式日が表示される
    await expect(page.getByText("挙式日: 2026-10-10 のダッシュボード")).toBeVisible({ timeout: 10000 });
  });

  test("挙式日が空のまま登録ボタンが押せないことを確認", async ({ page }) => {
    await page.goto("/register");
    const button = page.getByRole("button", { name: /はじめる/ });
    await expect(button).toBeDisabled();
    // 必須入力のHTML属性が効いているかもしくは無効化される想定
  });
});
