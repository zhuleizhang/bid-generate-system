"""TemplateSlot 生成引擎 — 自动识别文档中需要填充的位置。

遍历文档节点，根据占位符文本、空段落、提示词、表格单元格、章节标题等特征，
为每个可填充位置生成 TemplateSlot 记录，包含置信度和填充策略。
"""

import re
from typing import Any

from app.gateway.supabase_gateway import SupabaseGateway
from app.models.template_slot import TemplateSlotResponse, SlotGenerationResult


# 占位符模式：(正则, 提取组索引, 剥离后的内容组索引)
PLACEHOLDER_PATTERNS: list[tuple[str, int]] = [
    (r"【(.+?)】", 1),       # 【公司介绍】
    (r"\[(.+?)\]", 1),       # [技术方案]
    (r"\{\{(.+?)\}\}", 1),   # {{项目名称}}
    (r"（请填写(.+?)）", 1),  # （请填写公司资质）
    (r"\(请填写(.+?)\)", 1),  # (请填写技术参数)
    (r"<(.+?)>", 1),         # <填写内容>
]

# 提示词列表
PROMPT_KEYWORDS = [
    "填写", "填入", "描述", "说明", "备注", "注明",
    "补充", "修改", "撰写", "编写", "阐述", "介绍",
    "请在此", "此处填写", "以下空白", "待补充",
]


def _detect_placeholder(text: str) -> tuple[str | None, str | None]:
    """检测文本中的占位符，返回 (占位符原始文本, 提取的内容类型)。"""
    if not text:
        return None, None

    for pattern, group_idx in PLACEHOLDER_PATTERNS:
        m = re.search(pattern, text)
        if m:
            return m.group(0), m.group(group_idx).strip()

    return None, None


def _has_prompt_keywords(text: str) -> bool:
    """检测文本是否包含提示关键词。"""
    if not text:
        return False
    return any(kw in text for kw in PROMPT_KEYWORDS)


def _infer_content_type_from_text(text: str) -> str | None:
    """从占位符或提示文本中推断期望的内容类型。"""
    _, content_type = _detect_placeholder(text)
    return content_type


def _find_table_for_cell(
    cell_node: dict[str, Any],
    node_map: dict[str, dict[str, Any]],
) -> dict[str, Any] | None:
    """从单元格节点向上查找所属的表格节点。"""
    current: dict[str, Any] | None = cell_node
    while current is not None:
        if current.get("node_type") == "table":
            return current
        parent_id = current.get("parent_node_id")
        if not parent_id:
            return None
        current = node_map.get(parent_id)
    return None


def _is_header_cell(
    cell_node: dict[str, Any],
    node_map: dict[str, dict[str, Any]],
) -> bool:
    """判断单元格是否属于表头行。"""
    table = _find_table_for_cell(cell_node, node_map)
    if not table:
        return False

    style_json = table.get("style_json") or {}
    header_rows: list[int] = style_json.get("header_rows", [])
    row_index = cell_node.get("row_index")
    return row_index in header_rows


def _infer_cell_content_type(
    cell_node: dict[str, Any],
    node_map: dict[str, dict[str, Any]],
) -> str | None:
    """从列标题推断单元格的期望内容类型。"""
    table = _find_table_for_cell(cell_node, node_map)
    if not table:
        return None

    style_json = table.get("style_json") or {}
    header_rows: list[int] = style_json.get("header_rows", [])
    if not header_rows:
        return None

    col_index = cell_node.get("col_index")
    if col_index is None:
        return None

    # 在同列中查找表头行的单元格文本
    for node in node_map.values():
        if (
            node.get("node_type") == "cell"
            and node.get("row_index") in header_rows
            and node.get("col_index") == col_index
            and node.get("parent_node_id") == cell_node.get("parent_node_id")
        ):
            header_text = (node.get("text") or "").strip()
            if header_text:
                return header_text
            break

    return None


def _generate_slot_data(
    doc_id: str,
    node: dict[str, Any],
    slot_type: str,
    section_path: str | None,
    expected_content_type: str | None,
    confidence: float,
    evidence: str,
    fill_strategy: str,
) -> dict[str, Any]:
    """构造一条 TemplateSlot 的插入数据。"""
    style_json = node.get("style_json") or {}
    return {
        "document_id": doc_id,
        "node_id": node["id"],
        "slot_type": slot_type,
        "location_path": node.get("location_path"),
        "section_path": section_path,
        "expected_content_type": expected_content_type,
        "style_id": style_json.get("paragraph_style"),
        "confidence": confidence,
        "evidence": evidence,
        "fill_strategy": fill_strategy,
        "need_human_confirm": confidence < 0.5,
    }


