/** 项目列表项 / 详情 */
export interface Project {
  id: string;
  name: string;
  tender_org: string | null;
  industry: string | null;
  project_type: string | null;
  deadline: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

/** 创建项目请求体 */
export interface ProjectCreate {
  name: string;
  tender_org?: string;
  industry?: string;
  project_type?: string;
  deadline?: string;
}

/** 更新项目请求体 */
export interface ProjectUpdate {
  name?: string;
  tender_org?: string;
  industry?: string;
  project_type?: string;
  deadline?: string;
  status?: string;
}

/** 分页列表响应 */
export interface ProjectListResponse {
  items: Project[];
  total: number;
  page: number;
  page_size: number;
}
