/** DOCX 导出相关类型和常量 */

export interface ExportResult {
  project_id: string;
  document_id: string;
  status: string; // success / blocked / failed
  error: string;
  export_record_id: string;
  file_path: string;
  file_size: number;
  revision_count: number;
  download_url: string;
  blocked_by: string[];
}

export interface ExportRecordResponse {
  id: string;
  project_id: string;
  document_id: string;
  exported_by: string;
  file_path: string;
  file_size: number;
  revision_count: number;
  status: string;
  created_at: string;
}

export const EXPORT_STATUS_LABELS: Record<string, string> = {
  success: "导出成功",
  blocked: "已阻断",
  failed: "导出失败",
};

export const EXPORT_STATUS_COLORS: Record<string, string> = {
  success: "green",
  blocked: "red",
  failed: "orange",
};
