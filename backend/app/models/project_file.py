"""项目文件上传相关的 Pydantic 模型。"""

from pydantic import BaseModel


class FileUploadItem(BaseModel):
    """单个文件上传结果。"""
    filename: str
    document_id: str | None = None
    file_size: int
    document_type: str
    status: str  # 'success' | 'failed'
    error: str | None = None


class FilesUploadResponse(BaseModel):
    """多文件上传响应。"""
    project_id: str
    results: list[FileUploadItem]
    success_count: int
    failed_count: int
