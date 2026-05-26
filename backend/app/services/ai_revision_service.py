"""AIRevision 生成引擎 — 调用 LLM 在模板的正确位置生成标书修订内容。

输入：文档 ID（需已完成 parse → slots → classify-slots）
输出：结构化 AIRevision 列表，写入 ai_revisions 表。
无法生成的位置自动创建 UnfinishedItem。
"""

import json
import re
from collections import defaultdict
from typing import Any

from app.gateway.supabase_gateway import SupabaseGateway
from app.gateway.model_gateway import ModelGateway

# expected_content_type 与 requirement_type 的语义匹配规则
_CONTENT_TO_REQUIREMENT_MAP = {
    "公司介绍": ["business_requirement"],
    "公司概况": ["business_requirement"],
    "企业简介": ["business_requirement"],
    "技术方案": ["technical_requirement"],
    "技术路线": ["technical_requirement"],
    "实施方案": ["technical_requirement", "delivery_requirement"],
    "实施计划": ["delivery_requirement"],
    "进度计划": ["delivery_requirement"],
    "售后服务": ["technical_requirement"],
    "服务方案": ["technical_requirement"],
    "项目案例": ["business_requirement"],
    "案例": ["business_requirement"],
    "人员": ["qualification_requirement"],
    "人员配置": ["qualification_requirement"],
    "资质": ["qualification_requirement"],
    "资质证书": ["qualification_requirement"],
    "报价": ["business_requirement"],
    "偏离表": ["technical_requirement"],
    "技术偏离": ["technical_requirement"],
    "商务偏离": ["business_requirement"],
    "响应表": ["technical_requirement", "format_requirement"],
    "格式": ["format_requirement"],
    "评分": ["scoring_criteria"],
}

# 内容涉及以下关键词时自动标记高风险
_HIGH_RISK_KEYWORDS = ["资质", "报价", "案例", "承诺", "证书", "许可"]


