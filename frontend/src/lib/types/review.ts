/** 响应性检查结果类型和常量 */

export interface ReviewCheckItem {
  requirement_id: string;
  requirement_type: string;
  title: string;
  description: string;
  is_mandatory: boolean;
  risk_level: string;
  status: "PASS" | "FAIL" | "WARNING";
  message: string;
  suggested_action: string;
  matched_revision_ids: string[];
}

export interface ReviewCheckResult {
  project_id: string;
  status: string;
  error: string;
  total_requirements: number;
  pass_count: number;
  fail_count: number;
  warning_count: number;
  coverage_rate: number;
  has_blocking_issues: boolean;
  items: ReviewCheckItem[];
}

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  PASS: "已覆盖",
  FAIL: "无响应",
  WARNING: "待确认",
};

export const REVIEW_STATUS_COLORS: Record<string, string> = {
  PASS: "green",
  FAIL: "red",
  WARNING: "orange",
};

export const REVIEW_STATUS_ICONS: Record<string, string> = {
  PASS: "✅",
  FAIL: "❌",
  WARNING: "⚠️",
};
