"""内容回写相关的 Pydantic 模型。"""

from pydantic import BaseModel


class WriteBackOperation(BaseModel):
    """单条回写操作。"""

    location_path: str
    strategy: str  # replace / append / cell_fill
    new_text: str


class WriteBackResult(BaseModel):
    """回写操作的整体结果。"""

    document_id: str
    backup_path: str
    operations_total: int
    operations_succeeded: int
    operations_failed: int
    validation_passed: bool
    validation_error: str | None = None
    result_path: str
    failed_details: list[dict[str, str]] = []
