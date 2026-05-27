import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({ id: "p1" }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import { api } from "@/lib/api";

const mockProject = {
  id: "p1", name: "测试项目", tender_org: "招标方", industry: "IT",
  project_type: "服务类", deadline: "2026-12-31", status: "draft",
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};

describe("项目详情页渲染", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path.includes("files")) return Promise.resolve({ files: [] });
      if (path.includes("requirements")) return Promise.resolve([]);
      return Promise.resolve(mockProject);
    });
  });

  it("显示项目名称和招标单位", async () => {
    const { default: Page } = await import("@/app/projects/[id]/page");
    const { container } = render(<Page />);
    await waitFor(() => {
      expect(container.textContent).toContain("测试项目");
      expect(container.textContent).toContain("招标方");
    });
  });

  it("显示三个 Tab", async () => {
    const { default: Page } = await import("@/app/projects/[id]/page");
    const { container } = render(<Page />);
    await waitFor(() => {
      expect(container.textContent).toContain("文件管理");
      expect(container.textContent).toContain("招标要求");
      expect(container.textContent).toContain("导出记录");
    });
  });

  it("项目不存在时显示错误提示", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("not found"));
    const { default: Page } = await import("@/app/projects/[id]/page");
    const { container } = render(<Page />);
    await waitFor(() => {
      expect(container.textContent).toContain("项目不存在或已被删除");
    });
  });
});
