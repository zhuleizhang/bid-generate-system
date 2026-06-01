import { test, expect } from "@playwright/test";
import { setupAllMocks, navigateTo, waitForSpinnerGone } from "./utils";

test.describe("任务看板页面", () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  test("看板渲染 3 列", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001/tasks");

    await waitForSpinnerGone(page);
    await page.waitForSelector(".ant-card", { timeout: 10000 });

    await expect(page.getByText("待处理")).toBeVisible();
    await expect(page.getByText("进行中")).toBeVisible();
    await expect(page.getByText("已完成")).toBeVisible();
  });

  test("渲染任务卡片", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001/tasks");

    await waitForSpinnerGone(page);
    await page.waitForSelector(".ant-card", { timeout: 10000 });

    await expect(page.getByText("编写技术方案")).toBeVisible();
    await expect(page.getByText("准备资质文件")).toBeVisible();
  });

  test("视图切换按钮存在", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001/tasks");

    await waitForSpinnerGone(page);

    // 任务页面使用 Segmented 组件做视图切换
    const segmented = page.locator(".ant-segmented");
    await expect(segmented).toBeVisible({ timeout: 5000 });
  });
});
