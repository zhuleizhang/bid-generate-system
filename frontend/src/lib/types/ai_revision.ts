/** AIRevision 查询/生成响应，映射 ai_revisions 表。 */
export interface AIRevision {
  id: string;
  document_id: string;
  node_id: string;
  template_slot_id: string | null;
  revision_type: "replace" | "append" | "new_section";
  before_content: string | null;
  ai_content: string | null;
  comment: string | null;
  source_requirement_ids: string[];
  related_experience_ids: string[];
  risk_level: "low" | "medium" | "high";
  confidence: number;
  status: "pending" | "accepted" | "rejected" | "edited_then_accepted" | "need_human_confirm";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** 修订类型常量映射 */
export const REVISION_TYPE_LABELS: Record<string, string> = {
  replace: "修改",
  append: "新增",
  new_section: "新章节",
};

export const REVISION_TYPE_COLORS: Record<string, string> = {
  replace: "#faad14",
  append: "#52c41a",
  new_section: "#1890ff",
};

/** 风险等级常量映射 */
export const RISK_LEVEL_LABELS: Record<string, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

export const RISK_LEVEL_COLORS: Record<string, string> = {
  low: "#52c41a",
  medium: "#faad14",
  high: "#ff4d4f",
};

/** 状态常量映射 */
export const STATUS_LABELS: Record<string, string> = {
  pending: "待审阅",
  accepted: "已接受",
  rejected: "已拒绝",
  edited_then_accepted: "已编辑接受",
  need_human_confirm: "待确认",
};

export const STATUS_COLORS: Record<string, string> = {
  pending: "#1677ff",
  accepted: "#52c41a",
  rejected: "#ff4d4f",
  edited_then_accepted: "#722ed1",
  need_human_confirm: "#fa8c16",
};
