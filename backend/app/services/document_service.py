"""文档服务 — DOCX 上传、解包和存储的核心逻辑。"""

import zipfile
from io import BytesIO

from fastapi import UploadFile

from app.gateway.supabase_gateway import SupabaseGateway
from app.models.document import DocumentResponse


# DOCX 中需要提取的关键 XML 部件
DOCX_XML_PARTS = [
    "word/document.xml",
    "word/styles.xml",
    "word/numbering.xml",
]


def _find_header_footer_parts(zip_ref: zipfile.ZipFile) -> list[str]:
    """在 ZIP 内查找所有页眉页脚 XML 部件路径。"""
    parts: list[str] = []
    for name in zip_ref.namelist():
        if "header" in name.lower() or "footer" in name.lower():
            if name.endswith(".xml"):
                parts.append(name)
    return parts


def unpack_docx(file_bytes: bytes) -> tuple[dict[str, str], list[str]]:
    """解包 DOCX 文件，提取关键 XML 部件和页眉页脚。

    Returns:
        (xml_parts, warnings): xml_parts 是部件名→内容映射，warnings 是警告信息列表。
    """
    xml_parts: dict[str, str] = {}
    warnings: list[str] = []

    try:
        with zipfile.ZipFile(BytesIO(file_bytes), "r") as zf:
            # 验证是否为有效 DOCX（必须包含 document.xml）
            if "word/document.xml" not in zf.namelist():
                raise ValueError("不是有效的 DOCX 文件：缺少 word/document.xml")

            for part in DOCX_XML_PARTS:
                try:
                    xml_parts[part] = zf.read(part).decode("utf-8")
                except KeyError:
                    warnings.append(f"可选部件不存在: {part}")
                except UnicodeDecodeError as e:
                    raise ValueError(f"XML 部件编码异常: {part}") from e

            # 提取页眉页脚
            for part in _find_header_footer_parts(zf):
                try:
                    xml_parts[part] = zf.read(part).decode("utf-8")
                except UnicodeDecodeError as e:
                    warnings.append(f"页眉页脚编码异常，已跳过: {part}")

    except zipfile.BadZipFile:
        raise ValueError("文件不是有效的 ZIP/DOCX 格式，文件可能已损坏")
    except Exception as e:
        if isinstance(e, ValueError):
            raise
        raise ValueError(f"DOCX 解包失败: {str(e)}")

    return xml_parts, warnings


async def process_docx_upload(file: UploadFile) -> DocumentResponse:
    """处理 DOCX 上传的完整流程：验证 → 存储 → 解包 → 入库。"""

    # 验证文件类型
    if not file.filename or not file.filename.endswith(".docx"):
        raise ValueError("仅支持 .docx 格式文件")

    content = await file.read()
    if not content:
        raise ValueError("上传文件为空")

    # 解包 DOCX 提取 XML 部件
    xml_parts, _warnings = unpack_docx(content)

    # 上传到 Supabase Storage
    gw = SupabaseGateway()
    safe_name = file.filename.replace(" ", "_")
    file_path = f"bid_templates/{safe_name}"

    gw.upload_file(file_path, content, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    stored_url = gw.get_file_url(file_path)

    # 创建数据库记录
    doc_data = {
        "name": file.filename,
        "document_type": "bid_template",
        "file_path": stored_url,
        "file_size": len(content),
        "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "status": "uploaded",
    }
    record = gw.insert_document(doc_data)

    return DocumentResponse(
        id=record["id"],
        name=record["name"],
        document_type=record["document_type"],
        file_path=record["file_path"],
        file_size=record["file_size"],
        mime_type=record["mime_type"],
        status=record["status"],
        xml_parts=xml_parts,
    )
