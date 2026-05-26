"""文档 API — 文件上传、解包和查询端点。"""

from fastapi import APIRouter, UploadFile, File

from app.services.document_service import process_docx_upload
from app.models.document import DocumentResponse, UploadError

documents_router = APIRouter(prefix="/documents", tags=["documents"])


@documents_router.post("/upload", response_model=DocumentResponse)
async def upload_docx(file: UploadFile = File(...)):
    """上传 DOCX 投标模板，自动解包并存储 XML 部件。"""
    return await process_docx_upload(file)
