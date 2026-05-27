import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/projects",
  useSearchParams: () => new URLSearchParams(),
}));

// mock UnfinishedBadge as simple div
vi.mock("@/components/UnfinishedBadge", () => ({
  default: () => null,
}));

describe("MainLayout", () => {
  it("渲染侧边栏菜单项", async () => {
    const { default: MainLayout } = await import("@/components/layouts/MainLayout");
    const { container } = render(
      <MainLayout>
        <div>child</div>
      </MainLayout>
    );
    expect(container.textContent).toContain("投标项目");
    expect(container.textContent).toContain("child");
  });
});
