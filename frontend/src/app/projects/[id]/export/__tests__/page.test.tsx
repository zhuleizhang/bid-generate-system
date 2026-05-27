import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({ id: "p1" }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import { api } from "@/lib/api";

const mockProject = {
  id: "p1", name: "测试项目", status: "review_completed",
  tender_org: null, industry: null, project_type: null, deadline: null,
  created_at: "", updated_at: "",
};

describe("导出页面渲染", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 组件 useCallback 中有多个 api 调用，按需返回
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path.includes("exports")) return Promise.resolve([]);
      if (path.includes("review")) return Promise.resolve({ blocking_count: 0, warning_count: 0, total_checks: 5 });
      return Promise.resolve(mockProject);
    });
    vi.mocked(api.post).mockResolvedValue({ id: "e1", status: "success" });
  });

  it("显示项目名称", async () => {
    const { default: ExportPage } = await import("@/app/projects/[id]/export/page");
    const { container } = render(<ExportPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("测试项目");
    });
  });

  it("API 失败时显示 404", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("fail"));
    const { default: ExportPage } = await import("@/app/projects/[id]/export/page");
    const { container } = render(<ExportPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("项目不存在");
    });
  });
});
