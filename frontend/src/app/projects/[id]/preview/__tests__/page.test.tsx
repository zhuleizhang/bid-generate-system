import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({ id: "p1" }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import { api } from "@/lib/api";

describe("文档预览页渲染", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 预览页需要项目信息和文档数据
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path.includes("files")) return Promise.resolve({ files: [] });
      return Promise.resolve({});
    });
  });

  it("无模板时显示空状态", async () => {
    const { default: PreviewPage } = await import("@/app/projects/[id]/preview/page");
    const { container } = render(<PreviewPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("请先上传投标模板");
    });
  });
});
