import { test, expect } from "@playwright/test";
import { setupAllMocks, navigateTo } from "./utils";

test.describe("响应性检查页面", () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  test("统计卡片显示正确数量和覆盖率", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001/review");

    // 等待检查完成（统计卡片渲染）
    await page.waitForSelector(".ant-statistic", { timeout: 15000 });

    // 总要求数应为 5
    await expect(page.locator(".ant-statistic").filter({ hasText: /总要求数/ })).toContainText("5");

    // 等待覆盖率
    await expect(page.locator(".ant-statistic").filter({ hasText: /覆盖率/ })).toBeVisible();
  });

  test("响应矩阵表格渲染", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001/review");

    await page.waitForSelector(".ant-table-tbody", { timeout: 15000 });

    const rows = page.locator(".ant-table-tbody tr.ant-table-row");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // "响应矩阵" 标题
    await expect(page.getByText("响应矩阵")).toBeVisible();
  });

  test("废标风险时显示警告横幅", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001/review");

    // mockReviewResult 有 has_blocking_issues: true
    await page.waitForSelector(".ant-alert-error", { timeout: 15000 });
    await expect(page.locator(".ant-alert")).toContainText("存在未响应的强制要求");
  });

  test("重新检查按钮触发重新检查", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001/review");

    await page.waitForSelector(".ant-table-tbody", { timeout: 15000 });

    const retryBtn = page.getByRole("button", { name: /重新检查/ });
    await retryBtn.click();

    // 应该再次加载
    await page.waitForSelector(".ant-statistic", { timeout: 10000 });
  });
});
