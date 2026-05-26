"""UnfinishedItem 未完成项相关的 Pydantic 模型。"""

from pydantic import BaseModel


class UnfinishedItemResponse(BaseModel):
    """UnfinishedItem 查询/生成响应。"""

    id: str
    document_id: str
    template_slot_id: str | None = None
    node_id: str | None = None
    item_type: str
    section_path: str | None = None
    reason: str | None = None
    impact: str | None = None
    risk_level: str  # blocking / high / medium / low
    suggested_action: str | None = None
    status: str = "open"
    created_at: str = ""
    updated_at: str = ""


class UnfinishedItemGenerationResult(BaseModel):
    """UnfinishedItem 生成结果。"""

    document_id: str
    items: list[UnfinishedItemResponse]
    total_items: int
