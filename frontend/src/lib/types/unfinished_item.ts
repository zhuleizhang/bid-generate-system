/** UnfinishedItem 未完成项，映射 unfinished_items 表。 */
export interface UnfinishedItem {
  id: string;
  document_id: string;
  template_slot_id: string | null;
  node_id: string | null;
  item_type: string;
  section_path: string | null;
  reason: string | null;
  impact: string | null;
  risk_level: "blocking" | "high" | "medium" | "low";
  suggested_action: string | null;
  status: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** 风险等级常量映射 */
export const UNFINISHED_RISK_LABELS: Record<string, string> = {
  blocking: "阻断",
  high: "高风险",
  medium: "中风险",
  low: "低风险",
};

export const UNFINISHED_RISK_COLORS: Record<string, string> = {
  blocking: "#ff4d4f",
  high: "#ff7a45",
  medium: "#faad14",
  low: "#1677ff",
};

/** 状态常量映射 */
export const UNFINISHED_STATUS_LABELS: Record<string, string> = {
  open: "待处理",
  resolved: "已解决",
  ignored: "已忽略",
};

export const UNFINISHED_STATUS_COLORS: Record<string, string> = {
  open: "#1677ff",
  resolved: "#52c41a",
  ignored: "#8c8c8c",
};

/** 类型常量映射 */
export const UNFINISHED_TYPE_LABELS: Record<string, string> = {
  low_confidence: "低置信度",
  nested_table: "嵌套表格",
  unfilled_table_cell: "空表格单元格",
};
