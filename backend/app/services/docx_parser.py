"""DOCX 文档结构解析引擎 — 将 document.xml 解析为 DocumentNode 树。

解析 WordprocessingML 的 w:body 下所有 w:p、w:tbl、w:sdt 元素，提取文本、
样式、位置路径，构建完整的父子关系节点树。页眉页脚作为独立分支纳入结构树。

使用 _temp_id / _temp_parent_id 机制记录父子关系，由调用方在数据库插入后
根据 _temp_id → 真实 UUID 的映射回填 parent_node_id。
"""

from typing import Any

from lxml import etree

# WordprocessingML 命名空间
NSMAP = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "mc": "http://schemas.openxmlformats.org/markup-compatibility/2006",
    "w14": "http://schemas.microsoft.com/office/word/2010/wordml",
}


def _ns(tag: str) -> str:
    """生成带 w 命名空间的 XPath 标签名，如 _ns('p') → '{...}p'。"""
    return f"{{{NSMAP['w']}}}{tag}"


def _build_style_map(styles_xml: str | None) -> dict[str, dict[str, Any]]:
    """解析 styles.xml，构建 styleId → 样式属性的映射。"""
    style_map: dict[str, dict[str, Any]] = {}
    if not styles_xml:
        return style_map

    try:
        root = etree.fromstring(styles_xml.encode("utf-8"))
    except etree.XMLSyntaxError:
        return style_map

    for style_el in root.findall(f"{_ns('style')}"):
        style_id = style_el.get(f"{_ns('styleId')}")
        if not style_id:
            continue

        props: dict[str, Any] = {}

        name_el = style_el.find(f"{_ns('name')}")
        if name_el is not None:
            props["style_name"] = name_el.get(f"{_ns('val')}", "")

        pPr = style_el.find(f"{_ns('pPr')}")
        if pPr is not None:
            numPr = pPr.find(f"{_ns('numPr')}")
            if numPr is not None:
                numId = numPr.find(f"{_ns('numId')}")
                if numId is not None:
                    props["numbering_id"] = numId.get(f"{_ns('val')}")
                ilvl = numPr.find(f"{_ns('ilvl')}")
                if ilvl is not None:
                    props["numbering_level"] = ilvl.get(f"{_ns('val')}")

        rPr = style_el.find(f"{_ns('rPr')}")
        if rPr is not None:
            _extract_run_props(rPr, props)

        style_map[style_id] = props

    return style_map


def _extract_run_props(rPr: etree._Element, target: dict[str, Any]) -> None:
    """从 w:rPr 元素中提取字体、字号、加粗、倾斜等属性。"""
    rFonts = rPr.find(f"{_ns('rFonts')}")
    if rFonts is not None:
        ascii_font = rFonts.get(f"{_ns('ascii')}") or rFonts.get(f"{_ns('eastAsia')}")
        if ascii_font:
            target["font_name"] = ascii_font

    sz = rPr.find(f"{_ns('sz')}")
    if sz is not None:
        val = sz.get(f"{_ns('val')}")
        if val:
            target["font_size"] = int(val) / 2  # half-points → points

    szCs = rPr.find(f"{_ns('szCs')}")
    if szCs is not None and "font_size" not in target:
        val = szCs.get(f"{_ns('val')}")
        if val:
            target["font_size"] = int(val) / 2

    b = rPr.find(f"{_ns('b')}")
    if b is not None:
        val = b.get(f"{_ns('val')}")
        target["bold"] = val != "0" and val != "false"

    i = rPr.find(f"{_ns('i')}")
    if i is not None:
        val = i.get(f"{_ns('val')}")
        target["italic"] = val != "0" and val != "false"


