"""DOCX 解析引擎测试 — 覆盖纯函数和结构解析逻辑。"""

import pytest
from lxml import etree

from app.services.docx_parser import (
    _ns,
    _build_style_map,
    _extract_run_props,
    _extract_text,
    _parse_cell_info,
    _detect_table_header_rows,
    _detect_nested_tables,
    _cell_has_nested_table,
    _build_table_grid,
    NSMAP,
)


W_NS = NSMAP["w"]


def _make_paragraph(text: str, bold: bool = False) -> etree._Element:
    """创建测试用 w:p 元素。"""
    p = etree.Element(f"{{{W_NS}}}p")
    r = etree.SubElement(p, f"{{{W_NS}}}r")
    if bold:
        rPr = etree.SubElement(r, f"{{{W_NS}}}rPr")
        etree.SubElement(rPr, f"{{{W_NS}}}b")
    t = etree.SubElement(r, f"{{{W_NS}}}t")
    t.text = text
    return p


def _make_tc(text: str = "", bold: bool = False, grid_span: int = 1) -> etree._Element:
    """创建测试用 w:tc 单元格。"""
    tc = etree.Element(f"{{{W_NS}}}tc")
    if grid_span > 1:
        tcPr = etree.SubElement(tc, f"{{{W_NS}}}tcPr")
        gs = etree.SubElement(tcPr, f"{{{W_NS}}}gridSpan")
        gs.set(f"{{{W_NS}}}val", str(grid_span))
    if text:
        p = etree.SubElement(tc, f"{{{W_NS}}}p")
        r = etree.SubElement(p, f"{{{W_NS}}}r")
        if bold:
            rPr = etree.SubElement(r, f"{{{W_NS}}}rPr")
            etree.SubElement(rPr, f"{{{W_NS}}}b")
        t = etree.SubElement(r, f"{{{W_NS}}}t")
        t.text = text
    return tc


class TestNs:
    """命名空间工具。"""

    def test_ns_produces_qualified_tag(self):
        tag = _ns("p")
        assert tag.endswith("}p")

    def test_ns_uses_w_namespace(self):
        tag = _ns("body")
        assert NSMAP["w"] in tag


class TestBuildStyleMap:
    """styles.xml 解析。"""

    def test_empty_styles_xml_returns_empty_dict(self):
        assert _build_style_map(None) == {}
        assert _build_style_map("") == {}

    def test_invalid_xml_returns_empty(self):
        assert _build_style_map("<invalid>") == {}

    def test_parse_valid_styles(self):
        xml = f"""<?xml version="1.0"?>
        <w:styles xmlns:w="{NSMAP['w']}">
            <w:style w:styleId="Heading1">
                <w:name w:val="heading 1"/>
                <w:rPr>
                    <w:rFonts w:ascii="SimHei"/>
                    <w:sz w:val="32"/>
                    <w:b/>
                </w:rPr>
            </w:style>
        </w:styles>"""
        result = _build_style_map(xml)
        assert "Heading1" in result
        assert result["Heading1"]["font_name"] == "SimHei"
        assert result["Heading1"]["font_size"] == 16.0
        assert result["Heading1"]["bold"] is True


class TestExtractRunProps:
    """run properties 提取。"""

    def test_extract_font_name(self):
        rPr = etree.Element(f"{{{W_NS}}}rPr")
        rFonts = etree.SubElement(rPr, f"{{{W_NS}}}rFonts")
        rFonts.set(f"{{{W_NS}}}ascii", "Arial")
        target = {}
        _extract_run_props(rPr, target)
        assert target["font_name"] == "Arial"

    def test_extract_font_size(self):
        rPr = etree.Element(f"{{{W_NS}}}rPr")
        sz = etree.SubElement(rPr, f"{{{W_NS}}}sz")
        sz.set(f"{{{W_NS}}}val", "24")
        target = {}
        _extract_run_props(rPr, target)
        assert target["font_size"] == 12.0

    def test_extract_bold(self):
        rPr = etree.Element(f"{{{W_NS}}}rPr")
        etree.SubElement(rPr, f"{{{W_NS}}}b")
        target = {}
        _extract_run_props(rPr, target)
        assert target["bold"] is True

    def test_bold_with_val_false(self):
        rPr = etree.Element(f"{{{W_NS}}}rPr")
        b = etree.SubElement(rPr, f"{{{W_NS}}}b")
        b.set(f"{{{W_NS}}}val", "false")
        target = {}
        _extract_run_props(rPr, target)
        assert target.get("bold") is not True


