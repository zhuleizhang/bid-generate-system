import { test, expect } from "@playwright/test";
import { setupAllMocks, navigateTo } from "./utils";

// Ant Design 在 CJK 字符间自动插入空格
const BTN_NEW = /新\s*建\s*项\s*目/;

test.describe("项目列表页面", () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  test("表格渲染 mock 数据", async ({ page }) => {
    await navigateTo(page, "/projects");

    await page.waitForSelector(".ant-table-tbody tr.ant-table-row", { timeout: 10000 });
    const rows = page.locator(".ant-table-tbody tr.ant-table-row");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("凤凰城二期外立面工程投标");
  });

  test("状态筛选下拉框存在且可交互", async ({ page }) => {
    await navigateTo(page, "/projects");

    const statusSelect = page.locator(".ant-select").first();
    await expect(statusSelect).toBeVisible();
    await statusSelect.click();
    await page.waitForSelector(".ant-select-item-option", { timeout: 5000 });
    await expect(page.locator(".ant-select-item-option")).toHaveCount(4);
  });

  test("搜索框存在", async ({ page }) => {
    await navigateTo(page, "/projects");
    await expect(page.locator('input[placeholder="搜索项目名称"]')).toBeVisible();
  });

  test('"新建项目" 按钮导航到新建页', async ({ page }) => {
    await navigateTo(page, "/projects");

    await page.getByRole("button", { name: BTN_NEW }).click();
    await page.waitForURL("**/projects/new", { timeout: 10000 });
  });

  test("点击项目名称导航到对应页面", async ({ page }) => {
    await navigateTo(page, "/projects");

    await page.waitForSelector(".ant-table-tbody a", { timeout: 10000 });
    await page.locator(".ant-table-tbody a").first().click();
    await page.waitForURL(/\/projects\/proj-001\/preview/, { timeout: 10000 });
  });
});
