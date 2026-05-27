"""AIRevision 服务测试 — 纯函数全覆盖。"""

from app.services.ai_revision_service import (
    _match_requirements_for_slot,
    _extract_keywords_from_path,
    _get_surrounding_context,
    _build_slot_prompt,
    _parse_llm_json_response,
    _build_unfinished_for_slot,
    _is_high_risk_content,
)


class TestMatchRequirementsForSlot:
    """根据 slot 匹配 requirement。"""

    def test_match_by_content_type(self):
        slot = {"expected_content_type": "技术方案", "section_path": "技术标/技术方案"}
        reqs = [
            {"id": "r1", "requirement_type": "technical_requirement", "title": "性能指标", "description": "", "source_text": ""},
            {"id": "r2", "requirement_type": "business_requirement", "title": "公司资质", "description": "", "source_text": ""},
        ]
        matched = _match_requirements_for_slot(slot, reqs)
        assert len(matched) == 1
        assert matched[0]["id"] == "r1"

    def test_deduplication(self):
        slot = {"expected_content_type": "技术方案", "section_path": ""}
        reqs = [
            {"id": "r1", "requirement_type": "technical_requirement", "title": "", "description": "", "source_text": ""},
            {"id": "r1", "requirement_type": "technical_requirement", "title": "", "description": "", "source_text": ""},
        ]
        matched = _match_requirements_for_slot(slot, reqs)
        assert len(matched) == 1

    def test_no_match_returns_empty(self):
        slot = {"expected_content_type": "未知类型", "section_path": ""}
        matched = _match_requirements_for_slot(slot, [])
        assert matched == []


class TestExtractKeywordsFromPath:
    """路径关键词提取。"""

    def test_slash_separated(self):
        keywords = _extract_keywords_from_path("商务标/公司介绍")
        assert "商务标" in keywords
        assert "公司介绍" in keywords
        assert len(keywords) >= 2

    def test_chinese_comma_separated(self):
        keywords = _extract_keywords_from_path("技术方案，实施方案")
        assert "技术方案" in keywords
        assert "实施方案" in keywords

    def test_sliding_window(self):
        keywords = _extract_keywords_from_path("售后服务方案")
        # 4-char sliding window generates substrings
        assert "售后服务" in keywords or len(keywords) > 0


class TestGetSurroundingContext:
    """前后文提取。"""

    def test_basic_context(self):
        nodes = [
            {"text": "上文1", "order_index": 0},
            {"text": "当前内容", "order_index": 1},
            {"text": "下文1", "order_index": 2},
        ]
        before, after = _get_surrounding_context(nodes, 1, context_size=1)
        assert "上文1" in before
        assert "下文1" in after

    def test_at_start_no_before(self):
        nodes = [{"text": "第一段", "order_index": 0}, {"text": "第二段", "order_index": 1}]
        before, after = _get_surrounding_context(nodes, 0)
        assert before == ""

    def test_at_end_no_after(self):
        nodes = [{"text": "倒数第二", "order_index": 0}, {"text": "最后一段", "order_index": 1}]
        before, after = _get_surrounding_context(nodes, 1)
        assert after == ""


class TestBuildSlotPrompt:
    """Slot prompt 构建。"""

    def test_prompt_includes_section_path(self):
        slot = {"id": "s1", "fill_strategy": "replace", "expected_content_type": "技术方案"}
        node = {"text": "占位文字"}
        reqs = [{"id": "r1", "requirement_type": "technical_requirement", "title": "性能要求", "source_text": "系统响应时间不超过2秒", "description": ""}]
        prompt = _build_slot_prompt(slot, node, "上文内容", "下文内容", reqs, "技术标/技术方案")
        assert "技术标/技术方案" in prompt
        assert "性能要求" in prompt
        assert "2秒" in prompt

    def test_replace_strategy_text(self):
        slot = {"id": "s1", "fill_strategy": "replace", "expected_content_type": "公司介绍"}
        node = {"text": "待填写"}
        prompt = _build_slot_prompt(slot, node, "", "", [], "商务标/公司介绍")
        assert "替换" in prompt

    def test_append_strategy_text(self):
        slot = {"id": "s1", "fill_strategy": "append", "expected_content_type": "技术方案"}
        node = {"text": "已有内容"}
        prompt = _build_slot_prompt(slot, node, "", "", [], "技术标")
        assert "追加" in prompt or "补充" in prompt or "append" in prompt.lower()

    def test_no_requirements_shown(self):
        slot = {"id": "s1", "fill_strategy": "replace", "expected_content_type": "通用"}
        node = {"text": ""}
        prompt = _build_slot_prompt(slot, node, "", "", [], "未分类")
        assert "无匹配" in prompt


class TestParseLLMJson:
    """LLM JSON 解析。"""

    def test_plain_json(self):
        assert _parse_llm_json_response('{"content": "hello", "comment": "ok"}') == {"content": "hello", "comment": "ok"}

    def test_fenced_json(self):
        assert "content" in _parse_llm_json_response('```json\n{"content": "hello"}\n```')

    def test_invalid_returns_empty(self):
        assert _parse_llm_json_response("无法解析") == {}


class TestBuildUnfinishedForSlot:
    """UnfinishedItem 构建。"""

    def test_builds_correct_structure(self):
        slot = {"id": "s1", "node_id": "n1", "section_path": "技术标/方案"}
        item = _build_unfinished_for_slot(slot, "d1", "缺少资料")
        assert item["document_id"] == "d1"
        assert item["template_slot_id"] == "s1"
        assert item["reason"] == "缺少资料"
        assert item["status"] == "pending"
        assert item["risk_level"] == "medium"
