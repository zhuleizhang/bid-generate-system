"""文档节点相关的 Pydantic 模型。"""

from typing import Any

from pydantic import BaseModel


class DocumentNodeCreate(BaseModel):
    """创建文档节点时的输入模型。"""

    node_type: str
    text: str | None = None
    location_path: str | None = None
    style_json: dict[str, Any] = {}
    parent_node_id: str | None = None
    row_index: int | None = None
    col_index: int | None = None
    order_index: int = 0


class DocumentNodeResponse(BaseModel):
    """文档节点查询响应。"""

    id: str
    document_id: str
    parent_node_id: str | None
    node_type: str
    text: str | None
    location_path: str | None
    style_json: dict[str, Any]
    section_id: str | None
    row_index: int | None
    col_index: int | None
    order_index: int
    created_at: str
    updated_at: str


class ParseResult(BaseModel):
    """文档解析结果。"""

    document_id: str
    nodes: list[DocumentNodeResponse]
    node_count: int
