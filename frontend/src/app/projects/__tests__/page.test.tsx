import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn() },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/projects",
}));

import { api } from "@/lib/api";

describe("项目列表页面", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({
      items: [
        { id: "p1", name: "测试项目", tender_org: "招标方", industry: "IT",
          project_type: "服务类", deadline: "2026-12-31", status: "draft",
          created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
      ],
      total: 1, page: 1, page_size: 20,
    });
  });

  it("显示项目列表", async () => {
    const { default: ProjectsPage } = await import("@/app/projects/page");
    const { container } = render(<ProjectsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("测试项目");
      expect(container.textContent).toContain("草稿");
    });
  });

  it("status 标签映射正确", async () => {
    vi.mocked(api.get).mockResolvedValue({
      items: [
        { id: "p2", name: "审阅中项目", tender_org: "", industry: "", project_type: "",
          deadline: "", status: "in_review", created_at: "", updated_at: "" },
      ],
      total: 1, page: 1, page_size: 20,
    });
    const { default: ProjectsPage } = await import("@/app/projects/page");
    const { container } = render(<ProjectsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("审阅中");
    });
  });
});
