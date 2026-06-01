import { Page, expect } from "@playwright/test";
import path from "path";
import { mockAllRoutes } from "./mocks/handlers";

const TEST_FILES_DIR = path.resolve(__dirname, "../../test_files");

/** 注册所有 mock API 路由 */
export async function setupAllMocks(page: Page) {
  await mockAllRoutes(page);
}

/** 导航到指定路径并等待 URL 匹配 */
export async function navigateTo(page: Page, url: string) {
  await page.goto(url);
  await page.waitForURL(`**${url}`, { timeout: 10000 });
}

/** 等待 Ant Design Spin 组件消失 */
export async function waitForSpinnerGone(page: Page) {
  await page.waitForFunction(() => {
    const spinners = document.querySelectorAll(".ant-spin-spinning");
    return spinners.length === 0;
  }, { timeout: 10000 }).catch(() => {
    // 忽略超时 —— 可能没有 spinner
  });
}

/** 等待 Ant Design Table 加载完成 */
export async function waitForTableLoaded(page: Page) {
  await waitForSpinnerGone(page);
  // 等待表格行渲染
  await page.waitForSelector(".ant-table-tbody", { timeout: 10000 }).catch(() => {});
}

/** 等待 Ant Design message 提示出现并消失 */
export async function waitForMessage(page: Page) {
  await page.waitForSelector(".ant-message", { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(() => {
    const msgs = document.querySelectorAll(".ant-message-notice");
    return msgs.length === 0;
  }, { timeout: 5000 }).catch(() => {});
}

/** 通过 file input 上传文件（Ant Design Dragger 区域） */
export async function uploadFile(page: Page, fileName: string) {
  const filePath = path.join(TEST_FILES_DIR, fileName);
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);
}

/** 获取 test_files 下某个文件的绝对路径 */
export function getTestFilePath(fileName: string): string {
  return path.join(TEST_FILES_DIR, fileName);
}

/** 点击 Ant Design 表格中的第一个链接（项目名称） */
export async function clickFirstProjectLink(page: Page) {
  const firstLink = page.locator(".ant-table-tbody a").first();
  await expect(firstLink).toBeVisible({ timeout: 10000 });
  await firstLink.click();
}