def _match_requirements_for_slot(
    slot: dict[str, Any],
    requirements: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """根据 slot 的 expected_content_type 和 section_path 匹配相关 requirements。"""
    content_type = (slot.get("expected_content_type") or "").strip()
    section_path = (slot.get("section_path") or "").strip()

    target_types = _CONTENT_TO_REQUIREMENT_MAP.get(content_type, [])

    matched: list[dict[str, Any]] = []
    for req in requirements:
        req_type = req.get("requirement_type", "")
        req_title = req.get("title", "")

        if target_types and req_type in target_types:
            matched.append(req)
            continue

        # section_path 关键词匹配
        if section_path:
            for keyword in _extract_keywords_from_path(section_path):
                if keyword in req_title:
                    matched.append(req)
                    break

    # 去重
    seen_ids = set()
    unique = []
    for r in matched:
        rid = r.get("id", "")
        if rid not in seen_ids:
            seen_ids.add(rid)
            unique.append(r)
    return unique


def _extract_keywords_from_path(section_path: str) -> list[str]:
    """从 section_path 中提取中文关键词。"""
    keywords: list[str] = []
    # 用 / 和常见分隔符拆分
    parts = re.split(r"[/\\、，,]", section_path)
    for part in parts:
        part = part.strip()
        if len(part) >= 2:
            keywords.append(part)
            # 进一步拆分为 2-3 字滑动窗口
            if len(part) >= 4:
                for i in range(len(part) - 1):
                    chunk = part[i : i + 3]
                    if len(chunk) >= 2:
                        keywords.append(chunk)
    return list(set(keywords))


def _get_surrounding_context(
    nodes: list[dict[str, Any]],
    current_index: int,
    context_size: int = 2,
) -> tuple[str, str]:
    """获取当前节点的前后文段落文本。"""
    before_parts: list[str] = []
    for i in range(max(0, current_index - context_size), current_index):
        text = nodes[i].get("text", "").strip()
        if text:
            before_parts.append(text)

    after_parts: list[str] = []
    for i in range(current_index + 1, min(len(nodes), current_index + context_size + 1)):
        text = nodes[i].get("text", "").strip()
        if text:
            after_parts.append(text)

    return "\n".join(before_parts), "\n".join(after_parts)


def _build_slot_prompt(
    slot: dict[str, Any],
    node: dict[str, Any],
    before_context: str,
    after_context: str,
    requirements: list[dict[str, Any]],
    section_path: str,
) -> str:
    """为单个 slot 构建 LLM 生成 prompt。"""
    fill_strategy = slot.get("fill_strategy", "replace")
    expected_type = slot.get("expected_content_type") or "通用内容"
    node_text = node.get("text", "")

    # 构建要求摘要
    req_summary_parts: list[str] = []
    for i, req in enumerate(requirements[:10], 1):
        req_summary_parts.append(
            f"{i}. [{req.get('requirement_type', '')}] {req.get('title', '')}\n"
            f"   原文: {req.get('source_text', req.get('description', ''))[:200]}"
        )
    req_summary = "\n".join(req_summary_parts) if req_summary_parts else "无匹配的招标要求"

    strategy_desc = {
        "replace": "替换当前位置的占位符或提示词文本",
        "append": "在当前位置末尾追加新内容",
        "cell_fill": "填充表格单元格内容",
        "section_append": "在章节末尾新增一段内容",
    }.get(fill_strategy, "在当前位置生成内容")

    return f"""你是一位专业的投标文档撰写专家。请根据招标要求，在投标模板的指定位置生成合适的标书内容。

## 当前位置信息
- 所属章节: {section_path or "未分类"}
- 内容类型: {expected_type}
- 填充策略: {strategy_desc}
- 当前文本: "{node_text}"（需要{'替换' if fill_strategy == 'replace' else '补充'}的内容）

## 上下文
上文段落:
{before_context or "（无上文）"}

下文段落:
{after_context or "（无下文）"}

## 匹配的招标要求
{req_summary}

## 生成要求
1. 生成的内容应专业、具体，符合投标文档的正式语体
2. 内容长度适中 — 一般 50-300 字，表格单元格可更短（20-80 字）
3. 如无法生成合适内容（缺少关键信息），返回空字符串
4. 涉及资质、证书、报价、承诺的内容，如无确切数据则返回空字符串
5. 不要编造具体的数字、日期、人名，除非招标要求中有明确依据

## 输出格式
返回纯 JSON，格式如下：
{{"content": "生成的内容", "comment": "生成说明（可选，20字以内）"}}

只返回 JSON，不要包含其他内容。"""


def _parse_llm_json_response(content: str) -> dict[str, Any]:
    """解析 LLM 返回的 JSON 字符串，兼容各种包裹格式。"""
    try:
        result = json.loads(content)
        if isinstance(result, dict):
            return result
    except json.JSONDecodeError:
        pass

    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
    if m:
        try:
            result = json.loads(m.group(1))
            if isinstance(result, dict):
                return result
        except json.JSONDecodeError:
            pass

    m = re.search(r"\{[\s\S]*\}", content)
    if m:
        try:
            result = json.loads(m.group(0))
            if isinstance(result, dict):
                return result
        except json.JSONDecodeError:
            pass

    return {}


def _is_high_risk_content(text: str, expected_type: str) -> bool:
    """判断生成内容是否涉及高风险领域。"""
    combined = text + expected_type
    return any(kw in combined for kw in _HIGH_RISK_KEYWORDS)


def _build_unfinished_for_slot(
    slot: dict[str, Any],
    document_id: str,
    reason: str,
) -> dict[str, Any]:
    """为无法生成的 slot 构建 UnfinishedItem 数据。"""
    return {
        "document_id": document_id,
        "node_id": slot.get("node_id"),
        "template_slot_id": slot.get("id"),
        "item_type": "low_confidence",
        "section_path": slot.get("section_path", ""),
        "reason": reason,
        "impact": "该位置需要人工填写",
        "risk_level": "medium",
        "suggested_action": "请手动填写该位置的内容，或补充相关资料后重新生成",
        "status": "pending",
    }


async def generate_ai_revisions(doc_id: str) -> dict[str, Any]:
    """为指定文档的全部 TemplateSlot 生成 AIRevision。

    前提：文档需已完成 parse → generate-slots → classify-slots。
    每条 slot 调用 LLM 生成填充内容，写入 ai_revisions 表。
    无法生成的位置自动创建 UnfinishedItem。
    """
    gw = SupabaseGateway()
    mgw = ModelGateway()

    doc = gw.get_document(doc_id)
    if not doc:
        raise ValueError(f"文档不存在: {doc_id}")

    project_id = doc.get("project_id", "")
    if not project_id:
        raise ValueError("文档未关联到任何项目")

    # 获取 slots（按 section_path 排序）
    slots = gw.get_template_slots(doc_id)
    if not slots:
        return {
            "document_id": doc_id,
            "project_id": project_id,
            "status": "success",
            "total_revisions": 0,
            "total_slots": 0,
            "revisions": [],
            "unfinished_count": 0,
            "llm_model": mgw.default_model,
            "llm_tokens": 0,
        }

    # 按 section_path 分组
    slots_by_section: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for s in slots:
        sp = s.get("section_path", "") or "未分类"
        slots_by_section[sp].append(s)

    # 获取节点映射（node_id → node）
    nodes = gw.get_document_nodes(doc_id)
    node_map = {n["id"]: n for n in nodes}
    # node_id → order_index 快速查找
    node_index_map = {n["id"]: i for i, n in enumerate(nodes)}

    # 获取项目要求
    requirements = gw.get_requirements(project_id)

    # 清除旧的 AIRevision 和 UnfinishedItem
    gw.delete_ai_revisions(doc_id)
    gw.delete_unfinished_items(doc_id)

    all_revisions: list[dict[str, Any]] = []
    all_unfinished: list[dict[str, Any]] = []
    total_tokens = 0
    llm_model = mgw.default_model
    llm_calls = 0

    # 逐 section 批量处理（每 section 一次 LLM 调用，避免 prompt 过长）
    for section_path, section_slots in slots_by_section.items():
        # 每批最多 5 个 slot，避免单次 prompt 太长
        batch_size = 5
        for batch_start in range(0, len(section_slots), batch_size):
            batch = section_slots[batch_start : batch_start + batch_size]

            # 为每个 slot 构建 prompt 并组装批量请求
            batch_prompts: list[str] = []
            for slot in batch:
                node = node_map.get(slot["node_id"]) or {}
                node_idx = node_index_map.get(slot["node_id"], 0)
                before_ctx, after_ctx = _get_surrounding_context(nodes, node_idx)
                matched_reqs = _match_requirements_for_slot(slot, requirements)

                prompt = _build_slot_prompt(
                    slot, node, before_ctx, after_ctx, matched_reqs, section_path,
                )
                batch_prompts.append(prompt)

            # 如果只有一个 slot，直接调用；多个则合并 prompt
            if len(batch_prompts) == 1:
                final_prompt = batch_prompts[0]
            else:
                final_prompt = "\n\n---\n\n".join(
                    f"## 位置 {i + 1}\n{p}" for i, p in enumerate(batch_prompts)
                )
                final_prompt += "\n\n## 输出格式\n返回纯 JSON 数组，每个位置一个元素：\n[{\"content\": \"...\", \"comment\": \"...\"}, ...]\n只返回 JSON，不要包含其他内容。"

            messages = [
                {"role": "system", "content": "你是一个精确的 JSON 输出助手，只返回要求的 JSON 格式，不输出任何额外内容。"},
                {"role": "user", "content": final_prompt},
            ]

            result = await mgw.chat_completion(messages, temperature=0.3, max_tokens=2048)
            total_tokens += result["total_tokens"]
            llm_model = result["model"]
            llm_calls += 1

            call_log = mgw.build_call_log(
                scenario="generation",
                result=result,
                request_json={
                    "document_id": doc_id,
                    "section_path": section_path,
                    "slot_count": len(batch),
                    "slot_ids": [s["id"] for s in batch],
                },
            )
            gw.insert_model_call_log(call_log)

            # 解析 LLM 响应
            generated_contents: list[dict[str, Any]] = []
            if result["content"] and not result["error"]:
                parsed = _parse_llm_json_response(result["content"])
                if isinstance(parsed, list):
                    generated_contents = parsed
                elif isinstance(parsed, dict) and "content" in parsed:
                    generated_contents = [parsed]
                else:
                    # 解析失败，所有 slot 标记为无法生成
                    pass

            # 为每个 slot 创建 AIRevision
            for i, slot in enumerate(batch):
                slot_node: dict[str, Any] = node_map.get(slot["node_id"]) or {}
                before_content = slot_node.get("text", "")
                slot_type = slot.get("slot_type", "paragraph")

                gen = generated_contents[i] if i < len(generated_contents) else {}
                ai_content = gen.get("content", "").strip()
                comment = gen.get("comment", "").strip()

                if not ai_content:
                    # 无法生成 → UnfinishedItem
                    all_unfinished.append(
                        _build_unfinished_for_slot(slot, doc_id, "LLM 无法生成合适内容，可能缺少匹配的招标要求或关键信息不足")
                    )
                    continue

                # 确定 revision_type
                fill_strategy = slot.get("fill_strategy", "replace")
                if fill_strategy in ("section_append",):
                    revision_type = "new_section"
                elif fill_strategy in ("append",):
                    revision_type = "append"
                else:
                    revision_type = "replace"

                # 风险判断
                expected_type = slot.get("expected_content_type") or ""
                is_high_risk = _is_high_risk_content(ai_content, expected_type)
                risk_level = "high" if is_high_risk else "medium"
                status = "need_human_confirm" if is_high_risk else "pending"
                confidence = slot.get("confidence", 0.7)

                # 匹配的 requirement IDs
                matched_reqs = _match_requirements_for_slot(slot, requirements)
                source_req_ids = [r["id"] for r in matched_reqs]

                revision_data = {
                    "document_id": doc_id,
                    "node_id": slot["node_id"],
                    "template_slot_id": slot["id"],
                    "revision_type": revision_type,
                    "before_content": before_content,
                    "ai_content": ai_content,
                    "comment": comment,
                    "source_requirement_ids": source_req_ids,
                    "related_experience_ids": [],
                    "risk_level": risk_level,
                    "confidence": round(confidence, 2),
                    "status": status,
                    "metadata": {
                        "section_path": section_path,
                        "slot_type": slot_type,
                        "expected_content_type": expected_type,
                        "fill_strategy": fill_strategy,
                    },
                }
                all_revisions.append(revision_data)

    # 批量写入
    inserted_revisions = gw.insert_ai_revisions(all_revisions) if all_revisions else []
    if all_unfinished:
        gw.insert_unfinished_items(all_unfinished)

    # 构造响应
    revision_responses = []
    for r in inserted_revisions:
        revision_responses.append({
            "id": r["id"],
            "document_id": r["document_id"],
            "node_id": r["node_id"],
            "template_slot_id": r.get("template_slot_id"),
            "revision_type": r["revision_type"],
            "before_content": r.get("before_content"),
            "ai_content": r.get("ai_content"),
            "comment": r.get("comment"),
            "source_requirement_ids": r.get("source_requirement_ids", []),
            "related_experience_ids": r.get("related_experience_ids", []),
            "risk_level": r["risk_level"],
            "confidence": r["confidence"],
            "status": r["status"],
            "metadata": r.get("metadata", {}),
            "created_at": r.get("created_at", ""),
            "updated_at": r.get("updated_at", ""),
        })

    status = "success"
    if not all_revisions and all_unfinished:
        status = "failed"
    elif all_unfinished:
        status = "partial"

    return {
        "document_id": doc_id,
        "project_id": project_id,
        "status": status,
        "total_revisions": len(inserted_revisions),
        "total_slots": len(slots),
        "revisions": revision_responses,
        "unfinished_count": len(all_unfinished),
        "llm_model": llm_model,
        "llm_tokens": total_tokens,
    }
