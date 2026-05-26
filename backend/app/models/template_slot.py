"""TemplateSlot 可填充位置相关的 Pydantic 模型。"""

from pydantic import BaseModel


class TemplateSlotResponse(BaseModel):
    """TemplateSlot 查询/生成响应。"""

    id: str
    document_id: str
    node_id: str
    slot_type: str  # paragraph / table_cell / placeholder / heading_section / section_append
    location_path: str | None = None
    section_path: str | None = None
    expected_content_type: str | None = None
    style_id: str | None = None
    confidence: float = 0.0
    evidence: str | None = None
    fill_strategy: str  # replace / append / cell_fill / section_append
    need_human_confirm: bool = False
    created_at: str = ""
    updated_at: str = ""


class SlotGenerationResult(BaseModel):
    """Slot 生成结果。"""

    document_id: str
    slots: list[TemplateSlotResponse]
    total_slots: int
