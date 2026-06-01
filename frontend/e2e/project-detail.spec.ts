import { test, expect } from "@playwright/test";
import { setupAllMocks, navigateTo, uploadFile } from "./utils";

// Ant Design Tag/Card 会在 CJK 字符间插入空格
const TEXT_TEMPLATE = /投\s*标\s*模\s*板/;
const TEXT_TENDER = /招\s*标\s*文\s*件/;

test.describe("项目详情页面", () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  test("3 个 Tab 渲染", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001");
    await page.waitForSelector(".ant-tabs-tab", { timeout: 10000 });

    const tabs = page.locator(".ant-tabs-tab");
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toContainText("文件管理");
    await expect(tabs.nth(1)).toContainText("招标要求");
    await expect(tabs.nth(2)).toContainText("导出记录");
  });

  test("文件上传区域可见", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001");
    await page.waitForSelector(".ant-upload-drag", { timeout: 10000 });
    await expect(page.locator(".ant-upload-drag")).toContainText("点击或拖拽文件到此区域上传");
  });

  test("已上传文件列表按类型分组显示", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001");
    await page.waitForSelector(".ant-list-item", { timeout: 10000 });
    await expect(page.getByText(TEXT_TEMPLATE).first()).toBeVisible();
    await expect(page.getByText(TEXT_TENDER).first()).toBeVisible();
  });

  test("上传文件触发文件输入", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001");

    // 验证上传区域存在且 file input 可交互
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();

    // 使用 test_files 中的文件触发上传
    await uploadFile(page, "【邀标文件】凤凰城二期商业(A、B楼)外立面(1).pdf");
  });

  test("招标要求 Tab 按类型分组显示", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001");
    await page.locator(".ant-tabs-tab").nth(1).click();
    await page.waitForSelector(".ant-collapse-header", { timeout: 10000 });
    const count = await page.locator(".ant-collapse-header").count();
    expect(count).toBeGreaterThan(0);
  });

  test("顶部导航按钮存在", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001");
    await expect(page.getByRole("button", { name: /文\s*档\s*预\s*览/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /任\s*务\s*看\s*板/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /响\s*应\s*检\s*查/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /导\s*出/ })).toBeVisible();
  });
});
