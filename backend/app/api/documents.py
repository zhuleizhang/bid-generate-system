"""文档 API — 文件上传、解包、解析和查询端点。"""

from fastapi import APIRouter, UploadFile, File

from app.services.document_service import process_docx_upload, parse_and_store_document
from app.models.document import DocumentResponse, UploadError
from app.models.document_node import ParseResult
from app.gateway.supabase_gateway import SupabaseGateway

documents_router = APIRouter(prefix="/documents", tags=["documents"])


@documents_router.post("/upload", response_model=DocumentResponse)
async def upload_docx(file: UploadFile = File(...)):
    """上传 DOCX 投标模板，自动解包并存储 XML 部件。"""
    return await process_docx_upload(file)


@documents_router.post("/{doc_id}/parse", response_model=ParseResult)
async def parse_document(doc_id: str):
    """解析已上传的文档，构建 DocumentNode 结构树并写入数据库。"""
    return await parse_and_store_document(doc_id)


@documents_router.get("/{doc_id}/nodes")
async def get_document_nodes(doc_id: str):
    """查询指定文档的所有解析节点，按 order_index 排序。"""
    gw = SupabaseGateway()
    return gw.get_document_nodes(doc_id)
