import { test, expect } from "@playwright/test";
import { setupAllMocks, navigateTo, uploadFile } from "./utils";

// Ant Design 在 CJK 字符间自动插入空格
const BTN_NEW = /新\s*建\s*项\s*目/;
const BTN_CREATE = /创\s*建/;
const BTN_ENTER_REVIEW = /进\s*入\s*审\s*阅\s*工\s*作\s*台/;
const BTN_CONFIRM_REQUIREMENTS = /确\s*认\s*招\s*标\s*要\s*求/;
const BTN_CONFIRM_STRUCTURE = /确\s*认\s*模\s*板\s*结\s*构/;
const BTN_CONFIRM_GENERATE = /确\s*认\s*并\s*生\s*成/;

test.describe("全流程 E2E", () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  test("完整流程：新建项目 → 上传文件 → 确认生成 → 预览审核 → 检查 → 导出", async ({ page }) => {
    // ── Step 1: 项目列表 ────────────────────────────────
    await navigateTo(page, "/projects");
    await page.waitForSelector(".ant-table-tbody", { timeout: 10000 });
    await expect(page.getByText("凤凰城二期外立面工程投标")).toBeVisible();

    // ── Step 2: 新建项目 ─────────────────────────────────
    await page.getByRole("button", { name: BTN_NEW }).click();
    await page.waitForURL("**/projects/new", { timeout: 10000 });
    await page.getByLabel(/项目名称/).fill("全流程测试项目");
    await page.getByRole("button", { name: BTN_CREATE }).click();

    // 跳转至编辑页
    await page.waitForURL(/\/projects\/[^/]+\/edit/, { timeout: 10000 });

    // ── Step 3: 文件上传 ─────────────────────────────────
    await page.goto("/projects/proj-001");
    await page.waitForURL("**/projects/proj-001", { timeout: 10000 });
    await page.waitForSelector(".ant-upload-drag", { timeout: 10000 });
    await uploadFile(page, "【邀标文件】凤凰城二期商业(A、B楼)外立面(1).pdf");

    // ── Step 4: 工作台确认并生成 ─────────────────────────
    await page.goto("/projects/proj-001/workbench");
    await page.waitForURL("**/projects/proj-001/workbench", { timeout: 10000 });
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

    await page.getByRole("button", { name: BTN_CONFIRM_GENERATE }).click();
    await page.waitForSelector(".ant-result", { timeout: 10000 });

    // ── Step 5: 进入审阅工作台 ───────────────────────────
    await page.getByRole("button", { name: BTN_ENTER_REVIEW }).click();
    await page.waitForURL("**/projects/proj-001/preview", { timeout: 10000 });
    await page.waitForSelector(".mammoth-preview", { timeout: 15000 });
    await expect(page.getByText("章节导航")).toBeVisible();

    // ── Step 6: 去审查页 ─────────────────────────────────
    await page.goto("/projects/proj-001/review");
    await page.waitForURL("**/projects/proj-001/review", { timeout: 10000 });
    await page.waitForSelector(".ant-statistic", { timeout: 15000 });
    await expect(page.getByText("响应矩阵")).toBeVisible();

    // ── Step 7: 去导出页 ─────────────────────────────────
    await page.goto("/projects/proj-001/export");
    await page.waitForURL("**/projects/proj-001/export", { timeout: 10000 });
    await page.waitForSelector(".ant-card", { timeout: 10000 });
  });
});
