import { test, expect } from "@playwright/test";

/**
 * テストシナリオ: タスクダッシュボード
 */

test.describe("タスクダッシュボード", () => {
  test.beforeEach(async ({ page }) => {
    // 登録済みユーザーとしてダッシュボードに直接アクセス
    await page.addInitScript(() => {
      localStorage.setItem("mock_line_id", "U_TEST_USER_001");
      localStorage.setItem("mock_wedding_date", "2026-10-10");
    });
  });

  test("ダッシュボードに挙式日が表示される", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/挙式日: 2026-10-10 のダッシュボード/)).toBeVisible({ timeout: 10000 });
  });

  test("「未完了」「完了済み」タブが表示される", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("tab", { name: /未完了/ })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("tab", { name: /完了済み/ })).toBeVisible();
  });

  test("タスクカードが表示される", async ({ page }) => {
    await page.goto("/dashboard");
    // タスクが1件以上表示されることを確認
    await expect(page.locator("[data-testid='task-card']").first()).toBeVisible({ timeout: 10000 });
  });

  test("タスクカードをタップすると詳細画面へ遷移する", async ({ page }) => {
    await page.goto("/dashboard");
    await page.locator("[data-testid='task-card']").first().click();
    // URLが /tasks/[id] 形式になることを確認
    await expect(page).toHaveURL(/\/tasks\//, { timeout: 5000 });
    await expect(page.getByRole("button", { name: /戻る/ })).toBeVisible();
  });
});