def _extract_paragraph_style(p_el: etree._Element, style_map: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """提取段落样式：优先直接格式，回退到 styles.xml 引用。"""
    style: dict[str, Any] = {}

    pPr = p_el.find(f"{_ns('pPr')}")
    if pPr is None:
        return style

    # 段落样式引用
    pStyle = pPr.find(f"{_ns('pStyle')}")
    style_id = None
    if pStyle is not None:
        style_id = pStyle.get(f"{_ns('val')}")
        if style_id:
            style["paragraph_style"] = style_id

    # 编号样式
    numPr = pPr.find(f"{_ns('numPr')}")
    if numPr is not None:
        numId = numPr.find(f"{_ns('numId')}")
        ilvl = numPr.find(f"{_ns('ilvl')}")
        if numId is not None:
            style["numbering_id"] = numId.get(f"{_ns('val')}")
        if ilvl is not None:
            style["numbering_level"] = ilvl.get(f"{_ns('val')}")

    # 从 styles.xml 继承样式属性
    if style_id and style_id in style_map:
        for key, val in style_map[style_id].items():
            if key not in style:
                style[key] = val

    # 段落级别的 run properties（段落默认格式）
    rPr = pPr.find(f"{_ns('rPr')}")
    if rPr is not None:
        _extract_run_props(rPr, style)

    # 如果段落 pPr 中没有字号，尝试从第一个 run 的 rPr 中提取
    if "font_size" not in style:
        first_rPr = p_el.find(f"{_ns('r')}/{_ns('rPr')}")
        if first_rPr is not None:
            _extract_run_props(first_rPr, style)

    return style


def _extract_text(p_el: etree._Element) -> str:
    """提取段落全部文本（合并所有 w:r 内的 w:t）。"""
    texts: list[str] = []
    for t in p_el.iter(f"{_ns('t')}"):
        if t.text:
            texts.append(t.text)
    return "".join(texts)


def _make_location_path(element: etree._Element, root: etree._Element) -> str:
    """为 XML 元素生成 XPath 风格的位置路径。

    从根到目标元素的路径，各层用数字索引定位，如：
    /w:document/w:body/w:p[3]
    """
    parts: list[str] = []
    current = element

    while current is not None and current is not root:
        tag = etree.QName(current).localname
        parent = current.getparent() if hasattr(current, "getparent") else None

        if parent is None:
            break

        # 计算 current 在 parent 的同名子元素中的序号
        siblings = [c for c in parent if isinstance(c, etree._Element) and etree.QName(c).localname == tag]
        index = siblings.index(current) + 1 if current in siblings else 1
        parts.append(f"w:{tag}[{index}]")
        current = parent

    if current is root:
        parts.append("w:document")

    parts.reverse()
    return "/" + "/".join(parts)


# ── 表格解析辅助函数 ──────────────────────────────────────────


def _parse_cell_info(tc: etree._Element) -> dict[str, Any]:
    """提取单个 w:tc 单元格的元信息（不创建节点）。"""
    tcPr = tc.find(f"{_ns('tcPr')}")
    grid_span = 1
    vmerge = "none"
    if tcPr is not None:
        gridSpan = tcPr.find(f"{_ns('gridSpan')}")
        if gridSpan is not None:
            val = gridSpan.get(f"{_ns('val')}")
            if val:
                grid_span = int(val)

        vMerge = tcPr.find(f"{_ns('vMerge')}")
        if vMerge is not None:
            val = vMerge.get(f"{_ns('val')}")
            if val == "restart":
                vmerge = "restart"
            else:
                vmerge = "continue"

    # 提取单元格内所有段落文本
    cell_text_parts: list[str] = []
    for p in tc.findall(f"{_ns('p')}"):
        cell_text_parts.append(_extract_text(p))
    cell_text = "\n".join(filter(None, cell_text_parts)) or None

    return {
        "tc_element": tc,
        "text": cell_text,
        "grid_span": grid_span,
        "v_merge": vmerge,
        "row_index": 0,  # 占位，由 _build_table_grid 填入
        "col_index": 0,  # 占位
        "_skip": False,  # vMerge continue 时设为 True，不创建节点
    }


def _build_table_grid(all_rows: list[list[dict[str, Any]]]) -> tuple[int, dict[tuple[int, int], dict[str, int]]]:
    """构建表格网格矩阵，计算合并单元格映射。

    处理 gridSpan（水平合并）和 vMerge（垂直合并），将 vMerge continue
    单元格标记为 _skip=True，并将行列跨度记录到 merge_map 中。

    Returns:
        (max_cols, merge_map):
          max_cols — 表格最大列数
          merge_map — {(row, col): {"row_span": R, "col_span": C}, ...}
    """
    if not all_rows:
        return 0, {}

    # 计算最大列数
    max_cols = 0
    for row_cells in all_rows:
        total = sum(c["grid_span"] for c in row_cells)
        max_cols = max(max_cols, total)

    grid: dict[tuple[int, int], dict[str, Any]] = {}  # (ri, ci) → cell_info
    merge_map: dict[tuple[int, int], dict[str, int]] = {}

    # 跟踪各列的 vMerge 状态：列索引 → 是否正处于合并中
    col_vmerge_restart: dict[int, tuple[int, int]] = {}  # col → (restart_row, restart_col)

    for ri, row_cells in enumerate(all_rows):
        col = 0
        for cell_info in row_cells:
            # 跳过已被上方网格占用的位置
            while (ri, col) in grid:
                col += 1

            grid_span = cell_info["grid_span"]
            vmerge = cell_info["v_merge"]

            if vmerge == "continue":
                # 检查同列上方是否有 restart：若没有，则将当前单元格视为 restart
                merge_src = col_vmerge_restart.get(col)
                if merge_src is None:
                    # 当前列无 restart，将此 continue 提升为 restart
                    vmerge = "restart"
                    cell_info["v_merge"] = "restart"
                else:
                    src_key = merge_src
                    if src_key in merge_map:
                        merge_map[src_key]["row_span"] += 1
                    else:
                        merge_map[src_key] = {
                            "row_span": 2,
                            "col_span": grid_span,
                        }

                    cell_info["_skip"] = True
                    cell_info["row_index"] = ri
                    cell_info["col_index"] = col

                    for dc in range(grid_span):
                        grid[(ri, col + dc)] = cell_info
                    col += grid_span
                    continue

            # 正常单元格或 vMerge restart
            cell_info["row_index"] = ri
            cell_info["col_index"] = col

            # 标记网格占用
            for dc in range(grid_span):
                grid[(ri, col + dc)] = cell_info

            if vmerge == "restart":
                col_vmerge_restart[col] = (ri, col)
                for dc in range(1, grid_span):
                    col_vmerge_restart[col + dc] = (ri, col + dc)

            if grid_span > 1:
                merge_map[(ri, col)] = {"row_span": 1, "col_span": grid_span}

            col += grid_span

    return max_cols, merge_map


def _detect_table_header_rows(all_rows: list[list[dict[str, Any]]]) -> list[int]:
    """检测表头行：首行中有单元格内文本加粗则标记为表头。"""
    if not all_rows:
        return []

    first_row = all_rows[0]
    for cell_info in first_row:
        tc = cell_info["tc_element"]
        # 检查第一个段落的 run 属性是否加粗
        first_p = tc.find(f"{_ns('p')}")
        if first_p is not None:
            first_rPr = first_p.find(f"{_ns('r')}/{_ns('rPr')}")
            if first_rPr is not None:
                b = first_rPr.find(f"{_ns('b')}")
                if b is not None:
                    val = b.get(f"{_ns('val')}")
                    if val != "0" and val != "false":
                        return [0]

    return []


def _detect_nested_tables(tbl_el: etree._Element) -> list[str]:
    """检测表格内是否包含嵌套表格，返回警告信息列表。"""
    warnings: list[str] = []
    for tc in tbl_el.findall(f".//{_ns('tc')}"):
        nested_tbls = tc.findall(f"{_ns('tbl')}")
        if nested_tbls:
            warnings.append("检测到嵌套表格（位于单元格内），已跳过展开解析")
            break  # 不重复报告同一表格中的多次嵌套
    return warnings


def _cell_has_nested_table(tc: etree._Element) -> bool:
    """判断单元格内是否包含嵌套表格。"""
    return len(tc.findall(f"{_ns('tbl')}")) > 0


# ── 节点构建器 ──────────────────────────────────────────────


class _NodeBuilder:
    """构建节点列表并管理临时 ID 映射的辅助类。"""

    def __init__(self) -> None:
        self.nodes: list[dict[str, Any]] = []
        self._counter = 0
        self.table_count = 0

    def next_temp_id(self) -> int:
        self._counter += 1
        return self._counter

    def add_node(
        self,
        node_type: str,
        text: str | None,
        location_path: str,
        style_json: dict[str, Any],
        temp_parent_id: int | None,
        row_index: int | None = None,
        col_index: int | None = None,
    ) -> int:
        """添加节点，返回其临时 ID。"""
        temp_id = self.next_temp_id()
        self.nodes.append({
            "node_type": node_type,
            "text": text,
            "location_path": location_path,
            "style_json": style_json,
            "_temp_id": temp_id,
            "_temp_parent_id": temp_parent_id,
            "row_index": row_index,
            "col_index": col_index,
            "order_index": temp_id,
        })
        return temp_id

    def build(self) -> list[dict[str, Any]]:
        return self.nodes


# ── 主体解析 ────────────────────────────────────────────────


def _process_body_children(
    body: etree._Element,
    doc_root: etree._Element,
    style_map: dict[str, dict[str, Any]],
    builder: _NodeBuilder,
    parent_temp_id: int | None,
) -> None:
    """遍历容器元素（body、sdtContent、tc）的直属子元素并构建节点。"""
    for child in body:
        tag = etree.QName(child).localname
        if tag == "p":
            _process_paragraph(child, doc_root, style_map, builder, parent_temp_id)
        elif tag == "tbl":
            _process_table(child, doc_root, style_map, builder, parent_temp_id)
        elif tag == "sdt":
            _process_sdt(child, doc_root, style_map, builder, parent_temp_id)


def _process_paragraph(
    p_el: etree._Element,
    doc_root: etree._Element,
    style_map: dict[str, dict[str, Any]],
    builder: _NodeBuilder,
    parent_temp_id: int | None,
) -> None:
    """处理单个 w:p 元素。"""
    text = _extract_text(p_el)
    style = _extract_paragraph_style(p_el, style_map)
    location = _make_location_path(p_el, doc_root)

    builder.add_node(
        node_type="paragraph",
        text=text,
        location_path=location,
        style_json=style,
        temp_parent_id=parent_temp_id,
    )


def _process_table(
    tbl_el: etree._Element,
    doc_root: etree._Element,
    style_map: dict[str, dict[str, Any]],
    builder: _NodeBuilder,
    parent_temp_id: int | None,
) -> None:
    """处理 w:tbl 表格元素。

    采用两遍扫描：
    1. 第一遍：提取所有单元格信息，构建网格矩阵，处理合并关系
    2. 第二遍：创建节点（跳过 vMerge continue 单元格），嵌套表格仅记录警告
    """
    builder.table_count += 1
    table_location = _make_location_path(tbl_el, doc_root)

    rows = tbl_el.findall(f"{_ns('tr')}")

    # 第一遍：解析所有单元格信息
    all_rows: list[list[dict[str, Any]]] = []
    for tr in rows:
        row_cells: list[dict[str, Any]] = []
        for tc in tr.findall(f"{_ns('tc')}"):
            row_cells.append(_parse_cell_info(tc))
        all_rows.append(row_cells)

    # 构建网格矩阵和合并映射
    max_cols, merge_map = _build_table_grid(all_rows)

    # 检测表头行和嵌套表格
    header_rows = _detect_table_header_rows(all_rows)
    nested_warnings = _detect_nested_tables(tbl_el)

    # 创建表格节点（含 position 元数据）
    table_tid = builder.add_node(
        node_type="table",
        text=None,
        location_path=table_location,
        style_json={
            "table_index": builder.table_count,
            "row_count": len(rows),
            "col_count": max_cols,
            "header_rows": header_rows,
            "merge_map": {
                f"{r},{c}": merge_map[(r, c)] for r, c in merge_map
            },
            "nested_table_warnings": nested_warnings,
        },
        temp_parent_id=parent_temp_id,
    )

    # 第二遍：创建行和单元格节点
    for tr, row_cells in zip(rows, all_rows):
        row_location = _make_location_path(tr, doc_root)
        row_tid = builder.add_node(
            node_type="row",
            text=None,
            location_path=row_location,
            style_json={},
            temp_parent_id=table_tid,
        )

        for cell_info in row_cells:
            # vMerge continue 单元格不创建独立节点
            if cell_info["_skip"]:
                continue

            cell_tid = builder.add_node(
                node_type="cell",
                text=cell_info["text"],
                location_path=_make_location_path(cell_info["tc_element"], doc_root),
                style_json={
                    "grid_span": cell_info["grid_span"],
                    "v_merge": cell_info["v_merge"],
                },
                temp_parent_id=row_tid,
                row_index=cell_info["row_index"],
                col_index=cell_info["col_index"],
            )

            # 检测嵌套表格：单元格内含嵌套表格时只处理段落，跳过嵌套表格本身
            if _cell_has_nested_table(cell_info["tc_element"]):
                for child in cell_info["tc_element"]:
                    tag = etree.QName(child).localname
                    if tag == "p":
                        _process_paragraph(child, doc_root, style_map, builder, cell_tid)
                    elif tag == "sdt":
                        _process_sdt(child, doc_root, style_map, builder, cell_tid)
            else:
                _process_body_children(cell_info["tc_element"], doc_root, style_map, builder, cell_tid)


def _process_sdt(
    sdt_el: etree._Element,
    doc_root: etree._Element,
    style_map: dict[str, dict[str, Any]],
    builder: _NodeBuilder,
    parent_temp_id: int | None,
) -> None:
    """处理 w:sdt 结构化文档标签，递归处理其 sdtContent 内部内容。"""
    sdtContent = sdt_el.find(f"{_ns('sdtContent')}")
    if sdtContent is None:
        return
    _process_body_children(sdtContent, doc_root, style_map, builder, parent_temp_id)


def _process_header_footer_part(
    xml_content: str,
    part_name: str,
    style_map: dict[str, dict[str, Any]],
    builder: _NodeBuilder,
) -> None:
    """处理页眉/页脚 XML，创建独立分支节点树。"""
    try:
        root = etree.fromstring(xml_content.encode("utf-8"))
    except etree.XMLSyntaxError:
        return

    is_header = "header" in part_name.lower()
    node_type = "header" if is_header else "footer"

    hf_tid = builder.add_node(
        node_type=node_type,
        text=None,
        location_path=part_name,
        style_json={},
        temp_parent_id=None,
    )

    # 处理页眉/页脚根元素下的子元素
    _process_body_children(root, root, style_map, builder, hf_tid)


def parse_docx_structure(
    document_xml: str,
    styles_xml: str | None = None,
    header_footer_parts: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    """解析 DOCX 文档结构，返回完整的 DocumentNode 数据列表。

    每个节点包含 _temp_id（临时自增 ID）和 _temp_parent_id（父节点临时 ID），
    由调用方在数据库插入后负责解析为真实的 parent_node_id。

    Args:
        document_xml: word/document.xml 的内容
        styles_xml: word/styles.xml 的内容（可选，用于解析样式引用）
        header_footer_parts: 页眉/页脚 XML 部件名 → 内容的映射

    Returns:
        DocumentNode 数据字典列表，每个字典包含 _temp_id 和 _temp_parent_id 字段
    """
    style_map = _build_style_map(styles_xml)

    try:
        doc_root = etree.fromstring(document_xml.encode("utf-8"))
    except etree.XMLSyntaxError as e:
        raise ValueError(f"document.xml 解析失败: {e}")

    body = doc_root.find(f"{_ns('body')}")
    if body is None:
        raise ValueError("document.xml 中缺少 w:body 元素")

    builder = _NodeBuilder()

    # 文档根节点
    root_tid = builder.add_node(
        node_type="paragraph",
        text=None,
        location_path="/w:document",
        style_json={},
        temp_parent_id=None,
    )

    # 遍历 body 直属子元素
    _process_body_children(body, doc_root, style_map, builder, root_tid)

    # 处理页眉/页脚
    if header_footer_parts:
        for part_name, xml_content in header_footer_parts.items():
            _process_header_footer_part(xml_content, part_name, style_map, builder)

    return builder.build()