class TestExtractText:
    """段落文本提取。"""

    def test_simple_text(self):
        p = _make_paragraph("Hello World")
        assert _extract_text(p) == "Hello World"

    def test_multi_run_text(self):
        p = etree.Element(f"{{{W_NS}}}p")
        for word in ["Hello", " ", "World"]:
            r = etree.SubElement(p, f"{{{W_NS}}}r")
            t = etree.SubElement(r, f"{{{W_NS}}}t")
            t.text = word
        assert _extract_text(p) == "Hello World"

    def test_empty_paragraph(self):
        p = _make_paragraph("")
        assert _extract_text(p) == ""


class TestParseCellInfo:
    """单元格信息解析。"""

    def test_default_cell(self):
        tc = _make_tc("content")
        info = _parse_cell_info(tc)
        assert info["grid_span"] == 1
        assert info["v_merge"] == "none"
        assert info["text"] == "content"

    def test_grid_span_cell(self):
        tc = _make_tc("", grid_span=3)
        info = _parse_cell_info(tc)
        assert info["grid_span"] == 3


class TestBuildTableGrid:
    """表格网格矩阵。"""

    def test_simple_grid(self):
        all_rows = [[_parse_cell_info(_make_tc("A")), _parse_cell_info(_make_tc("B"))]]
        max_cols, merge_map = _build_table_grid(all_rows)
        assert max_cols == 2
        assert len(merge_map) == 0

    def test_grid_span_creates_merge_map(self):
        all_rows = [[_parse_cell_info(_make_tc("A", grid_span=2)), _parse_cell_info(_make_tc("B"))]]
        max_cols, merge_map = _build_table_grid(all_rows)
        assert max_cols == 3
        assert (0, 0) in merge_map
        assert merge_map[(0, 0)]["col_span"] == 2

    def test_empty_rows_returns_zero(self):
        max_cols, merge_map = _build_table_grid([])
        assert max_cols == 0
        assert merge_map == {}


class TestDetectHeaderRows:
    """表头行检测。"""

    def test_bold_first_row_is_header(self):
        all_rows = [[_parse_cell_info(_make_tc("Title", bold=True))]]
        assert _detect_table_header_rows(all_rows) == [0]

    def test_no_bold_no_header(self):
        all_rows = [[_parse_cell_info(_make_tc("Title", bold=False))]]
        assert _detect_table_header_rows(all_rows) == []

    def test_empty_rows(self):
        assert _detect_table_header_rows([]) == []


class TestDetectNestedTables:
    """嵌套表格检测。"""

    def test_no_nested(self):
        tbl = etree.Element(f"{{{W_NS}}}tbl")
        tc = etree.SubElement(tbl, f"{{{W_NS}}}tc")
        assert _detect_nested_tables(tbl) == []

    def test_has_nested(self):
        tbl = etree.Element(f"{{{W_NS}}}tbl")
        tc = etree.SubElement(tbl, f"{{{W_NS}}}tc")
        etree.SubElement(tc, f"{{{W_NS}}}tbl")
        assert len(_detect_nested_tables(tbl)) == 1


class TestCellHasNestedTable:
    """单元格嵌套检测。"""

    def test_no_nested(self):
        tc = _make_tc("text")
        assert _cell_has_nested_table(tc) is False

    def test_has_nested(self):
        tc = etree.Element(f"{{{W_NS}}}tc")
        etree.SubElement(tc, f"{{{W_NS}}}tbl")
        assert _cell_has_nested_table(tc) is True
