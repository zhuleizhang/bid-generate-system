"""DOCX 导出记录相关的 Pydantic 模型。"""

from pydantic import BaseModel


class ExportResult(BaseModel):
    """DOCX 导出操作结果。"""

    project_id: str
    document_id: str
    status: str  # success / blocked / failed
    error: str = ""
    export_record_id: str = ""
    file_path: str = ""
    file_size: int = 0
    revision_count: int = 0
    download_url: str = ""
    blocked_by: list[str] = []  # blocking UnfinishedItem 的原因列表


class ExportRecordResponse(BaseModel):
    """ExportRecord 查询响应。"""

    id: str
    project_id: str
    document_id: str
    exported_by: str = ""
    file_path: str
    file_size: int = 0
    revision_count: int = 0
    status: str = "completed"
    created_at: str = ""
