"""DOCX 最终导出服务 — 将已接受的 AIRevision 合成为最终投标文件。

流程：
1. 检查是否存在 blocking 级别的 UnfinishedItem，有则阻断导出
2. 筛选 status = 'accepted' 或 'edited_then_accepted' 的 AIRevision
3. 通过 template_slot_id 获取 location_path 和 fill_strategy
4. 构建 WriteBackOperation 列表，批量应用回写
5. 上传结果到 exports/{project_id}/{timestamp}/final_bid.docx
6. 创建 DocumentVersion 和 ExportRecord
"""

from datetime import datetime

from app.gateway.supabase_gateway import SupabaseGateway
from app.models.export_record import ExportResult
from app.models.writeback import WriteBackOperation
from app.services.docx_writer import write_back_docx, validate_docx


async def export_project_docx(
    project_id: str,
    document_id: str,
    exported_by: str = "",
) -> dict:
    """导出项目的最终投标 DOCX 文件。"""
    gw = SupabaseGateway()

    project = gw.get_project(project_id)
    if not project:
        raise ValueError("项目不存在")

    doc = gw.get_document(document_id)
    if not doc:
        raise ValueError("文档不存在")

    # 确保文档关联到该项目
    if doc.get("project_id") != project_id:
        raise ValueError("文档不属于该项目")

    # ── 第 1 步：检查 blocking 级别的 UnfinishedItem ────────────
    unfinished = gw.get_unfinished_items(document_id)
    blocking_items = [u for u in unfinished if u.get("risk_level") == "blocking"]
    if blocking_items:
        blocked_reasons = [
            f"[{u.get('item_type', '未知')}] {u.get('reason', '无详细原因')}"
            for u in blocking_items
        ]
        return {
            "project_id": project_id,
            "document_id": document_id,
            "status": "blocked",
            "error": "",
            "export_record_id": "",
            "file_path": "",
            "file_size": 0,
            "revision_count": 0,
            "download_url": "",
            "blocked_by": blocked_reasons,
        }

    # ── 第 2 步：获取已接受的 AIRevision ─────────────────────────
    all_revisions = gw.get_ai_revisions(document_id)
    accepted_statuses = {"accepted", "edited_then_accepted"}
    accepted_revisions = [
        r for r in all_revisions
        if r.get("status") in accepted_statuses and r.get("ai_content")
    ]

    if not accepted_revisions:
        return {
            "project_id": project_id,
            "document_id": document_id,
            "status": "success",
            "error": "",
            "export_record_id": "",
            "file_path": "",
            "file_size": 0,
            "revision_count": 0,
            "download_url": "",
            "blocked_by": [],
        }

    # ── 第 3 步：获取 template_slot 获取 location_path 和 fill_strategy
    all_slots = gw.get_template_slots(document_id)
    slot_map: dict[str, dict] = {s["id"]: s for s in all_slots}

    # ── 第 4 步：构建 WriteBackOperation 列表 ─────────────────────
    operations: list[WriteBackOperation] = []
    skipped = 0
    for rev in accepted_revisions:
        slot_id = rev.get("template_slot_id", "")
        slot = slot_map.get(slot_id) if slot_id else None

        if not slot:
            skipped += 1
            continue

        location_path = slot.get("location_path", "")
        fill_strategy = slot.get("fill_strategy", "replace")
        ai_content = rev.get("ai_content", "")

        if not location_path or not ai_content:
            skipped += 1
            continue

        # revision_type 为 new_section 时使用 section_append 策略
        if rev.get("revision_type") == "new_section" and fill_strategy == "section_append":
            strategy = "section_append"
        else:
            # 其他情况直接使用 slot 的 fill_strategy
            strategy = fill_strategy

        operations.append(WriteBackOperation(
            location_path=location_path,
            strategy=strategy,
            new_text=ai_content,
        ))

    if not operations:
        return {
            "project_id": project_id,
            "document_id": document_id,
            "status": "success",
            "error": f"没有可导出的修订（已跳过 {skipped} 条缺少必要信息的修订）",
            "export_record_id": "",
            "file_path": "",
            "file_size": 0,
            "revision_count": 0,
            "download_url": "",
            "blocked_by": [],
        }

    # ── 第 5 步：下载原始模板并应用回写 ──────────────────────────
    file_path = doc.get("file_path", "")
    if not file_path:
        raise ValueError("文档缺少 file_path，无法定位模板文件")

    original_bytes = gw.download_file_by_url(file_path)
    modified_bytes, failed_details = write_back_docx(original_bytes, operations)

    # 验证导出文件结构
    is_valid, validation_error = validate_docx(modified_bytes)
    if not is_valid:
        return {
            "project_id": project_id,
            "document_id": document_id,
            "status": "failed",
            "error": f"导出文件验证失败: {validation_error}",
            "export_record_id": "",
            "file_path": "",
            "file_size": 0,
            "revision_count": len(operations),
            "download_url": "",
            "blocked_by": [],
        }

    # ── 第 6 步：上传导出文件到 Storage ──────────────────────────
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    doc_name = doc.get("name", f"{document_id}.docx")
    # 去掉原扩展名，添加标识
    base_name = doc_name.rsplit(".", 1)[0] if "." in doc_name else doc_name
    export_filename = f"{base_name}_final.docx"
    export_storage_path = f"exports/{project_id}/{timestamp}/{export_filename}"

    mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    gw.upload_file(export_storage_path, modified_bytes, mime_type)

    # ── 第 7 步：创建 DocumentVersion 记录 ───────────────────────
    gw.insert_document_version({
        "document_id": document_id,
        "version_type": "export",
        "file_path": export_storage_path,
        "metadata": {
            "exported_by": exported_by,
            "revision_count": len(operations),
            "failed_count": len(failed_details),
            "timestamp": timestamp,
        },
    })

    # ── 第 8 步：创建 ExportRecord ────────────────────────────────
    export_record = gw.insert_export_record({
        "project_id": project_id,
        "document_id": document_id,
        "exported_by": exported_by,
        "file_path": export_storage_path,
        "file_size": len(modified_bytes),
        "revision_count": len(operations),
    })

    return {
        "project_id": project_id,
        "document_id": document_id,
        "status": "success",
        "error": "",
        "export_record_id": export_record.get("id", ""),
        "file_path": export_storage_path,
        "file_size": len(modified_bytes),
        "revision_count": len(operations),
        "download_url": gw.get_file_url(export_storage_path),
        "blocked_by": [],
    }
