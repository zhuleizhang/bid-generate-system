"""文档服务 — DOCX 上传、解包、解析和存储的核心逻辑。"""

import zipfile
from io import BytesIO
from typing import Any

from fastapi import UploadFile

from app.gateway.supabase_gateway import SupabaseGateway
from app.models.document import DocumentResponse
from app.models.document_node import ParseResult
from app.services.docx_parser import parse_docx_structure


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


def _resolve_parent_ids(
    parsed_nodes: list[dict[str, Any]],
    inserted_records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """根据临时 ID 映射回填 parent_node_id。

    parsed_nodes 中每个节点有 _temp_id 和 _temp_parent_id，
    inserted_records 按插入顺序与 parsed_nodes 保持一致（由 Supabase 分批插入保证）。
    通过 _temp_id → 真实 UUID 的映射，将 _temp_parent_id 转换为 parent_node_id。
    """
    # 按 order_index 排序，确保与插入顺序一致
    parsed_nodes.sort(key=lambda n: n["order_index"])
    inserted_records.sort(key=lambda n: n["order_index"])

    temp_to_uuid: dict[int, str] = {}
    for parsed, inserted in zip(parsed_nodes, inserted_records):
        temp_to_uuid[parsed["_temp_id"]] = inserted["id"]

    updates: dict[str, str | None] = {}
    for parsed, inserted in zip(parsed_nodes, inserted_records):
        parent_temp = parsed.get("_temp_parent_id")
        real_parent = temp_to_uuid.get(parent_temp) if parent_temp is not None else None
        if real_parent != inserted.get("parent_node_id"):
            updates[inserted["id"]] = real_parent

    # 清理临时字段，填充真实 parent_node_id
    for record in inserted_records:
        record_id = record["id"]
        record["parent_node_id"] = updates.get(record_id, record.get("parent_node_id"))
        record.pop("_temp_id", None)
        record.pop("_temp_parent_id", None)

    return inserted_records


async def parse_and_store_document(doc_id: str) -> ParseResult:
    """解析已上传文档的结构树并存储到 document_nodes 表。

    从 Supabase Storage 下载解包后的 XML 部件，调用解析引擎构建节点树，
    批量写入 document_nodes 表，并回填 parent_node_id 关联。
    """
    gw = SupabaseGateway()

    # 获取文档记录
    doc = gw.get_document(doc_id)
    if not doc:
        raise ValueError(f"文档不存在: {doc_id}")

    # 从 Storage 下载 DOCX 并解包（需要 styles.xml 和页眉页脚用于完整解析）
    file_path = doc.get("file_path")
    if not file_path:
        raise ValueError("文档缺少 file_path，无法定位源文件")

    file_bytes = gw.download_file_by_url(file_path)
    xml_parts, _warnings = unpack_docx(file_bytes)

    document_xml = xml_parts.get("word/document.xml")
    if not document_xml:
        raise ValueError("document.xml 缺失，无法解析")

    styles_xml = xml_parts.get("word/styles.xml")

    # 分离页眉页脚与其他部件
    header_footer_parts = {
        k: v for k, v in xml_parts.items()
        if "header" in k.lower() or "footer" in k.lower()
    }

    # 解析文档结构
    parsed_nodes = parse_docx_structure(
        document_xml=document_xml,
        styles_xml=styles_xml,
        header_footer_parts=header_footer_parts,
    )

    # 清理旧节点并插入新节点
    gw.delete_document_nodes(doc_id)

    # 准备插入数据：移除临时字段，设置 document_id
    insert_data: list[dict[str, Any]] = []
    for node in parsed_nodes:
        insert_data.append({
            "document_id": doc_id,
            "node_type": node["node_type"],
            "text": node["text"],
            "location_path": node["location_path"],
            "style_json": node["style_json"],
            "parent_node_id": None,  # 稍后回填
            "row_index": node.get("row_index"),
            "col_index": node.get("col_index"),
            "order_index": node["order_index"],
        })

    inserted = gw.insert_document_nodes(insert_data)

    # 回填 parent_node_id
    resolved = _resolve_parent_ids(parsed_nodes, inserted)

    # 更新 parent_node_id（批量 UPDATE）
    for record in resolved:
        if record["parent_node_id"] is not None:
            gw.update_node_parent(record["id"], record["parent_node_id"])

    # 更新文档状态
    gw.update_document_status(doc_id, "parsed")

    return ParseResult(
        document_id=doc_id,
        nodes=resolved,  # type: ignore[arg-type]
        node_count=len(resolved),
    )
