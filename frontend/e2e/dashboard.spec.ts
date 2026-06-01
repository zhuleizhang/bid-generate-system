import { test, expect } from "@playwright/test";
import { setupAllMocks, navigateTo } from "./utils";

test.describe("Dashboard 页面", () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  test("渲染 4 个统计卡片", async ({ page }) => {
    await navigateTo(page, "/");

    // 等待统计卡片出现
    await page.waitForSelector(".ant-statistic", { timeout: 10000 });
    const cards = page.locator(".ant-statistic");
    await expect(cards).toHaveCount(4);

    const titles = page.locator(".ant-statistic-title");
    await expect(titles.nth(0)).toContainText("审阅中项目");
    await expect(titles.nth(1)).toContainText("待处理任务");
    await expect(titles.nth(2)).toContainText("已完成标书");
    await expect(titles.nth(3)).toContainText("知识库文档");
  });

  test("loading 状态后显示数据", async ({ page }) => {
    await navigateTo(page, "/");

    // 等待统计值渲染（非零值说明 mock 数据已加载）
    await page.waitForFunction(() => {
      const values = document.querySelectorAll(".ant-statistic-content-value");
      const first = values[0]?.textContent?.trim();
      return first && first !== "0" && first !== "-" && first !== "";
    }, { timeout: 10000 });

    const statValues = page.locator(".ant-statistic-content-value");
    const firstValue = await statValues.nth(0).textContent();
    expect(firstValue).toBeTruthy();
  });
});
