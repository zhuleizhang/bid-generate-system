import { test, expect } from "@playwright/test";
import { setupAllMocks, navigateTo } from "./utils";

// Ant Design 在 CJK 字符间自动插入空格，"创建" 渲染为 "创 建"
const BTN_CREATE = /创\s*建/;
const BTN_CANCEL = /取\s*消/;

test.describe("新建项目页面", () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  test("表单字段渲染", async ({ page }) => {
    await navigateTo(page, "/projects/new");
    await page.waitForSelector("form", { timeout: 10000 });

    await expect(page.getByLabel(/项目名称/)).toBeVisible();
    await expect(page.getByRole("button", { name: BTN_CREATE })).toBeVisible();
    await expect(page.getByRole("button", { name: BTN_CANCEL })).toBeVisible();
  });

  test("必填字段为空时提交显示验证错误", async ({ page }) => {
    await navigateTo(page, "/projects/new");

    await page.getByRole("button", { name: BTN_CREATE }).click();
    await page.waitForSelector(".ant-form-item-explain-error", { timeout: 5000 });
  });

  test("填写表单提交后跳转到编辑页", async ({ page }) => {
    await navigateTo(page, "/projects/new");

    await page.getByLabel(/项目名称/).fill("测试项目");
    await page.getByRole("button", { name: BTN_CREATE }).click();

    await page.waitForURL(/\/projects\/[^/]+\/edit/, { timeout: 10000 });
  });

  test("点击取消返回项目列表", async ({ page }) => {
    await navigateTo(page, "/projects/new");

    await page.getByRole("button", { name: BTN_CANCEL }).click();
    await page.waitForURL("**/projects", { timeout: 10000 });
  });
});
