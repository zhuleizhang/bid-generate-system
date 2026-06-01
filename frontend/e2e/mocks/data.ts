import type { Project, ProjectListResponse } from "@/lib/types/project";
import type { RequirementDBItem } from "@/lib/types/requirement";
import type { ProjectFileItem } from "@/lib/types/project_file";
import type { AIRevision } from "@/lib/types/ai_revision";
import type { UnfinishedItem } from "@/lib/types/unfinished_item";
import type { ReviewCheckResult } from "@/lib/types/review";
import type { ExportRecordResponse, ExportResult } from "@/lib/types/export";
import type { BidTaskDBItem } from "@/lib/types/bid_task";
import type { SectionItem } from "@/components/ChapterTree";

// ── Projects ──────────────────────────────────────────────────

export function mockProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-001",
    name: "凤凰城二期外立面工程投标",
    tender_org: "凤凰城房地产开发有限公司",
    industry: "建筑工程",
    project_type: "施工招标",
    deadline: "2026-06-30T00:00:00Z",
    status: "draft",
    created_at: "2026-05-20T08:00:00Z",
    updated_at: "2026-05-27T10:00:00Z",
    ...overrides,
  };
}

export function mockProjectList(overrides: Partial<Project>[] = []): ProjectListResponse {
  const defaults: Project[] = [
    mockProject({ id: "proj-001", name: "凤凰城二期外立面工程投标", tender_org: "凤凰城房地产", status: "in_review" }),
    mockProject({ id: "proj-002", name: "智慧园区信息化建设", tender_org: "高新园区管委会", status: "draft" }),
    mockProject({ id: "proj-003", name: "政务云平台升级项目", tender_org: "省大数据局", status: "completed" }),
  ];
  const items = overrides.length > 0
    ? overrides.map((o, i) => mockProject({ id: `proj-${String(i + 1).padStart(3, "0")}`, ...o }))
    : defaults;
  return { items, total: items.length, page: 1, page_size: 20 };
}

// ── Requirements ──────────────────────────────────────────────

export function mockRequirements(projectId: string): RequirementDBItem[] {
  return [
    {
      id: "req-001", project_id: projectId, source_document_id: "doc-001",
      requirement_type: "business_requirement", title: "投标保证金 50 万元",
      description: "投标人须在投标截止前缴纳投标保证金 50 万元。",
      priority: "high", is_mandatory: true, risk_level: "blocking",
      source_text: "投标保证金金额为人民币 50 万元整。", status: "active",
      created_at: "2026-05-27T08:00:00Z", updated_at: "2026-05-27T08:00:00Z",
    },
    {
      id: "req-002", project_id: projectId, source_document_id: "doc-001",
      requirement_type: "qualification_requirement", title: "建筑幕墙工程专业承包一级资质",
      description: "投标人须具备建筑幕墙工程专业承包一级及以上资质。",
      priority: "high", is_mandatory: true, risk_level: "blocking",
      source_text: "投标人资质要求：建筑幕墙工程专业承包一级。", status: "active",
      created_at: "2026-05-27T08:00:00Z", updated_at: "2026-05-27T08:00:00Z",
    },
    {
      id: "req-003", project_id: projectId, source_document_id: "doc-001",
      requirement_type: "technical_requirement", title: "铝合金型材壁厚 ≥ 2.0mm",
      description: "外立面铝合金型材主受力杆件壁厚不小于 2.0mm。",
      priority: "medium", is_mandatory: true, risk_level: "high",
      source_text: "铝合金型材主受力杆件壁厚应符合 GB/T 5237 标准，且不小于 2.0mm。", status: "active",
      created_at: "2026-05-27T08:00:00Z", updated_at: "2026-05-27T08:00:00Z",
    },
    {
      id: "req-004", project_id: projectId, source_document_id: "doc-001",
      requirement_type: "scoring_criteria", title: "近三年同类业绩每项得 2 分",
      description: "投标人近三年完成的同类幕墙工程业绩，每提供一项得 2 分，满分 10 分。",
      priority: "medium", is_mandatory: false, risk_level: "medium",
      source_text: "同类业绩评分：近三年每完成一项类似工程得 2 分。", status: "active",
      created_at: "2026-05-27T08:00:00Z", updated_at: "2026-05-27T08:00:00Z",
    },
    {
      id: "req-005", project_id: projectId, source_document_id: "doc-001",
      requirement_type: "disqualification_item", title: "未按要求密封和标记",
      description: "投标文件未按招标文件要求密封和标记的，将被拒绝接收。",
      priority: "high", is_mandatory: true, risk_level: "blocking",
      source_text: "投标文件的密封与标记须严格按照本须知第 4.2 条执行。", status: "active",
      created_at: "2026-05-27T08:00:00Z", updated_at: "2026-05-27T08:00:00Z",
    },
  ];
}

