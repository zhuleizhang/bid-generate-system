/** 招标要求相关类型和常量 */

export interface RequirementDBItem {
  id: string;
  project_id: string;
  source_document_id: string | null;
  requirement_type: string;
  title: string;
  description: string;
  priority: string;
  is_mandatory: boolean;
  risk_level: string;
  source_text: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface RequirementCreate {
  requirement_type: string;
  title: string;
  description: string;
  priority: string;
  is_mandatory: boolean;
  risk_level: string;
  source_text: string;
}

export interface RequirementUpdate {
  requirement_type?: string;
  title?: string;
  description?: string;
  priority?: string;
  is_mandatory?: boolean;
  risk_level?: string;
  source_text?: string;
}

export const REQUIREMENT_TYPE_LABELS: Record<string, string> = {
  project_basic_info: "基本信息",
  business_requirement: "商务要求",
  technical_requirement: "技术要求",
  scoring_criteria: "评分标准",
  disqualification_item: "废标项",
  qualification_requirement: "资质要求",
  delivery_requirement: "交付要求",
  format_requirement: "格式要求",
};

/** 按分组展示顺序排列 */
export const REQUIREMENT_TYPE_ORDER = [
  "project_basic_info",
  "business_requirement",
  "technical_requirement",
  "scoring_criteria",
  "disqualification_item",
  "qualification_requirement",
  "delivery_requirement",
  "format_requirement",
];

export const PRIORITY_LABELS: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export const PRIORITY_COLORS: Record<string, string> = {
  high: "red",
  medium: "orange",
  low: "default",
};

export const RISK_LEVEL_LABELS: Record<string, string> = {
  blocking: "废标",
  high: "高",
  medium: "中",
  low: "低",
};

export const RISK_LEVEL_COLORS: Record<string, string> = {
  blocking: "red",
  high: "orange",
  medium: "gold",
  low: "green",
};

export const REQUIREMENT_TYPE_OPTIONS = REQUIREMENT_TYPE_ORDER.map((key) => ({
  value: key,
  label: REQUIREMENT_TYPE_LABELS[key],
}));
