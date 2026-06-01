import { test, expect } from "@playwright/test";
import { setupAllMocks, navigateTo, waitForSpinnerGone } from "./utils";

// Ant Design 在 CJK 字符间自动插入空格
const BTN_CONFIRM_REQUIREMENTS = /确\s*认\s*招\s*标\s*要\s*求/;
const BTN_CONFIRM_STRUCTURE = /确\s*认\s*模\s*板\s*结\s*构/;
const BTN_CONFIRM_GENERATE = /确\s*认\s*并\s*生\s*成/;
const BTN_NEED_CONFIRM_ALL = /请\s*确\s*认\s*全\s*部/;
const BTN_ENTER_REVIEW = /进\s*入\s*审\s*阅\s*工\s*作\s*台/;

test.describe("项目工作台页面", () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  test("2 个 Tab 渲染", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001/workbench");

    await waitForSpinnerGone(page);
    await page.waitForSelector(".ant-tabs-tab", { timeout: 10000 });

    const tabs = page.locator(".ant-tabs-tab");
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(0)).toContainText("招标要求确认");
    await expect(tabs.nth(1)).toContainText("模板结构确认");
  });

  test("未确认时 \"确认并生成\" 按钮禁用", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001/workbench");

    await waitForSpinnerGone(page);
    await expect(page.getByRole("button", { name: BTN_NEED_CONFIRM_ALL })).toBeDisabled();
  });

  test("确认两个 Tab 后 \"确认并生成\" 按钮可用", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001/workbench");

    await waitForSpinnerGone(page);
    await page.waitForSelector(".ant-tabs-tab", { timeout: 10000 });

    // 确认 Tab 1
    const btn1 = page.getByRole("button", { name: BTN_CONFIRM_REQUIREMENTS });
    if (await btn1.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn1.click();
      await page.waitForTimeout(300);
    }

    // 确认 Tab 2
    await page.locator(".ant-tabs-tab").nth(1).click();
    await page.waitForTimeout(300);
    const btn2 = page.getByRole("button", { name: BTN_CONFIRM_STRUCTURE });
    if (await btn2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn2.click();
      await page.waitForTimeout(300);
    }

    await expect(page.getByRole("button", { name: BTN_CONFIRM_GENERATE })).toBeEnabled();
  });

  test("点击确认并生成后显示成功结果页", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001/workbench");

    await waitForSpinnerGone(page);
    await page.waitForSelector(".ant-tabs-tab", { timeout: 10000 });

    // 确认 Tab 1
    const btn1 = page.getByRole("button", { name: BTN_CONFIRM_REQUIREMENTS });
    if (await btn1.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn1.click();
      await page.waitForTimeout(200);
    }

    // 确认 Tab 2
    await page.locator(".ant-tabs-tab").nth(1).click();
    await page.waitForTimeout(300);
    const btn2 = page.getByRole("button", { name: BTN_CONFIRM_STRUCTURE });
    if (await btn2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn2.click();
      await page.waitForTimeout(200);
    }

    // 点击确认并生成
    await page.getByRole("button", { name: BTN_CONFIRM_GENERATE }).click();

    await page.waitForSelector(".ant-result", { timeout: 10000 });
    await expect(page.locator(".ant-result")).toContainText("生成流程已触发");
    await expect(page.getByRole("button", { name: BTN_ENTER_REVIEW })).toBeVisible();
  });
});
