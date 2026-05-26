"""文档相关的 Pydantic 模型。"""

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    """文档上传成功后的响应。"""
    id: str
    name: str
    document_type: str
    file_path: str
    file_size: int
    mime_type: str
    status: str
    xml_parts: dict[str, str]  # 解包后的 XML 部件名 → 内容


class UploadError(BaseModel):
    """上传或解包失败时的错误响应。"""
    error: str
    detail: str
