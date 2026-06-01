/** TemplateSlot 模板可填充位置 */
export interface TemplateSlot {
  id: string;
  document_id: string;
  node_id: string;
  slot_type: "paragraph" | "table_cell" | "placeholder" | "heading_section" | "section_append";
  location_path: string | null;
  section_path: string | null;
  expected_content_type: string | null;
  style_id: string | null;
  confidence: number;
  evidence: string | null;
  fill_strategy: "replace" | "append" | "cell_fill" | "section_append";
  need_human_confirm: boolean;
  created_at: string;
  updated_at: string;
}

/** 章节结构 */
export interface SectionContent {
  id: string;
  section_id: string;
  title: string;
  level: number;
  parent_section_id: string | null;
  document_id: string;
  created_at: string;
  updated_at: string;
}
