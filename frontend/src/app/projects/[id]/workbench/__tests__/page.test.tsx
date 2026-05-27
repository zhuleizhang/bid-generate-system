import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "@/test/utils";
import { waitFor } from "@testing-library/react";

// mock the workbench page dependencies
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { api } from "@/lib/api";

const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    back: vi.fn(),
  }),
  useParams: () => ({ id: "proj-1" }),
  usePathname: () => "/projects/proj-1/workbench",
  useSearchParams: () => new URLSearchParams(),
}));

const mockProject = {
  id: "proj-1",
  name: "测试项目",
  status: "pending_confirmation",
  tender_org: null,
  industry: null,
  project_type: null,
  deadline: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("项目工作台页面", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (path.includes("requirements")) return Promise.resolve([]);
      if (path.includes("projects")) return Promise.resolve(mockProject);
      return Promise.resolve(null);
    });
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      project_id: "proj-1",
      document_id: "doc-1",
      message: "生成流程已触发",
    });
  });

  it("渲染两个 Tab（异步加载后）", async () => {
    const Wb = await import("../page");
    const { container } = renderWithProviders(<Wb.default />);
    // 等待异步数据加载完成
    await waitFor(() => {
      expect(container.textContent).toContain("招标要求确认");
    });
    expect(container.textContent).toContain("模板结构确认");
  });

  it("loading 状态时渲染 spinner", async () => {
    // 永远不 resolve，保持 loading 状态
    (api.get as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    const Wb = await import("../page");
    const { container } = renderWithProviders(<Wb.default />);
    // 应该有 spin（通过类名或结构判断）
    expect(container.querySelector(".ant-spin")).toBeTruthy();
  });

  it("页面加载失败时不崩溃", async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("error"));
    const Wb = await import("../page");
    const { container } = renderWithProviders(<Wb.default />);
    // 等待异步处理完成
    await waitFor(() => {
      expect(container).toBeTruthy();
    });
  });
});
