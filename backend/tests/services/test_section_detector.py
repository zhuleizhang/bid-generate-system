"""章节检测引擎测试。"""

from app.services.section_detector import (
    _match_numbering_pattern,
    _is_paragraph_heading,
    _build_heading_list,
    _assign_nonstandard_levels,
    _build_section_tree,
)


class TestMatchNumberingPattern:
    """编号模式匹配。"""

    def test_chapter_pattern(self):
        assert _match_numbering_pattern("第一章 项目概述") == 1
        assert _match_numbering_pattern("第1章 概述") == 1

    def test_section_pattern(self):
        assert _match_numbering_pattern("第一节 背景") == 2

    def test_chinese_number_pattern(self):
        assert _match_numbering_pattern("一、项目背景") == 1
        assert _match_numbering_pattern("（二）详细说明") == 2

    def test_decimal_numbering(self):
        assert _match_numbering_pattern("1.1 背景") == 2
        assert _match_numbering_pattern("1.1.1 细节") == 3
        assert _match_numbering_pattern("1. 概述") == 1

    def test_no_match(self):
        assert _match_numbering_pattern("这是一个普通段落") is None
        assert _match_numbering_pattern("") is None


class TestIsParagraphHeading:
    """段落标题判断。"""

    def test_standard_heading1(self):
        is_heading, level, method, conf = _is_paragraph_heading({"paragraph_style": "Heading1"})
        assert is_heading is True
        assert level == 1
        assert method == "standard_style"
        assert conf == 1.0

    def test_standard_heading3(self):
        is_heading, level, method, conf = _is_paragraph_heading({"paragraph_style": "heading3"})
        assert is_heading is True
        assert level == 3

    def test_font_size_bold_heading(self):
        is_heading, level, method, conf = _is_paragraph_heading({"font_size": 16, "bold": True})
        assert is_heading is True
        assert method == "font_size_bold"
        assert conf == 0.7

    def test_small_font_not_heading(self):
        is_heading, level, method, conf = _is_paragraph_heading({"font_size": 12, "bold": True})
        assert is_heading is False

    def test_no_bold_not_heading(self):
        is_heading, level, method, conf = _is_paragraph_heading({"font_size": 16})
        assert is_heading is False

    def test_empty_style_not_heading(self):
        is_heading, level, method, conf = _is_paragraph_heading({})
        assert is_heading is False


class TestBuildHeadingList:
    """构建标题候选列表。"""

    def test_identifies_standard_headings(self):
        nodes = [
            {"id": "n1", "node_type": "paragraph", "text": "第一章 概述", "style_json": {"paragraph_style": "Heading1"}, "order_index": 0},
            {"id": "n2", "node_type": "paragraph", "text": "普通段落", "style_json": {}, "order_index": 1},
        ]
        headings = _build_heading_list(nodes)
        assert len(headings) == 1
        assert headings[0]["node_id"] == "n1"

    def test_skips_non_paragraph_nodes(self):
        nodes = [
            {"id": "n1", "node_type": "table", "text": "", "style_json": {}, "order_index": 0},
        ]
        headings = _build_heading_list(nodes)
        assert len(headings) == 0

    def test_skips_empty_text(self):
        nodes = [
            {"id": "n1", "node_type": "paragraph", "text": "   ", "style_json": {"paragraph_style": "Heading1"}, "order_index": 0},
        ]
        headings = _build_heading_list(nodes)
        assert len(headings) == 0


class TestAssignNonstandardLevels:
    """非标准标题层级分配。"""

    def test_numbering_level_overrides(self):
        headings = [
            {"level": None, "method": "font_size_bold", "font_size": 14, "numbering_level": 3},
        ]
        _assign_nonstandard_levels(headings)
        assert headings[0]["level"] == 3

    def test_font_size_based_ordering(self):
        headings = [
            {"level": None, "method": "font_size_bold", "font_size": 16, "numbering_level": None},
            {"level": None, "method": "font_size_bold", "font_size": 14, "numbering_level": None},
        ]
        _assign_nonstandard_levels(headings)
        assert headings[0]["level"] == 1  # largest font
        assert headings[1]["level"] == 2

    def test_standard_headings_untouched(self):
        headings = [
            {"level": 1, "method": "standard_style", "font_size": 16},
        ]
        _assign_nonstandard_levels(headings)
        assert headings[0]["level"] == 1


class TestBuildSectionTree:
    """章节树构建。"""

    def test_simple_hierarchy(self):
        nodes = [
            {"id": "h1", "node_type": "paragraph", "text": "第一章", "order_index": 0},
            {"id": "p1", "node_type": "paragraph", "text": "正文内容", "order_index": 1},
            {"id": "h2", "node_type": "paragraph", "text": "1.1 小节", "order_index": 2},
            {"id": "p2", "node_type": "paragraph", "text": "小节内容", "order_index": 3},
        ]
        headings = [
            {"node_id": "h1", "text": "第一章", "level": 1, "method": "standard_style", "confidence": 1.0, "font_size": 16, "numbering_level": None},
            {"node_id": "h2", "text": "1.1 小节", "level": 2, "method": "standard_style", "confidence": 1.0, "font_size": 14, "numbering_level": None},
        ]
        sections, node_map = _build_section_tree(headings, nodes)
        # 两个 section 都创建了，h2 是 h1 的子节点
        root = [s for s in sections if s.title == "第一章"][0]
        assert root.level == 1
        assert len(root.child_sections) == 1
        assert root.child_sections[0].title == "1.1 小节"
        assert "p1" in node_map
        assert "p2" in node_map

    def test_no_headings(self):
        nodes = [{"id": "p1", "node_type": "paragraph", "text": "内容", "order_index": 0}]
        sections, node_map = _build_section_tree([], nodes)
        assert len(sections) == 0