// ── Files ─────────────────────────────────────────────────────

export function mockFiles(_projectId: string): ProjectFileItem[] {
  return [
    {
      id: "file-001", name: "投标模板.docx", document_type: "bid_template",
      file_size: 102400, mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      status: "uploaded", created_at: "2026-05-27T08:30:00Z",
    },
    {
      id: "file-002", name: "【邀标文件】凤凰城二期商业(A、B楼)外立面(1).pdf",
      document_type: "tender_doc", file_size: 1527626, mime_type: "application/pdf",
      status: "uploaded", created_at: "2026-05-27T08:30:00Z",
    },
    {
      id: "file-003", name: "公司资质文件.pdf", document_type: "company_material",
      file_size: 512000, mime_type: "application/pdf",
      status: "uploaded", created_at: "2026-05-27T08:35:00Z",
    },
  ];
}

// ── Sections (ChapterTree) ────────────────────────────────────

export function mockSections(): SectionItem[] {
  return [
    { id: "sec-1", section_id: "s1", title: "商务标", level: 1, section_path: "商务标", parent_section_id: null },
    { id: "sec-2", section_id: "s1-1", title: "投标函", level: 2, section_path: "商务标/投标函", parent_section_id: "s1" },
    { id: "sec-3", section_id: "s1-2", title: "法定代表人身份证明", level: 2, section_path: "商务标/法定代表人身份证明", parent_section_id: "s1" },
    { id: "sec-4", section_id: "s1-3", title: "公司资质", level: 2, section_path: "商务标/公司资质", parent_section_id: "s1" },
    { id: "sec-5", section_id: "s2", title: "技术标", level: 1, section_path: "技术标", parent_section_id: null },
    { id: "sec-6", section_id: "s2-1", title: "项目理解", level: 2, section_path: "技术标/项目理解", parent_section_id: "s2" },
    { id: "sec-7", section_id: "s2-2", title: "技术方案", level: 2, section_path: "技术标/技术方案", parent_section_id: "s2" },
    { id: "sec-8", section_id: "s2-3", title: "施工组织设计", level: 2, section_path: "技术标/施工组织设计", parent_section_id: "s2" },
  ];
}

// ── AI Revisions ──────────────────────────────────────────────

export function mockAIRevisions(): AIRevision[] {
  return [
    {
      id: "rev-001", document_id: "file-001", node_id: "n1", template_slot_id: "slot-1",
      revision_type: "replace", before_content: "【请在此填写公司简介】",
      ai_content: "我司成立于 2005 年，注册资本 5000 万元，具有建筑幕墙工程专业承包一级资质……",
      comment: "基于公司资料生成公司简介，请核实具体年份和资质编号。",
      source_requirement_ids: ["req-002"], related_experience_ids: [],
      risk_level: "medium", confidence: 0.85, status: "pending",
      metadata: {}, created_at: "2026-05-27T10:00:00Z", updated_at: "2026-05-27T10:00:00Z",
    },
    {
      id: "rev-002", document_id: "file-001", node_id: "n2", template_slot_id: "slot-2",
      revision_type: "append", before_content: null,
      ai_content: "2 小时响应，24 小时内到达现场，一般故障 4 小时内修复……",
      comment: "根据公司服务标准和招标要求生成售后服务承诺。",
      source_requirement_ids: ["req-003"], related_experience_ids: [],
      risk_level: "low", confidence: 0.92, status: "pending",
      metadata: {}, created_at: "2026-05-27T10:01:00Z", updated_at: "2026-05-27T10:01:00Z",
    },
  ];
}

