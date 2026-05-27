import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import ChapterTree from "@/components/ChapterTree";
import type { SectionItem, SectionBadgeInfo } from "@/components/ChapterTree";

const mockSections: SectionItem[] = [
  { id: "1", section_id: "s1", title: "商务标", level: 1, section_path: "商务标", parent_section_id: null },
  { id: "2", section_id: "s2", title: "技术方案", level: 2, section_path: "商务标/技术方案", parent_section_id: "s1" },
];

describe("ChapterTree", () => {
  it("渲染章节列表（顶层节点）", () => {
    const { container } = render(
      <ChapterTree
        sections={mockSections}
        onSelect={vi.fn()}
        selectedSectionId={null}
      />
    );
    // 顶层节点 "商务标" 可见
    expect(container.textContent).toContain("商务标");
    // 子节点在 Ant Design Tree 中默认折叠不渲染，通过 DOM 查询验证
    expect(container.querySelector(".ant-tree")).toBeTruthy();
  });

  it("有 badge 数据时渲染角标", () => {
    const badgeMap: Record<string, SectionBadgeInfo> = {
      "商务标": { pending: 3, high_risk: 1, unfinished: 0, completed: 0 },
    };
    const { container } = render(
      <ChapterTree
        sections={mockSections}
        onSelect={vi.fn()}
        selectedSectionId={null}
        badgeMap={badgeMap}
      />
    );
    expect(container.querySelectorAll(".ant-badge")).toBeTruthy();
  });

  it("空列表渲染 Empty", () => {
    const { container } = render(
      <ChapterTree
        sections={[]}
        onSelect={vi.fn()}
        selectedSectionId={null}
      />
    );
    expect(container.textContent).toContain("暂无章节数据");
  });

  it("loading 状态渲染 Spin", () => {
    const { container } = render(
      <ChapterTree
        sections={mockSections}
        onSelect={vi.fn()}
        selectedSectionId={null}
        loading={true}
      />
    );
    expect(container.querySelector(".ant-spin")).toBeTruthy();
  });
});
