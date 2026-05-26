/** 单个文件上传结果 */
export interface FileUploadItem {
  filename: string;
  document_id: string | null;
  file_size: number;
  document_type: string;
  status: string; // 'success' | 'failed'
  error: string | null;
}

/** 多文件上传响应 */
export interface FilesUploadResponse {
  project_id: string;
  results: FileUploadItem[];
  success_count: number;
  failed_count: number;
}

/** 项目文件列表项 */
export interface ProjectFileItem {
  id: string;
  name: string;
  document_type: string;
  file_size: number;
  mime_type: string | null;
  status: string;
  created_at: string;
}

/** 项目文件列表响应 */
export interface ProjectFilesResponse {
  project_id: string;
  files: ProjectFileItem[];
}

/** 文件类型中文标签映射 */
export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  bid_template: "投标模板",
  tender_doc: "招标文件",
  company_material: "公司资料",
};

/** 文件类型颜色映射 */
export const DOCUMENT_TYPE_COLORS: Record<string, string> = {
  bid_template: "blue",
  tender_doc: "green",
  company_material: "orange",
};
