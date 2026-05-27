import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({ api: { get: vi.fn() } }));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

describe("UnfinishedBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("无未完成项时返回 null", async () => {
    vi.mocked(api.get).mockResolvedValue({ total: 0, blocking: 0, high: 0, medium: 0, low: 0 });
    const { default: Badge } = await import("@/components/UnfinishedBadge");
    const { container } = render(<Badge />);
    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });

  it("有未完成项时显示 Badge", async () => {
    vi.mocked(api.get).mockResolvedValue({ total: 3, blocking: 1, high: 1, medium: 1, low: 0 });
    const { default: Badge } = await import("@/components/UnfinishedBadge");
    const { container } = render(<Badge />);
    await waitFor(() => {
      expect(container.querySelector(".ant-badge")).toBeTruthy();
    });
  });
});
