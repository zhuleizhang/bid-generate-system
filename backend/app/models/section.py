"""章节检测相关的 Pydantic 模型。"""

from pydantic import BaseModel


class SectionNode(BaseModel):
    """章节树节点。"""

    section_id: str
    title: str
    level: int  # 0=文档标题, 1-6=标题层级
    section_path: str  # 如 "技术标/实施方案/进度计划"
    parent_section_id: str | None = None
    start_node_id: str | None = None  # 标题段落的 document_node id
    child_sections: list["SectionNode"] = []
    method: str = "unknown"  # standard_style / font_size_bold / numbering_pattern
    confidence: float = 1.0


class SectionDetectionResult(BaseModel):
    """章节检测结果。"""

    document_id: str
    sections: list[SectionNode]
    total_sections: int
    updated_nodes: int