// ── Preview Data ──────────────────────────────────────────────

export function mockPreviewData() {
  return {
    document_id: "file-001",
    document_name: "投标模板.docx",
    html: `<div class="mammoth-preview">
<h2>第一章 商务标</h2>
<h3>1.1 公司简介</h3>
<p><span class="ai-revision-wrapper" data-revision-id="rev-001" style="background-color: #fff3cd; cursor: pointer;">我司成立于 2005 年，注册资本 5000 万元，具有建筑幕墙工程专业承包一级资质……</span></p>
<h3>1.2 售后服务承诺</h3>
<p><span class="ai-revision-wrapper" data-revision-id="rev-002" style="background-color: #d4edda; cursor: pointer;">2 小时响应，24 小时内到达现场，一般故障 4 小时内修复……</span></p>
<h2>第二章 技术标</h2>
<p>技术方案内容待补充……</p>
</div>`,
    sections: mockSections(),
    ai_revisions: mockAIRevisions(),
    unfinished_items: mockUnfinishedItems(),
    warnings: [],
  };
}

// ── Unfinished Items ──────────────────────────────────────────

export function mockUnfinishedItems(): UnfinishedItem[] {
  return [
    {
      id: "unf-001", document_id: "file-001", template_slot_id: "slot-3",
      node_id: "n3", item_type: "missing_material",
      section_path: "技术标/施工组织设计", reason: "缺少施工进度计划资料",
      impact: "可能导致技术方案不完整", risk_level: "high",
      suggested_action: "请上传施工进度计划或甘特图", status: "open",
      created_at: "2026-05-27T10:00:00Z", updated_at: "2026-05-27T10:00:00Z",
    },
    {
      id: "unf-002", document_id: "file-001", template_slot_id: "slot-4",
      node_id: "n4", item_type: "missing_qualification",
      section_path: "商务标/公司资质", reason: "未找到安全生产许可证扫描件",
      impact: "废标风险 —— 缺少必要资质证明", risk_level: "blocking",
      suggested_action: "请上传有效期内的安全生产许可证", status: "open",
      created_at: "2026-05-27T10:00:00Z", updated_at: "2026-05-27T10:00:00Z",
    },
  ];
}

// ── Review ────────────────────────────────────────────────────

export function mockReviewResult(projectId: string): ReviewCheckResult {
  return {
    project_id: projectId,
    status: "completed",
    error: "",
    total_requirements: 5,
    pass_count: 3,
    fail_count: 1,
    warning_count: 1,
    coverage_rate: 0.6,
    has_blocking_issues: true,
    items: [
      {
        requirement_id: "req-001", requirement_type: "business_requirement",
        title: "投标保证金 50 万元", description: "投标保证金要求",
        is_mandatory: true, risk_level: "blocking", status: "WARNING",
        message: "已生成相关内容但未确认", suggested_action: "请确认保证金承诺函内容",
        matched_revision_ids: [],
      },
      {
        requirement_id: "req-002", requirement_type: "qualification_requirement",
        title: "建筑幕墙工程专业承包一级资质", description: "资质要求",
        is_mandatory: true, risk_level: "blocking", status: "PASS",
        message: "已在资质章节中响应", suggested_action: "",
        matched_revision_ids: ["rev-001"],
      },
      {
        requirement_id: "req-003", requirement_type: "technical_requirement",
        title: "铝合金型材壁厚 ≥ 2.0mm", description: "型材壁厚要求",
        is_mandatory: true, risk_level: "high", status: "PASS",
        message: "已响应", suggested_action: "",
        matched_revision_ids: ["rev-002"],
      },
      {
        requirement_id: "req-004", requirement_type: "scoring_criteria",
        title: "近三年同类业绩每项得 2 分", description: "同类业绩要求",
        is_mandatory: false, risk_level: "medium", status: "FAIL",
        message: "未在标书中覆盖同类业绩内容", suggested_action: "补充近三年同类幕墙工程业绩案例",
        matched_revision_ids: [],
      },
      {
        requirement_id: "req-005", requirement_type: "disqualification_item",
        title: "未按要求密封和标记", description: "封装和标记要求",
        is_mandatory: true, risk_level: "blocking", status: "PASS",
        message: "格式要求已覆盖", suggested_action: "",
        matched_revision_ids: [],
      },
    ],
  };
}

