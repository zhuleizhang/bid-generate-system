-- 智能标书系统：初始数据库 Schema
-- 覆盖 E0/E1/E2 全部 18 张核心表

-- 启用 pgvector 扩展（向量检索）
-- 注意：如果报 "pgvector is not available" 错误，需先在 Supabase Dashboard 中手动启用：
--   Database → Extensions → 搜索 pgvector → Enable
CREATE EXTENSION IF NOT EXISTS vector;

-- 自动更新 updated_at 的触发器函数
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- E0：文档解析与理解引擎
-- ============================================================

-- 文档表：用户上传的所有文档（投标模板、招标文件、公司资料）
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('bid_template', 'tender_doc', 'company_material')),
  file_path TEXT,
  file_size BIGINT,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_documents_project_id ON documents(project_id);

-- 文档节点树：DOCX 解析后的结构化元素（段落、表格、单元格等）
CREATE TABLE document_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  parent_node_id UUID REFERENCES document_nodes(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL CHECK (node_type IN ('paragraph', 'table', 'row', 'cell', 'header', 'footer', 'sdt')),
  text TEXT,
  location_path TEXT,
  style_json JSONB DEFAULT '{}',
  section_id TEXT,
  row_index INTEGER,
  col_index INTEGER,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_document_nodes_document_id ON document_nodes(document_id);
CREATE INDEX idx_document_nodes_parent_node_id ON document_nodes(parent_node_id);

-- 模板槽位：模板中可填充的位置
CREATE TABLE template_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES document_nodes(id) ON DELETE CASCADE,
  slot_type TEXT NOT NULL CHECK (slot_type IN ('paragraph', 'table_cell', 'placeholder', 'heading_section', 'section_append')),
  location_path TEXT,
  section_path TEXT,
  expected_content_type TEXT,
  style_id TEXT,
  confidence FLOAT NOT NULL DEFAULT 0.0,
  evidence TEXT,
  fill_strategy TEXT NOT NULL CHECK (fill_strategy IN ('replace', 'append', 'cell_fill', 'section_append')),
  need_human_confirm BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_template_slots_document_id ON template_slots(document_id);
CREATE INDEX idx_template_slots_node_id ON template_slots(node_id);

-- 未完成项：无法自动处理的位置记录
CREATE TABLE unfinished_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  template_slot_id UUID REFERENCES template_slots(id) ON DELETE SET NULL,
  node_id UUID REFERENCES document_nodes(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL,
  section_path TEXT,
  reason TEXT,
  impact TEXT,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('blocking', 'high', 'medium', 'low')),
  suggested_action TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_unfinished_items_document_id ON unfinished_items(document_id);

-- 模型调用日志：记录每次 LLM 调用
CREATE TABLE model_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario TEXT NOT NULL,
  model_name TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost DECIMAL(10, 6),
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  request_json JSONB,
  response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_model_call_logs_scenario ON model_call_logs(scenario);

-- ============================================================
-- E1：项目管理与内容生成
-- ============================================================

-- 项目表：投标项目主容器
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tender_org TEXT,
  industry TEXT CHECK (industry IN ('建筑', 'IT', '制造', '医疗', '教育', '其他')),
  project_type TEXT CHECK (project_type IN ('工程类', '货物类', '服务类')),
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_confirmation', 'in_review', 'review_completed', 'exported', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 为 documents 补上 projects 外键（projects 表现在才创建）
ALTER TABLE documents ADD CONSTRAINT fk_documents_project
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- 招标要求：从招标文件中提取的结构化要求
CREATE TABLE requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  requirement_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  risk_level TEXT NOT NULL DEFAULT 'medium',
  source_text TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_requirements_project_id ON requirements(project_id);

-- 标书任务：按招标要求拆解的任务清单
CREATE TABLE bid_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  task_type TEXT NOT NULL,
  related_requirement_ids JSONB NOT NULL DEFAULT '[]',
  assignee_type TEXT NOT NULL DEFAULT 'ai' CHECK (assignee_type IN ('ai', 'human', 'ai_then_human', 'human_required')),
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  section_path TEXT,
  assignee TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_bid_tasks_project_id ON bid_tasks(project_id);

-- 章节内容：模板章节填充后的内容快照
CREATE TABLE section_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  section_path TEXT,
  section_id TEXT,
  content TEXT,
  node_id UUID REFERENCES document_nodes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_section_contents_document_id ON section_contents(document_id);

-- AI 修订记录：LLM 在模板位置生成的内容
CREATE TABLE ai_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES document_nodes(id) ON DELETE CASCADE,
  template_slot_id UUID REFERENCES template_slots(id) ON DELETE SET NULL,
  revision_type TEXT NOT NULL CHECK (revision_type IN ('replace', 'append', 'new_section')),
  before_content TEXT,
  ai_content TEXT,
  comment TEXT,
  source_requirement_ids JSONB NOT NULL DEFAULT '[]',
  related_experience_ids JSONB NOT NULL DEFAULT '[]',
  risk_level TEXT NOT NULL DEFAULT 'low',
  confidence FLOAT NOT NULL DEFAULT 0.0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'edited_then_accepted', 'need_human_confirm')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ai_revisions_document_id ON ai_revisions(document_id);
