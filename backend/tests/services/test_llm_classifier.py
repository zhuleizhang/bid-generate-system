"""LLM 分类引擎测试 — 关键词降级规则和 JSON 解析。"""

from app.services.llm_classifier_service import (
    _classify_by_keywords,
    _parse_llm_json_response,
    _build_section_classification_prompt,
    _build_table_classification_prompt,
    SECTION_KEYWORD_RULES,
    TABLE_KEYWORD_RULES,
)


class TestClassifyByKeywords:
    """关键词规则降级分类。"""

    def test_section_classification(self):
        assert _classify_by_keywords("这是关于公司介绍和资质的内容", SECTION_KEYWORD_RULES) == "公司介绍"

    def test_technical_solution(self):
        assert _classify_by_keywords("技术方案设计说明", SECTION_KEYWORD_RULES) == "技术方案"

    def test_after_sales(self):
        assert _classify_by_keywords("售后服务和运维方案", SECTION_KEYWORD_RULES) == "售后服务"

    def test_table_response_table(self):
        assert _classify_by_keywords("技术偏离响应表", TABLE_KEYWORD_RULES) == "响应表"

    def test_table_price(self):
        assert _classify_by_keywords("报价明细表", TABLE_KEYWORD_RULES) == "报价表"

    def test_no_match_returns_none(self):
        assert _classify_by_keywords("未知内容", SECTION_KEYWORD_RULES) is None

    def test_empty_text_returns_none(self):
        assert _classify_by_keywords("", SECTION_KEYWORD_RULES) is None
        assert _classify_by_keywords(None, SECTION_KEYWORD_RULES) is None


class TestParseLLMJsonResponse:
    """LLM JSON 响应解析。"""

    def test_plain_json(self):
        result = _parse_llm_json_response('{"s1": "技术方案", "s2": "公司介绍"}')
        assert result == {"s1": "技术方案", "s2": "公司介绍"}

    def test_json_with_markdown_fence(self):
        result = _parse_llm_json_response('```json\n{"s1": "技术方案"}\n```')
        assert result == {"s1": "技术方案"}

    def test_json_with_simple_fence(self):
        result = _parse_llm_json_response('```\n{"s1": "技术方案"}\n```')
        assert result == {"s1": "技术方案"}

    def test_embedded_json(self):
        result = _parse_llm_json_response('以下是分类结果：{"s1": "公司介绍"}，请确认')
        assert result == {"s1": "公司介绍"}

    def test_invalid_returns_empty(self):
        assert _parse_llm_json_response("无法分析") == {}

    def test_non_dict_returns_empty(self):
        assert _parse_llm_json_response("[1, 2, 3]") == {}


class TestBuildPrompts:
    """Prompt 构建。"""

    def test_section_classification_prompt(self):
        slots = [
            {"id": "s1", "expected_content_type": "公司介绍", "section_path": "商务标/公司介绍"},
        ]
        prompt = _build_section_classification_prompt(slots)
        assert "公司介绍" in prompt
        assert "s1" in prompt
        assert "投标文档分析专家" in prompt

    def test_table_classification_prompt(self):
        slots = [
            {"id": "t1", "expected_content_type": "响应表"},
        ]
        prompt = _build_table_classification_prompt(slots)
        assert "响应表" in prompt
        assert "t1" in prompt
        assert "投标文档分析专家" in prompt
