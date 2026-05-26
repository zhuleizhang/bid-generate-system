"""UnfinishedItem 生成引擎 — 检测无法安全处理的模板位置。

遍历文档节点和 TemplateSlot，识别以下场景并生成 UnfinishedItem：
1. 低置信度 TemplateSlot（confidence < 0.3）
2. 嵌套表格（当前无法展开解析）
3. 无法解析的表格结构
"""

from typing import Any

from app.gateway.supabase_gateway import SupabaseGateway
from app.models.unfinished_item import UnfinishedItemResponse, UnfinishedItemGenerationResult


def _build_item(
    doc_id: str,
    item_type: str,
    node_id: str | None,
    section_path: str | None,
    reason: str,
    impact: str,
    risk_level: str,
    suggested_action: str,
    template_slot_id: str | None = None,
) -> dict[str, Any]:
    return {
        "document_id": doc_id,
        "template_slot_id": template_slot_id,
        "node_id": node_id,
        "item_type": item_type,
        "section_path": section_path,
        "reason": reason,
        "impact": impact,
        "risk_level": risk_level,
        "suggested_action": suggested_action,
        "status": "open",
    }


async def generate_unfinished_items(doc_id: str) -> UnfinishedItemGenerationResult:
    """扫描文档，生成所有无法安全处理位置的 UnfinishedItem 记录。"""
    gw = SupabaseGateway()

    doc = gw.get_document(doc_id)
    if not doc:
        raise ValueError(f"文档不存在: {doc_id}")

    nodes = gw.get_document_nodes(doc_id)
    if not nodes:
        raise ValueError("文档尚未解析，请先调用 /parse 端点")

    # 构建 node_id → node 映射
    node_map: dict[str, dict[str, Any]] = {n["id"]: n for n in nodes}

    # 构建 section_id → section_path 映射
    sections = gw.get_section_contents(doc_id)
    section_path_map: dict[str, str] = {
        s["section_id"]: s["section_path"] for s in sections if s.get("section_id")
    }

    # 构建 node_id → section_path 映射
    node_section_map: dict[str, str] = {}
    for node in nodes:
        sid = node.get("section_id")
        if sid and sid in section_path_map:
            node_section_map[node["id"]] = section_path_map[sid]

    item_data_list: list[dict[str, Any]] = []

    # ── 1. 低置信度 TemplateSlot ──
    slots = gw.get_template_slots(doc_id)
    for slot in slots:
        confidence = slot.get("confidence", 0)
        if confidence >= 0.3:
            continue

        slot_type = slot.get("slot_type", "unknown")
        node_id = slot.get("node_id")
        section_path = slot.get("section_path")
        evidence = slot.get("evidence", "")

        # 置信度 0.1-0.3：medium risk
        # 置信度 < 0.1：high risk
        if confidence < 0.1:
            risk_level = "high"
            impact = "极低置信度，AI 生成内容可能与模板需求严重偏离"
        else:
            risk_level = "medium"
            impact = "低置信度，AI 生成内容可能与模板需求有出入"

        item_data_list.append(_build_item(
            doc_id=doc_id,
            item_type="low_confidence",
            node_id=node_id,
            section_path=section_path,
            reason=f"TemplateSlot（{slot_type}）置信度过低：{confidence:.0%}，依据：{evidence}",
            impact=impact,
            risk_level=risk_level,
            suggested_action="请人工检查该位置，确认填充内容和格式要求",
            template_slot_id=slot.get("id"),
        ))

    # ── 2. 嵌套表格 ──
    for node in nodes:
        if node.get("node_type") != "table":
            continue

        style_json = node.get("style_json") or {}
        nested_warnings: list[str] = style_json.get("nested_table_warnings", [])
        if not nested_warnings:
            continue

        table_index = style_json.get("table_index", "?")
        section_path = node_section_map.get(node["id"])

        item_data_list.append(_build_item(
            doc_id=doc_id,
            item_type="nested_table",
            node_id=node["id"],
            section_path=section_path,
            reason=f"表格 #{table_index} 包含 {len(nested_warnings)} 个嵌套表格，当前无法展开解析",
            impact="嵌套表格内的占位符和提示词将被遗漏，可能影响内容完整性",
            risk_level="high",
            suggested_action="请手动检查嵌套表格中的内容，或将嵌套表格拆分为独立表格后重新上传",
        ))

    # ── 3. 检查是否存在无 slot 覆盖的空段落和空单元格 ──
    # 收集所有已有 slot 覆盖的 node_id
    covered_node_ids: set[str] = set()
    for s in slots:
        nid = s.get("node_id")
        if nid:
            covered_node_ids.add(str(nid))

    for node in nodes:
        node_type = node.get("node_type", "")
        text = (node.get("text") or "").strip()
        section_path = node_section_map.get(node["id"])

        # 非表头空表格单元格未被 slot 覆盖
        if node_type == "cell" and not text:
            if node["id"] in covered_node_ids:
                continue
            style_json = node.get("style_json") or {}
            v_merge = style_json.get("v_merge", "")
            if v_merge == "continue":
                continue

            row_idx = node.get("row_index", "?")
            col_idx = node.get("col_index", "?")

            item_data_list.append(_build_item(
                doc_id=doc_id,
                item_type="unfilled_table_cell",
                node_id=node["id"],
                section_path=section_path,
                reason=f"空表格单元格（第{row_idx}行第{col_idx}列）未被 slot 生成器覆盖",
                impact="该单元格可能遗漏，最终导出文档对应位置为空",
                risk_level="medium",
                suggested_action="请人工检查该单元格是否应保留为空，或补充内容",
            ))

    # 写入数据库
    if item_data_list:
        gw.delete_unfinished_items(doc_id)
        inserted = gw.insert_unfinished_items(item_data_list)

        # risk_level 降序排列：blocking > high > medium > low
        risk_order = {"blocking": 0, "high": 1, "medium": 2, "low": 3}
        inserted.sort(key=lambda x: risk_order.get(x.get("risk_level", "low"), 99))

        item_responses = [
            UnfinishedItemResponse(
                id=item["id"],
                document_id=item["document_id"],
                template_slot_id=item.get("template_slot_id"),
                node_id=item.get("node_id"),
                item_type=item["item_type"],
                section_path=item.get("section_path"),
                reason=item.get("reason"),
                impact=item.get("impact"),
                risk_level=item["risk_level"],
                suggested_action=item.get("suggested_action"),
                status=item["status"],
                created_at=item["created_at"],
                updated_at=item["updated_at"],
            )
            for item in inserted
        ]
    else:
        item_responses = []

    gw.update_document_status(doc_id, "unfinished_items_generated")

    return UnfinishedItemGenerationResult(
        document_id=doc_id,
        items=item_responses,
        total_items=len(item_responses),
    )
