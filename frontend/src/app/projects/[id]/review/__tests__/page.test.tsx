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

describe("审查结果页渲染", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 组件挂载时调用 api.post
    vi.mocked(api.post).mockRejectedValue(new Error("test error"));
  });

  it("检查失败时显示错误信息", async () => {
    const { default: ReviewPage } = await import("@/app/projects/[id]/review/page");
    const { container } = render(<ReviewPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("test error");
    });
  });
});
