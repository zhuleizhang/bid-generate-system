import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn() },
}));

import { api } from "@/lib/api";

describe("仪表盘页面", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ total: 0, items: [], page: 1, page_size: 20 });
  });

  it("渲染四个统计卡片", async () => {
    const { default: Home } = await import("@/app/page");
    const { container } = render(<Home />);
    await waitFor(() => {
      expect(container.textContent).toContain("审阅中项目");
      expect(container.textContent).toContain("待处理任务");
      expect(container.textContent).toContain("已完成标书");
      expect(container.textContent).toContain("知识库文档");
    });
  });

  it("API 失败不崩溃", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("fail"));
    const { default: Home } = await import("@/app/page");
    const { container } = render(<Home />);
    await waitFor(() => {
      expect(container).toBeTruthy();
    });
  });
});
