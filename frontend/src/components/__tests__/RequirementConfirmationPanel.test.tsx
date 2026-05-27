import { describe, it, expect, vi } from "vitest";
import { renderWithProviders } from "@/test/utils";
import RequirementConfirmationPanel from "@/components/RequirementConfirmationPanel";
import type { RequirementDBItem } from "@/lib/types/requirement";

const mockRequirements: RequirementDBItem[] = [
  {
    id: "r1",
    project_id: "p1",
    source_document_id: null,
    requirement_type: "technical_requirement",
    title: "系统性能要求",
    description: "页面响应时间不超过2秒",
    priority: "high",
    is_mandatory: true,
    risk_level: "high",
    source_text: "",
    status: "active",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  },
  {
    id: "r2",
    project_id: "p1",
    source_document_id: null,
    requirement_type: "business_requirement",
    title: "售后服务",
    description: "提供7x24小时服务",
    priority: "medium",
    is_mandatory: false,
    risk_level: "medium",
    source_text: "",
    status: "active",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  },
];

describe("RequirementConfirmationPanel", () => {
  it("渲染要求列表", () => {
    const onConfirm = vi.fn();
    const { container } = renderWithProviders(
      <RequirementConfirmationPanel
        requirements={mockRequirements}
        onConfirmed={onConfirm}
      />
    );
    expect(container.textContent).toContain("系统性能要求");
    expect(container.textContent).toContain("售后服务");
  });

  it("空列表不崩溃", () => {
    const onConfirm = vi.fn();
    const { container } = renderWithProviders(
      <RequirementConfirmationPanel
        requirements={[]}
        onConfirmed={onConfirm}
      />
    );
    expect(container).toBeTruthy();
  });

  it("点击确认按钮触发回调", async () => {
    const onConfirm = vi.fn();
    const { getByText } = renderWithProviders(
      <RequirementConfirmationPanel
        requirements={mockRequirements}
        onConfirmed={onConfirm}
      />
    );

    const btn = getByText("确认招标要求");
    btn.click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