// ── Export ────────────────────────────────────────────────────

export function mockExportHistory(): ExportRecordResponse[] {
  return [
    {
      id: "exp-001", project_id: "proj-001", document_id: "file-001",
      exported_by: "user-001", file_path: "/exports/proj-001_v1.docx",
      file_size: 204800, revision_count: 2, status: "success",
      created_at: "2026-05-27T14:00:00Z",
    },
  ];
}

export function mockExportResult(): ExportResult {
  return {
    project_id: "proj-001",
    document_id: "file-001",
    status: "success",
    error: "",
    export_record_id: "exp-002",
    file_path: "/exports/proj-001_v2.docx",
    file_size: 210000,
    revision_count: 2,
    download_url: "/api/projects/proj-001/export/download",
    blocked_by: [],
  };
}

export function mockExportResultBlocked(): ExportResult {
  return {
    project_id: "proj-001",
    document_id: "file-001",
    status: "blocked",
    error: "存在未响应的强制要求",
    export_record_id: "",
    file_path: "",
    file_size: 0,
    revision_count: 0,
    download_url: "",
    blocked_by: ["req-004"],
  };
}

// ── Tasks (Kanban) ────────────────────────────────────────────

export function mockBidTasks(projectId: string): BidTaskDBItem[] {
  return [
    {
      id: "task-001", project_id: projectId, title: "编写技术方案",
      task_type: "技术标", related_requirement_ids: ["req-003"],
      assignee_type: "ai_then_human", priority: "high", status: "in_progress",
      section_path: "技术标/技术方案", assignee: null,
      created_at: "2026-05-27T09:00:00Z", updated_at: "2026-05-27T09:00:00Z",
    },
    {
      id: "task-002", project_id: projectId, title: "准备资质文件",
      task_type: "资质材料", related_requirement_ids: ["req-002"],
      assignee_type: "human_required", priority: "high", status: "pending",
      section_path: "商务标/公司资质", assignee: "张三",
      created_at: "2026-05-27T09:00:00Z", updated_at: "2026-05-27T09:00:00Z",
    },
    {
      id: "task-003", project_id: projectId, title: "编制商务报价",
      task_type: "报价", related_requirement_ids: ["req-001"],
      assignee_type: "human", priority: "medium", status: "completed",
      section_path: "商务标/报价单", assignee: "李四",
      created_at: "2026-05-27T09:00:00Z", updated_at: "2026-05-27T12:00:00Z",
    },
  ];
}

// ── Dashboard ─────────────────────────────────────────────────

export function mockDashboardStats() {
  return {
    activeProjects: 3,
    pendingTasks: 2,
    completedBids: 1,
  };
}

// ── Workbench ─────────────────────────────────────────────────

export function mockConfirmAndGenerateResult() {
  return {
    document_id: "file-001",
    message: "AI 修订生成流程已触发，共生成 2 条修订建议、2 项未完成项",
  };
}