CREATE INDEX idx_ai_revisions_template_slot_id ON ai_revisions(template_slot_id);

-- 编辑差异：人工修改 AI 内容的 diff 记录
CREATE TABLE edit_diffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_revision_id UUID NOT NULL REFERENCES ai_revisions(id) ON DELETE CASCADE,
  before_text TEXT,
  after_text TEXT,
  diff_text TEXT,
  edit_type TEXT NOT NULL DEFAULT 'manual_edit',
  edit_reason TEXT,
  section_content_id UUID REFERENCES section_contents(id) ON DELETE SET NULL,
  related_requirement_ids JSONB NOT NULL DEFAULT '[]',
  editor_id TEXT,
  accepted BOOLEAN NOT NULL DEFAULT TRUE,
  used_in_final BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_edit_diffs_ai_revision_id ON edit_diffs(ai_revision_id);

-- 操作审计日志
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  user_id TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- 任务运行记录
CREATE TABLE task_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  bid_task_id UUID REFERENCES bid_tasks(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_task_runs_project_id ON task_runs(project_id);

-- 导出记录
CREATE TABLE export_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  exported_by TEXT,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  revision_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_export_records_project_id ON export_records(project_id);

-- 文档版本：解析结果、导出文件等版本快照
CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_type TEXT NOT NULL CHECK (version_type IN ('parsed', 'export', 'original')),
  content TEXT,
  file_path TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_document_versions_document_id ON document_versions(document_id);

-- ============================================================
-- E2：知识库与经验沉淀
-- ============================================================

-- 文档切片：知识库中最小的检索单元
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_type TEXT NOT NULL CHECK (chunk_type IN ('text', 'table', 'case', 'qualification', 'experience')),
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  embedding extensions.vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_document_chunks_source ON document_chunks(source_document_id);

-- 经验库：从人工修改中沉淀的可复用经验
CREATE TABLE experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_type TEXT NOT NULL,
  title TEXT,
  content TEXT,
  applicable_industry TEXT,
  applicable_section_type TEXT,
  applicable_customer_type TEXT,
  source_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  source_diff_id UUID REFERENCES edit_diffs(id) ON DELETE SET NULL,
  is_latest BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_experiences_source_project ON experiences(source_project_id);

-- 引用记录：AI 生成内容引用知识库来源的追溯
CREATE TABLE citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_revision_id UUID NOT NULL REFERENCES ai_revisions(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
  source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  relevance_score FLOAT NOT NULL DEFAULT 0.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_citations_ai_revision_id ON citations(ai_revision_id);

-- ============================================================
-- 为所有含 updated_at 的表挂载自动更新触发器
-- ============================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at'
      AND table_schema = 'public'
      AND table_name != 'model_call_logs'  -- model_call_logs 也可以触发
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
      tbl
    );
  END LOOP;
END $$;
