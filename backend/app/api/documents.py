"""文档 API — 文件上传、解包、解析和查询端点。"""

from fastapi import APIRouter, UploadFile, File

from app.services.document_service import process_docx_upload, parse_and_store_document, detect_and_store_sections
from app.services.template_slot_service import generate_template_slots
from app.services.llm_classifier_service import classify_template_slots
from app.services.unfinished_item_service import generate_unfinished_items
from app.models.document import DocumentResponse, UploadError
from app.models.document_node import ParseResult
from app.models.section import SectionDetectionResult
from app.models.template_slot import SlotGenerationResult
from app.models.unfinished_item import UnfinishedItemGenerationResult
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


@documents_router.post("/{doc_id}/detect-sections", response_model=SectionDetectionResult)
async def detect_document_sections(doc_id: str):
    """识别文档的章节结构与标题层级，回写 section_id 到各节点。"""
    return await detect_and_store_sections(doc_id)


@documents_router.get("/{doc_id}/sections")
async def get_document_sections(doc_id: str):
    """查询指定文档的章节结构树。"""
    gw = SupabaseGateway()
    return gw.get_section_contents(doc_id)


@documents_router.post("/{doc_id}/generate-slots", response_model=SlotGenerationResult)
async def generate_document_slots(doc_id: str):
    """为文档生成 TemplateSlot 可填充位置，识别占位符、空段落、表格单元格等。"""
    return await generate_template_slots(doc_id)


@documents_router.get("/{doc_id}/slots")
async def get_document_slots(doc_id: str):
    """查询指定文档的所有 TemplateSlot 记录。"""
    gw = SupabaseGateway()
    return gw.get_template_slots(doc_id)


@documents_router.post("/{doc_id}/classify-slots")
async def classify_document_slots(doc_id: str):
    """对文档的 heading_section 和 table_cell 类型 slot 进行 LLM 语义分类，
    分类结果回写到 expected_content_type，LLM 失败时降级为关键词规则匹配。"""
    return await classify_template_slots(doc_id)


@documents_router.post("/{doc_id}/generate-unfinished", response_model=UnfinishedItemGenerationResult)
async def generate_document_unfinished(doc_id: str):
    """扫描文档中的低置信度 slot、嵌套表格等无法安全处理的位置，生成 UnfinishedItem 记录。"""
    return await generate_unfinished_items(doc_id)


@documents_router.get("/{doc_id}/unfinished")
async def get_document_unfinished(doc_id: str):
    """查询指定文档的所有 UnfinishedItem 记录，按 risk_level 降序排列。"""
    gw = SupabaseGateway()
    return gw.get_unfinished_items(doc_id)
