"""文档 API — 文件上传、解包、解析、回写和下载端点。"""

import io
import json

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response
from lxml import html as lxml_html
import mammoth

from app.services.document_service import process_docx_upload, parse_and_store_document, detect_and_store_sections
from app.services.template_slot_service import generate_template_slots
from app.services.llm_classifier_service import classify_template_slots
from app.services.unfinished_item_service import generate_unfinished_items
from app.services.docx_writer import apply_writeback
from app.services.tender_parser import parse_tender_document
from app.models.document import DocumentResponse, UploadError
from app.models.document_node import ParseResult
from app.models.section import SectionDetectionResult
from app.models.template_slot import SlotGenerationResult
from app.models.unfinished_item import UnfinishedItemGenerationResult
from app.models.writeback import WriteBackOperation, WriteBackResult
from app.services.requirement_extraction_service import extract_requirements_from_document
from app.services.ai_revision_service import generate_ai_revisions
from app.models.tender_parse import TenderParseResponse
from app.models.requirement import RequirementExtractionResult
from app.models.ai_revision import AIRevisionGenerationResult
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


@documents_router.post("/{doc_id}/writeback", response_model=WriteBackResult)
async def writeback_document(doc_id: str, operations: list[WriteBackOperation]):
    """对文档应用回写操作（replace、append、cell_fill），包含备份和验证。

    回写前自动复制原始模板到 Supabase Storage 作为备份，
    回写后重新解包文件验证 document.xml 结构完整性。
    """
    return await apply_writeback(doc_id, operations)


@documents_router.get("/{doc_id}/download")
async def download_document(doc_id: str):
    """下载回写后的 .docx 文件。"""
    gw = SupabaseGateway()
    doc = gw.get_document(doc_id)
    if not doc:
        return Response(status_code=404, content="文档不存在")

    file_path = doc.get("file_path", "")
    if not file_path:
        return Response(status_code=404, content="文档缺少 file_path")

    try:
        file_bytes = gw.download_file_by_url(file_path)
    except Exception:
        return Response(status_code=500, content="文件下载失败")

    filename = doc.get("name", f"{doc_id}.docx")
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@documents_router.post("/{doc_id}/parse-tender", response_model=TenderParseResponse)
async def parse_tender_document_endpoint(doc_id: str):
    """解析招标文件（PDF 或 Word），提取结构化文本和表格。

    PDF 使用 pdfplumber 提取文本和表格，pypdf 为降级方案；
    Word 使用 python-docx 提取段落和表格。
    解析结果存储到 document_versions 表（version_type = 'parsed'）。
    """
    try:
        result = await parse_tender_document(doc_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"解析失败: {str(e)}")

    return TenderParseResponse(**result)


@documents_router.get("/{doc_id}/parsed-content")
async def get_parsed_content(doc_id: str):
    """查询指定文档的招标解析结果（最新一条 parsed 类型的版本记录）。"""
    gw = SupabaseGateway()

    doc = gw.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    versions = gw.get_document_versions(doc_id)
    parsed_versions = [v for v in versions if v.get("version_type") == "parsed"]
    if not parsed_versions:
        return {"document_id": doc_id, "status": "not_parsed", "content": None}

    latest = parsed_versions[0]
    content_raw = latest.get("content", "{}")
    content = json.loads(content_raw) if isinstance(content_raw, str) else content_raw

    return {
        "document_id": doc_id,
        "status": "parsed",
        "version_id": latest.get("id"),
        "file_type": latest.get("metadata", {}).get("file_type", ""),
        "sections": content.get("sections", []),
        "tables": content.get("tables", []),
        "full_text": content.get("full_text", ""),
    }


@documents_router.post("/{doc_id}/extract-requirements", response_model=RequirementExtractionResult)
async def extract_document_requirements(doc_id: str):
    """从已解析的招标文件中提取结构化要求。

    调用 LLM 分析文档全文，提取项目基本信息、商务/技术要求、
    评分标准、废标项、资质要求、交付要求和格式要求。
    提取结果写入 requirements 表，LLM 调用记录到 model_call_logs。
    前提：文档需先调用 /parse-tender 完成解析。
    """
    try:
        result = await extract_requirements_from_document(doc_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"要求提取失败: {str(e)}")

    return RequirementExtractionResult(**result)


@documents_router.post("/{doc_id}/ai-revisions/generate", response_model=AIRevisionGenerationResult)
async def generate_document_ai_revisions(doc_id: str):
    """为文档的全部 TemplateSlot 调用 LLM 生成 AIRevision 填充内容。

    根据每个 slot 的 expected_content_type 和 section_path 匹配
    项目招标要求，构建 LLM prompt 生成合适的标书内容。
    涉及资质/报价/案例/承诺的内容自动标记高风险和待确认状态。
    无法生成的位置自动创建 UnfinishedItem。
    前提：文档需已完成 parse → generate-slots → classify-slots。
    """
    try:
        result = await generate_ai_revisions(doc_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AIRevision 生成失败: {str(e)}")

    return AIRevisionGenerationResult(**result)


@documents_router.get("/{doc_id}/preview")
async def preview_document(doc_id: str):
    """将 DOCX 转为 HTML 预览，同时返回章节结构。

    从 Supabase Storage 下载原始 DOCX 文件，使用 mammoth 转换为 HTML，
    保留标题层级、加粗、列表和表格等基本格式。同时返回文档的章节树数据。
    """
    gw = SupabaseGateway()

    doc = gw.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    # 仅 DOCX 文件支持预览
    mime_type = doc.get("mime_type", "")
    if "officedocument" not in mime_type and "openxmlformats" not in mime_type:
        raise HTTPException(status_code=400, detail="仅支持 DOCX 文件预览")

    file_path = doc.get("file_path", "")
    if not file_path:
        raise HTTPException(status_code=400, detail="文档缺少 file_path")

    try:
        file_bytes = gw.download_file_by_url(file_path)
    except Exception:
        raise HTTPException(status_code=500, detail="文件下载失败")

    # mammoth 转换
    try:
        result = mammoth.convert_to_html(io.BytesIO(file_bytes))
    except Exception:
        raise HTTPException(status_code=500, detail="DOCX 转 HTML 失败")

    html_content = result.value
    messages = [str(m) for m in result.messages] if result.messages else []

    # 获取章节结构
    sections = gw.get_section_contents(doc_id)

    # 在 HTML 中为各章节标题注入锚点 ID，供前端导航滚动定位
    if sections:
        try:
            tree = lxml_html.fromstring(html_content)
            title_to_section: dict[str, str] = {}
            for s in sections:
                key = s["title"].strip()
                if key:
                    title_to_section[key] = s["section_id"]

            for h_tag in tree.iter("h1", "h2", "h3", "h4", "h5", "h6"):
                text = (h_tag.text_content() or "").strip()
                if text in title_to_section:
                    h_tag.set("id", f"sec-{title_to_section[text]}")

            html_content = lxml_html.tostring(tree, encoding="unicode", method="html")
        except Exception:
            pass  # 锚点注入失败不阻塞预览

    return {
        "document_id": doc_id,
        "document_name": doc.get("name", ""),
        "html": html_content,
        "sections": sections,
        "warnings": messages,
    }


@documents_router.get("/{doc_id}/ai-revisions")
async def list_document_ai_revisions(doc_id: str):
    """查询指定文档的所有 AIRevision 记录。"""
    gw = SupabaseGateway()

    doc = gw.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    return gw.get_ai_revisions(doc_id)
