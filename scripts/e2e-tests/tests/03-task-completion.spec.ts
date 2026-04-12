import { test, expect } from "@playwright/test";

/**
 * テストシナリオ: タスク完了チェック操作
 */

test.describe("タスク完了チェック機能", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("mock_line_id", "U_TEST_USER_001");
      localStorage.setItem("mock_wedding_date", "2026-10-10");
    });
  });

  test("チェックボックスをタップするとタスクが完了になる", async ({ page }) => {
    await page.goto("/dashboard");
    const firstCheckbox = page.locator("[data-testid='task-checkbox']").first();
    await expect(firstCheckbox).toBeVisible({ timeout: 10000 });

    // 未完了状態であることを確認
    await expect(firstCheckbox).not.toBeChecked();

    // チェックを入れる
    await firstCheckbox.click();

    // 楽観的UIとして即座に未完了リストから消えることを確認
    await expect(firstCheckbox).toBeHidden({ timeout: 5000 });
  });

  test("完了タスクのチェックを外すと未完了に戻る", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("tab", { name: /完了済み/ }).click();

    const firstCheckbox = page.locator("[data-testid='task-checkbox']").first();
    // 完了済みタブにタスクがある場合のみテスト
    if (await firstCheckbox.isVisible()) {
      await expect(firstCheckbox).toBeChecked();
      await firstCheckbox.click();
      await expect(firstCheckbox).not.toBeChecked({ timeout: 3000 });
    } else {
      test.skip();
    }
  });

  test("APIエラー時にエラートーストが表示される", async ({ page }) => {
    // GAS APIへのリクエストを強制的に失敗させる
    await page.route("**/exec**", (route) => route.abort());

    await page.goto("/dashboard");
    const firstCheckbox = page.locator("[data-testid='task-checkbox']").first();
    if (await firstCheckbox.isVisible()) {
      await firstCheckbox.click();
      // エラートーストが表示されることを確認
      await expect(page.getByText(/通信エラー/)).toBeVisible({ timeout: 5000 });
    }
  });
});
