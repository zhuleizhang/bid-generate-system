/** 标书任务相关类型和常量 */

export interface BidTaskDBItem {
  id: string;
  project_id: string;
  title: string;
  task_type: string;
  related_requirement_ids: string[];
  assignee_type: string;
  priority: string;
  status: string;
  section_path: string;
  assignee: string | null;
  created_at: string;
  updated_at: string;
}

export const TASK_TYPE_LABELS: Record<string, string> = {
  "商务标": "商务标",
  "技术标": "技术标",
  "报价": "报价",
  "资质材料": "资质材料",
  "项目案例": "项目案例",
  "人员材料": "人员材料",
  "售后服务": "售后服务",
  "偏离表": "偏离表",
  "响应表": "响应表",
  "格式检查": "格式检查",
};

export const TASK_TYPE_COLORS: Record<string, string> = {
  "商务标": "blue",
  "技术标": "green",
  "报价": "red",
  "资质材料": "purple",
  "项目案例": "cyan",
  "人员材料": "orange",
  "售后服务": "lime",
  "偏离表": "gold",
  "响应表": "magenta",
  "格式检查": "default",
};

export const TASK_TYPE_OPTIONS = Object.keys(TASK_TYPE_LABELS).map((key) => ({
  value: key,
  label: TASK_TYPE_LABELS[key],
}));

export const ASSIGNEE_TYPE_LABELS: Record<string, string> = {
  ai: "AI",
  human: "人工",
  ai_then_human: "AI→人工",
  human_required: "人工必须",
};

export const ASSIGNEE_TYPE_COLORS: Record<string, string> = {
  ai: "blue",
  human: "default",
  ai_then_human: "purple",
  human_required: "red",
};

export const ASSIGNEE_TYPE_OPTIONS = Object.keys(ASSIGNEE_TYPE_LABELS).map(
  (key) => ({
    value: key,
    label: ASSIGNEE_TYPE_LABELS[key],
  })
);

export const STATUS_LABELS: Record<string, string> = {
  pending: "待处理",
  in_progress: "进行中",
  completed: "已完成",
};

export const STATUS_COLORS: Record<string, string> = {
  pending: "default",
  in_progress: "processing",
  completed: "success",
};

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

export const PRIORITY_OPTIONS = Object.keys(PRIORITY_LABELS).map((key) => ({
  value: key,
  label: PRIORITY_LABELS[key],
}));

export const KANBAN_COLUMNS = [
  { key: "pending", title: "待处理" },
  { key: "in_progress", title: "进行中" },
  { key: "completed", title: "已完成" },
] as const;
