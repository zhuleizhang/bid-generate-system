import { test, expect } from "@playwright/test";
import { setupAllMocks, navigateTo, waitForSpinnerGone } from "./utils";

// Ant Design 在 CJK 字符间自动插入空格
const BTN_SAVE = /保\s*存/;
const BTN_CANCEL = /取\s*消/;

test.describe("编辑项目页面", () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  test("表单预填项目数据", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001/edit");

    await waitForSpinnerGone(page);
    await page.waitForSelector("form", { timeout: 10000 });

    const nameInput = page.getByLabel(/项目名称/);
    const value = await nameInput.inputValue();
    expect(value).toBeTruthy();
  });

  test("修改后保存并跳转到项目列表", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001/edit");

    await waitForSpinnerGone(page);
    await page.waitForSelector("form", { timeout: 10000 });

    await page.getByLabel(/项目名称/).clear();
    await page.getByLabel(/项目名称/).fill("更新后的项目名称");
    await page.getByRole("button", { name: BTN_SAVE }).click();

    // 保存成功后跳转到项目列表
    await page.waitForURL("**/projects", { timeout: 10000 });
    await expect(page.locator(".ant-table-tbody")).toBeVisible();
  });

  test("取消按钮返回项目列表", async ({ page }) => {
    await navigateTo(page, "/projects/proj-001/edit");

    await waitForSpinnerGone(page);
    await page.getByRole("button", { name: BTN_CANCEL }).click();

    await page.waitForURL("**/projects", { timeout: 10000 });
  });
});
