import { test, expect } from "@playwright/test";
import { setupAllMocks, navigateTo } from "./utils";

test.describe("导出页面", () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  test("导出页面渲染", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001/export");

    // 等待页面内容加载
    await page.waitForSelector(".ant-card", { timeout: 10000 });
  });

  test("导出历史记录列表", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001/export");

    await page.waitForSelector(".ant-list-item", { timeout: 10000 });

    // mock 数据包含 1 条导出记录
    const items = page.locator(".ant-list-item");
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
