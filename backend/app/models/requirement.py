"""招标要求模型 — LLM 提取结果与 API 响应。"""

from pydantic import BaseModel


class RequirementItem(BaseModel):
    """单条招标要求。"""

    requirement_type: str
    title: str
    description: str = ""
    priority: str = "medium"  # high / medium / low
    is_mandatory: bool = False
    risk_level: str = "medium"  # blocking / high / medium / low
    source_text: str = ""


class RequirementExtractionResult(BaseModel):
    """招标要求提取结果。"""

    document_id: str
    project_id: str
    status: str  # success / failed
    error: str = ""
    total_requirements: int = 0
    requirements: list[RequirementItem] = []
    llm_model: str = ""
    llm_tokens: int = 0


class RequirementCreate(BaseModel):
    """手动添加招标要求。"""

    requirement_type: str
    title: str
    description: str = ""
    priority: str = "medium"
    is_mandatory: bool = False
    risk_level: str = "medium"
    source_text: str = ""


class RequirementUpdate(BaseModel):
    """人工编辑招标要求的可更新字段。"""

    requirement_type: str | None = None
    title: str | None = None
    description: str | None = None
    priority: str | None = None
    is_mandatory: bool | None = None
    risk_level: str | None = None
    source_text: str | None = None


class RequirementDBItem(BaseModel):
    """包含数据库字段的招标要求完整记录。"""

    id: str
    project_id: str
    source_document_id: str | None = None
    requirement_type: str
    title: str
    description: str
    priority: str
    is_mandatory: bool
    risk_level: str
    source_text: str
    status: str
    created_at: str
    updated_at: str
