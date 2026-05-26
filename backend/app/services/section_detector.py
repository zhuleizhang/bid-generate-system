"""章节检测引擎 — 识别 DOCX 中的标题层级和章节结构。

标准标题：通过 paragraph_style 匹配 Heading1-6 样式。
非标准标题：通过字体大小（≥14pt）、加粗、编号模式推断层级。
"""

import re
import uuid
from typing import Any

from app.models.section import SectionNode

# Heading1-6 样式名 → 层级映射（包含常见大小写变体）
HEADING_STYLE_MAP: dict[str, int] = {
    "Heading1": 1, "heading1": 1, "heading 1": 1,
    "Heading2": 2, "heading2": 2, "heading 2": 2,
    "Heading3": 3, "heading3": 3, "heading 3": 3,
    "Heading4": 4, "heading4": 4, "heading 4": 4,
    "Heading5": 5, "heading5": 5, "heading 5": 5,
    "Heading6": 6, "heading6": 6, "heading 6": 6,
}

# 非标准标题的编号模式
NUMBERING_PATTERNS: list[tuple[str, int]] = [
    (r"^第[一二三四五六七八九十\d]+章", 1),     # 第一章、第1章
    (r"^第[一二三四五六七八九十\d]+节", 2),     # 第一节
    (r"^[一二三四五六七八九十]+、", 1),           # 一、二、
    (r"^（[一二三四五六七八九十]+）", 2),         # （一）（二）
    (r"^\d+\.\d+\.\d+[\s\.]", 3),                # 1.1.1
    (r"^\d+\.\d+[\s\.]", 2),                      # 1.1
    (r"^\d+\.[\s]", 1),                           # 1.
    (r"^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+、", 1),                 # Ⅰ、Ⅱ、
]


def _match_numbering_pattern(text: str) -> int | None:
    """匹配编号模式，返回推断的层级，无匹配返回 None。"""
    for pattern, level in NUMBERING_PATTERNS:
        if re.match(pattern, text):
            return level
    return None


def _is_paragraph_heading(style_json: dict[str, Any]) -> tuple[bool, int | None, str, float]:
    """判断段落是否为标题，返回 (is_heading, level, method, confidence)。"""
    para_style = str(style_json.get("paragraph_style", ""))

    # 优先匹配标准 Heading 样式
    for key, level in HEADING_STYLE_MAP.items():
        if para_style.lower() == key.lower():
            return True, level, "standard_style", 1.0

    # 非标准标题推断：字号 ≥ 14pt 且加粗
    font_size = style_json.get("font_size", 0)
    is_bold = style_json.get("bold", False)

    if isinstance(font_size, (int, float)) and font_size >= 14 and is_bold:
        return True, None, "font_size_bold", 0.7

    return False, None, "unknown", 0.0


def _assign_nonstandard_levels(headings: list[dict[str, Any]]) -> None:
    """为所有非标准标题分配层级：有编号模式按编号深度，否则按字号大小排序。"""
    nonstandard = [h for h in headings if h["method"] != "standard_style"]
    if not nonstandard:
        return

    # 收集所有非标准标题的字号
    font_sizes: set[float] = set()
    for h in nonstandard:
        fs = h.get("font_size", 0)
        if isinstance(fs, (int, float)) and fs > 0:
            font_sizes.add(float(fs))

    sorted_sizes = sorted(font_sizes, reverse=True)

    for h in nonstandard:
        numbering_level = h.get("numbering_level")

        if numbering_level is not None:
            h["level"] = numbering_level
        else:
            fs = float(h.get("font_size", 0)) if isinstance(h.get("font_size"), (int, float)) else 0.0
            try:
                h["level"] = sorted_sizes.index(fs) + 1
            except ValueError:
                h["level"] = 1

        h["level"] = max(1, min(6, h["level"]))


def _build_heading_list(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """遍历所有段落节点，识别标题候选列表。"""
    headings: list[dict[str, Any]] = []

    for node in nodes:
        if node.get("node_type") != "paragraph":
            continue

        text = (node.get("text") or "").strip()
        if not text:
            continue

        style_json = node.get("style_json") or {}
        is_heading, level, method, confidence = _is_paragraph_heading(style_json)
        if not is_heading:
            continue

        numbering_level = _match_numbering_pattern(text)
        if method == "font_size_bold":
            level = numbering_level

        headings.append({
            "node_id": node["id"],
            "text": text,
            "level": level,
            "method": method,
            "confidence": confidence,
            "font_size": style_json.get("font_size", 0),
            "numbering_level": numbering_level,
        })

    return headings


def _build_section_tree(
    headings: list[dict[str, Any]],
    all_nodes: list[dict[str, Any]],
) -> tuple[list[SectionNode], dict[str, str]]:
    """构建章节树和节点→section_id 的映射。

    遍历所有节点，遇到标题时创建 SectionNode，非标题节点归属于最近标题。
    """
    sorted_nodes = sorted(all_nodes, key=lambda n: n.get("order_index", 0))
    heading_map: dict[str, dict[str, Any]] = {h["node_id"]: h for h in headings}

    section_nodes: list[SectionNode] = []
    section_stack: list[SectionNode] = []
    node_section_map: dict[str, str] = {}
    current_section: SectionNode | None = None

    for node in sorted_nodes:
        heading_info = heading_map.get(node["id"])

        if heading_info is not None:
            level = heading_info["level"] or 1

            # 弹出层级不高于当前标题的节点
            while section_stack and section_stack[-1].level >= level:
                section_stack.pop()

            parent = section_stack[-1] if section_stack else None

            section_path = (
                f"{parent.section_path}/{heading_info['text']}"
                if parent
                else heading_info["text"]
            )

            section_id = str(uuid.uuid4())
            section = SectionNode(
                section_id=section_id,
                title=heading_info["text"],
                level=level,
                section_path=section_path,
                parent_section_id=parent.section_id if parent else None,
                start_node_id=node["id"],
                method=heading_info["method"],
                confidence=heading_info["confidence"],
            )

            if parent:
                parent.child_sections.append(section)

            section_stack.append(section)
            section_nodes.append(section)
            current_section = section
        else:
            if current_section:
                node_section_map[node["id"]] = current_section.section_id

    # 标题节点自身也设置 section_id
    for section in section_nodes:
        if section.start_node_id:
            node_section_map[section.start_node_id] = section.section_id

    return section_nodes, node_section_map


def detect_sections(nodes: list[dict[str, Any]]) -> tuple[list[SectionNode], dict[str, str]]:
    """从文档节点列表中检测章节结构。

    Args:
        nodes: 文档节点列表（来自 SupabaseGateway.get_document_nodes）

    Returns:
        (sections, node_section_map):
          - sections: 顶层 SectionNode 列表（含嵌套子章节）
          - node_section_map: node_id → section_id 映射
    """
    headings = _build_heading_list(nodes)
    _assign_nonstandard_levels(headings)
    sections, node_section_map = _build_section_tree(headings, nodes)
    return sections, node_section_map
