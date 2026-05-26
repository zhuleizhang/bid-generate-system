"""AIRevision 模型 — LLM 生成的标书修订内容。"""

from pydantic import BaseModel


class AIRevisionResponse(BaseModel):
    """AIRevision 查询/生成响应，映射 ai_revisions 表全部列。"""

    id: str
    document_id: str
    node_id: str
    template_slot_id: str | None = None
    revision_type: str  # replace / append / new_section
    before_content: str | None = None
    ai_content: str | None = None
    comment: str | None = None
    source_requirement_ids: list[str] = []
    related_experience_ids: list[str] = []
    risk_level: str = "low"
    confidence: float = 0.0
    status: str = "pending"
    metadata: dict = {}
    created_at: str = ""
    updated_at: str = ""


class AIRevisionGenerationResult(BaseModel):
    """AIRevision 批量生成结果。"""

    document_id: str
    project_id: str = ""
    status: str  # success / partial / failed
    error: str = ""
    total_revisions: int = 0
    total_slots: int = 0
    revisions: list[AIRevisionResponse] = []
    unfinished_count: int = 0
    llm_model: str = ""
    llm_tokens: int = 0
