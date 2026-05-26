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