async def generate_template_slots(doc_id: str) -> SlotGenerationResult:
    """为文档的所有可填充位置生成 TemplateSlot 记录。

    检测策略（按优先级）：
    1. 占位符文本 → confidence ≥ 0.9, slot_type = placeholder
    2. 提示词段落 → confidence ≥ 0.6, slot_type = paragraph
    3. 空段落 → confidence ≥ 0.7, slot_type = paragraph
    4. 空表格单元格（非表头）→ confidence ≥ 0.7, slot_type = table_cell
    5. 章节标题段落 → confidence = 0.8, slot_type = heading_section
    6. 章节末段落 → confidence = 0.4, slot_type = section_append
    """
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
    section_path_map: dict[str, str] = {s["section_id"]: s["section_path"] for s in sections if s.get("section_id")}

    # 构建 node_id → section_path 映射
    node_section_map: dict[str, str] = {}
    for node in nodes:
        sid = node.get("section_id")
        if sid and sid in section_path_map:
            node_section_map[node["id"]] = section_path_map[sid]

    # 标题节点（章节的起点）
    heading_node_ids: set[str] = {s["node_id"] for s in sections if s.get("node_id")}

    # 每个 section_path 下的最后一个段落节点
    section_last_para: dict[str, str] = {}
    for node in nodes:
        if node.get("node_type") != "paragraph":
            continue
        sp = node_section_map.get(node["id"])
        if sp:
            section_last_para[sp] = node["id"]

    # 收集所有末段节点 ID
    last_para_ids: set[str] = set(section_last_para.values())

    slot_data_list: list[dict[str, Any]] = []

    for node in nodes:
        node_id = node["id"]
        node_type = node.get("node_type", "")
        text = (node.get("text") or "").strip()
        section_path = node_section_map.get(node_id)

        # ── 1. 占位符检测（仅段落节点） ──
        if node_type == "paragraph" and text:
            placeholder, content_type = _detect_placeholder(text)
            if placeholder:
                slot_data_list.append(_generate_slot_data(
                    doc_id=doc_id,
                    node=node,
                    slot_type="placeholder",
                    section_path=section_path,
                    expected_content_type=content_type,
                    confidence=0.92,
                    evidence=f"检测到占位符文本 {placeholder}",
                    fill_strategy="replace",
                ))
                continue

        # ── 2. 提示词检测（仅段落节点） ──
        if node_type == "paragraph" and text and _has_prompt_keywords(text):
            content_type = _infer_content_type_from_text(text)
            slot_data_list.append(_generate_slot_data(
                doc_id=doc_id,
                node=node,
                slot_type="paragraph",
                section_path=section_path,
                expected_content_type=content_type,
                confidence=0.65,
                evidence="段落包含提示关键词",
                fill_strategy="replace",
            ))
            continue

        # ── 3. 空段落检测 ──
        if node_type == "paragraph" and not text:
            slot_data_list.append(_generate_slot_data(
                doc_id=doc_id,
                node=node,
                slot_type="paragraph",
                section_path=section_path,
                expected_content_type=None,
                confidence=0.72,
                evidence="检测到空段落",
                fill_strategy="append",
            ))
            continue

        # ── 4. 空表格单元格（非表头） ──
        if node_type == "cell":
            if not _is_header_cell(node, node_map):
                cell_text = node.get("text") or ""
                if not cell_text.strip():
                    col_content_type = _infer_cell_content_type(node, node_map)
                    slot_data_list.append(_generate_slot_data(
                        doc_id=doc_id,
                        node=node,
                        slot_type="table_cell",
                        section_path=section_path,
                        expected_content_type=col_content_type,
                        confidence=0.72,
                        evidence=f"检测到空表格单元格（第{node.get('row_index', '?')}行第{node.get('col_index', '?')}列）",
                        fill_strategy="cell_fill",
                    ))
                    continue

        # ── 5. 章节标题段落 ──
        if node_type == "paragraph" and node_id in heading_node_ids:
            slot_data_list.append(_generate_slot_data(
                doc_id=doc_id,
                node=node,
                slot_type="heading_section",
                section_path=section_path,
                expected_content_type=text,
                confidence=0.80,
                evidence=f"章节标题段落: {text}",
                fill_strategy="section_append",
            ))
            continue

        # ── 6. 章节末段落 ──
        if node_type == "paragraph" and node_id in last_para_ids:
            slot_data_list.append(_generate_slot_data(
                doc_id=doc_id,
                node=node,
                slot_type="section_append",
                section_path=section_path,
                expected_content_type=None,
                confidence=0.40,
                evidence=f"章节末段落，可追加内容",
                fill_strategy="section_append",
            ))
            continue

    # 写入数据库
    if slot_data_list:
        gw.delete_template_slots(doc_id)
        inserted = gw.insert_template_slots(slot_data_list)

        slot_responses = [
            TemplateSlotResponse(
                id=s["id"],
                document_id=s["document_id"],
                node_id=s["node_id"],
                slot_type=s["slot_type"],
                location_path=s.get("location_path"),
                section_path=s.get("section_path"),
                expected_content_type=s.get("expected_content_type"),
                style_id=s.get("style_id"),
                confidence=s["confidence"],
                evidence=s.get("evidence"),
                fill_strategy=s["fill_strategy"],
                need_human_confirm=s["need_human_confirm"],
                created_at=s["created_at"],
                updated_at=s["updated_at"],
            )
            for s in inserted
        ]
    else:
        slot_responses = []

    # 更新文档状态
    gw.update_document_status(doc_id, "slots_generated")

    return SlotGenerationResult(
        document_id=doc_id,
        slots=slot_responses,
        total_slots=len(slot_responses),
    )
