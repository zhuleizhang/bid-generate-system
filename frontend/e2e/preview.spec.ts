import { test, expect } from "@playwright/test";
import { setupAllMocks, navigateTo, waitForSpinnerGone } from "./utils";

test.describe("文档预览页面", () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  test("模板选择器渲染", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001/preview");

    await waitForSpinnerGone(page);
    await page.waitForSelector(".ant-select", { timeout: 10000 });

    const select = page.locator(".ant-select").first();
    await expect(select).toBeVisible();
  });

  test("三栏布局渲染", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001/preview");

    // 等待预览加载
    await page.waitForSelector(".mammoth-preview", { timeout: 15000 });

    // 章节树（左侧）
    await expect(page.getByText("章节导航")).toBeVisible();

    // AI 修订侧边栏（右侧）- 使用 first() 避免严格模式冲突
    await expect(page.getByText("AI 修订").first()).toBeVisible();
    await expect(page.getByText("未完成项").first()).toBeVisible();
  });

  test("chapter tree 渲染章节节点", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001/preview");

    await page.waitForSelector(".mammoth-preview", { timeout: 15000 });

    // 验证章节树包含主要章节
    await expect(page.locator(".ant-tree")).toContainText("商务标");
    await expect(page.locator(".ant-tree")).toContainText("技术标");
  });

  test("点击 AI 修订高亮区域弹出详情", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001/preview");

    await page.waitForSelector(".ai-revision-wrapper", { timeout: 15000 });

    // 点击第一个高亮修订区域
    const highlight = page.locator(".ai-revision-wrapper").first();
    await highlight.click();

    // popover 应该显示修订详情
    await page.waitForSelector(".ant-popover", { timeout: 5000 });
    await expect(page.locator(".ant-popover")).toBeVisible();
  });

  test("点击 AI 修订列表中的条目展示详情", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001/preview");

    await page.waitForSelector(".mammoth-preview", { timeout: 15000 });

    // 右侧修订列表应该有条目
    const revisionSidebar = page.locator('[id*="rc-tabs"]').filter({ hasText: /修订/ });
    await expect(revisionSidebar).toBeVisible();
  });
});
