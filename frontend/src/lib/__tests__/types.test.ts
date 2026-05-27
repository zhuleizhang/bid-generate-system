import { describe, it, expect } from "vitest";

describe("lib/types 常量完整性", () => {

  describe("ai_revision", () => {
    it("REVISION_TYPE_LABELS 所有 key 有对应颜色", async () => {
      const { REVISION_TYPE_LABELS, REVISION_TYPE_COLORS } = await import("@/lib/types/ai_revision");
      for (const k of Object.keys(REVISION_TYPE_LABELS)) {
        expect(REVISION_TYPE_COLORS[k]).toBeDefined();
      }
    });
    it("RISK_LEVEL_LABELS 所有 key 有对应颜色", async () => {
      const { RISK_LEVEL_LABELS, RISK_LEVEL_COLORS } = await import("@/lib/types/ai_revision");
      for (const k of Object.keys(RISK_LEVEL_LABELS)) {
        expect(RISK_LEVEL_COLORS[k]).toBeDefined();
      }
    });
    it("STATUS_LABELS 所有 key 有对应颜色", async () => {
      const { STATUS_LABELS, STATUS_COLORS } = await import("@/lib/types/ai_revision");
      for (const k of Object.keys(STATUS_LABELS)) {
        expect(STATUS_COLORS[k]).toBeDefined();
      }
    });
  });

  describe("bid_task", () => {
    it("TASK_TYPE_OPTIONS 从 TASK_TYPE_LABELS 生成", async () => {
      const { TASK_TYPE_LABELS, TASK_TYPE_OPTIONS } = await import("@/lib/types/bid_task");
      expect(TASK_TYPE_OPTIONS.length).toBe(Object.keys(TASK_TYPE_LABELS).length);
      expect(TASK_TYPE_OPTIONS[0]).toHaveProperty("value");
      expect(TASK_TYPE_OPTIONS[0]).toHaveProperty("label");
    });
    it("ASSIGNEE_TYPE_OPTIONS 从 ASSIGNEE_TYPE_LABELS 生成", async () => {
      const { ASSIGNEE_TYPE_LABELS, ASSIGNEE_TYPE_OPTIONS } = await import("@/lib/types/bid_task");
      expect(ASSIGNEE_TYPE_OPTIONS.length).toBe(Object.keys(ASSIGNEE_TYPE_LABELS).length);
    });
    it("PRIORITY_OPTIONS 从 PRIORITY_LABELS 生成", async () => {
      const { PRIORITY_LABELS, PRIORITY_OPTIONS } = await import("@/lib/types/bid_task");
      expect(PRIORITY_OPTIONS.length).toBe(Object.keys(PRIORITY_LABELS).length);
    });
    it("KANBAN_COLUMNS 是只读数组", async () => {
      const { KANBAN_COLUMNS } = await import("@/lib/types/bid_task");
      expect(KANBAN_COLUMNS.length).toBe(3);
      expect(KANBAN_COLUMNS[0].key).toBe("pending");
      expect(KANBAN_COLUMNS[1].key).toBe("in_progress");
      expect(KANBAN_COLUMNS[2].key).toBe("completed");
    });
  });

  describe("export", () => {
    it("EXPORT_STATUS_LABELS 数量正确", async () => {
      const { EXPORT_STATUS_LABELS } = await import("@/lib/types/export");
      expect(Object.keys(EXPORT_STATUS_LABELS)).toHaveLength(3);
    });
  });

  describe("project_file", () => {
    it("DOCUMENT_TYPE_LABELS 覆盖三种类型", async () => {
      const { DOCUMENT_TYPE_LABELS } = await import("@/lib/types/project_file");
      expect(DOCUMENT_TYPE_LABELS.bid_template).toBe("投标模板");
      expect(DOCUMENT_TYPE_LABELS.tender_doc).toBe("招标文件");
      expect(DOCUMENT_TYPE_LABELS.company_material).toBe("公司资料");
    });
  });

  describe("requirement", () => {
    it("REQUIREMENT_TYPE_OPTIONS 数量正确", async () => {
      const { REQUIREMENT_TYPE_LABELS, REQUIREMENT_TYPE_OPTIONS } = await import("@/lib/types/requirement");
      expect(REQUIREMENT_TYPE_OPTIONS.length).toBe(Object.keys(REQUIREMENT_TYPE_LABELS).length);
    });
    it("PRIORITY_LABELS 三个等级", async () => {
      const { PRIORITY_LABELS } = await import("@/lib/types/requirement");
      expect(Object.keys(PRIORITY_LABELS)).toContain("high");
      expect(Object.keys(PRIORITY_LABELS)).toContain("medium");
      expect(Object.keys(PRIORITY_LABELS)).toContain("low");
    });
    it("RISK_LEVEL_LABELS 含 blocking", async () => {
      const { RISK_LEVEL_LABELS } = await import("@/lib/types/requirement");
      expect(RISK_LEVEL_LABELS.blocking).toBe("废标");
    });
  });

  describe("review", () => {
    it("REVIEW_STATUS_LABELS 三个状态", async () => {
      const { REVIEW_STATUS_LABELS } = await import("@/lib/types/review");
      expect(Object.keys(REVIEW_STATUS_LABELS)).toHaveLength(3);
    });
  });

  describe("unfinished_item", () => {
    it("风险等级含 blocking", async () => {
      const { UNFINISHED_RISK_LABELS } = await import("@/lib/types/unfinished_item");
      expect(UNFINISHED_RISK_LABELS.blocking).toBe("阻断");
      expect(UNFINISHED_RISK_LABELS.high).toBe("高风险");
    });
    it("状态映射完整", async () => {
      const { UNFINISHED_STATUS_LABELS, UNFINISHED_STATUS_COLORS } = await import("@/lib/types/unfinished_item");
      expect(Object.keys(UNFINISHED_STATUS_LABELS).length).toBe(3);
      for (const k of Object.keys(UNFINISHED_STATUS_LABELS)) {
        expect(UNFINISHED_STATUS_COLORS[k]).toBeDefined();
      }
    });
  });

});
