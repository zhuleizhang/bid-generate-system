"""LLM 语义分类引擎 — 辅助判断章节和表格的语义类型。

对 template_slots 中的 heading_section 和 table_cell 类型 slot，
调用 LLM 推断 expected_content_type。LLM 调用失败时降级为关键词规则匹配。
"""

import json
import re
from typing import Any

from app.gateway.supabase_gateway import SupabaseGateway
from app.gateway.model_gateway import ModelGateway


# ── 关键词降级规则 ──

SECTION_KEYWORD_RULES: list[tuple[list[str], str]] = [
    (["公司介绍", "企业简介", "公司概况", "单位简介", "投标人简介", "投标人概况"], "公司介绍"),
    (["技术方案", "技术路线", "技术架构", "技术设计", "系统设计", "技术说明"], "技术方案"),
    (["实施计划", "实施方案", "施工方案", "项目计划", "进度计划", "工期安排", "进度安排"], "实施计划"),
    (["售后服务", "运维方案", "维护方案", "技术支持", "服务承诺", "质保"], "售后服务"),
    (["项目案例", "类似业绩", "成功案例", "典型项目", "参考案例", "业绩证明"], "项目案例"),
    (["人员配置", "项目团队", "人员安排", "组织机构", "管理团队", "人员配备"], "人员配置"),
    (["质量管理", "质量保证", "质量体系", "质控措施", "品控"], "质量管理"),
    (["安全管理", "安全生产", "安全措施", "安全方案", "HSE", "职业健康"], "安全管理"),
    (["培训方案", "培训计划", "技术培训", "用户培训"], "培训方案"),
    (["验收方案", "验收标准", "交付方案", "竣工验收"], "验收方案"),
    (["报价", "费用", "价格", "预算", "标价", "金额", "总价"], "报价方案"),
    (["资质", "资格", "证书", "许可", "认证"], "资质证明"),
    (["合同条款", "商务条款", "付款方式", "合同格式"], "商务条款"),
]

TABLE_KEYWORD_RULES: list[tuple[list[str], str]] = [
    (["偏离", "响应", "应答", "响应表", "偏离表"], "响应表"),
    (["报价", "价格", "费用", "金额", "单价", "总价", "合计"], "报价表"),
    (["人员", "姓名", "岗位", "职务", "职责", "成员", "团队"], "人员表"),
    (["案例", "业绩", "项目名称", "合同金额", "业主单位", "完成时间"], "案例表"),
    (["评分", "评审", "得分", "权重", "评价", "分值"], "评分表"),
    (["资质", "证书", "认证", "许可", "资格"], "资质表"),
    (["配置", "参数", "规格", "型号", "技术指标", "性能"], "参数表"),
    (["工期", "进度", "里程碑", "时间节点", "交付", "周期"], "进度表"),
    (["设备", "仪器", "工具", "软件", "硬件", "清单"], "设备清单"),
]


def _classify_by_keywords(text: str, rules: list[tuple[list[str], str]]) -> str | None:
    """根据关键词规则匹配分类，返回匹配到的类型或 None。"""
    if not text:
        return None
    for keywords, category in rules:
        for kw in keywords:
            if kw in text:
                return category
    return None


# ── LLM Prompt 构建 ──


def _build_section_classification_prompt(heading_slots: list[dict[str, Any]]) -> str:
    """构建章节分类 prompt：输入章节标题列表，输出 JSON 映射。"""
    titles: list[dict[str, str]] = []
    for slot in heading_slots:
        content_type = slot.get("expected_content_type") or ""
        section_path = slot.get("section_path") or ""
        titles.append({
            "id": slot["id"],
            "title": content_type,
            "section_path": section_path,
        })

    available_types = [
        "公司介绍", "技术方案", "实施计划", "售后服务", "项目案例",
        "人员配置", "质量管理", "安全管理", "培训方案", "验收方案",
        "报价方案", "资质证明", "商务条款", "其他",
    ]

    return f"""你是一位专业的投标文档分析专家。请分析以下投标模板中的章节标题，判断每个章节的语义类型。

章节列表：
{json.dumps(titles, ensure_ascii=False, indent=2)}

可选语义类型：{', '.join(available_types)}

判断规则：
- "公司介绍"：企业基本情况、资质荣誉、组织架构等
- "技术方案"：技术路线、系统设计、技术架构等
- "实施计划"：施工安排、进度计划、工期安排等
- "售后服务"：运维保障、技术支持、质保承诺等
- "项目案例"：类似项目经验、业绩展示等
- "人员配置"：项目团队、人员安排等
- "质量管理"：质量保证体系、品控措施等
- "安全管理"：安全生产措施、HSE方案等
- "培训方案"：培训计划、用户培训等
- "验收方案"：验收标准、交付验收等
- "报价方案"：报价表、费用说明等
- "资质证明"：企业资质、资格认证等
- "商务条款"：合同条款、付款方式等
- "其他"：不属于以上任何类型

请返回一个 JSON 对象，key 为章节的 id，value 为语义类型。格式如下：
{{"<slot-id>": "类型1", "<slot-id>": "类型2"}}

只返回 JSON，不要包含其他内容。"""


def _build_table_classification_prompt(table_slots: list[dict[str, Any]]) -> str:
    """构建表格分类 prompt：输入表头文本列表，输出 JSON 映射。"""
    table_info: list[dict[str, str]] = []
    for slot in table_slots:
        content_type = slot.get("expected_content_type") or ""
        table_info.append({
            "id": slot["id"],
            "header": content_type,
        })

    available_types = [
        "响应表", "偏离表", "报价表", "人员表", "案例表",
        "评分表", "资质表", "参数表", "进度表", "设备清单", "其他",
    ]

    return f"""你是一位专业的投标文档分析专家。请分析以下投标模板中表格的表头文本，判断每个表格的语义类型。

表格表头信息：
{json.dumps(table_info, ensure_ascii=False, indent=2)}

可选表格类型：{', '.join(available_types)}

判断规则：
- "响应表"：对招标要求逐条响应的表格
- "偏离表"：逐条说明技术/商务偏离情况的表格
- "报价表"：产品/服务报价明细
- "人员表"：项目团队成员名单
- "案例表"：类似项目案例/业绩列表
- "评分表"：评审/评分用的表格
- "资质表"：企业资质证书列表
- "参数表"：设备/产品技术参数
- "进度表"：项目进度/里程碑
- "设备清单"：设备仪器清单
- "其他"：不属于以上任何类型

请返回一个 JSON 对象，key 为表格的 id，value 为表格类型。格式如下：
{{"<slot-id>": "类型1", "<slot-id>": "类型2"}}

只返回 JSON，不要包含其他内容。"""


def _parse_llm_json_response(content: str) -> dict[str, str]:
    """解析 LLM 返回的 JSON 字符串，提取 JSON 对象。"""
    # 尝试直接解析
    try:
        result = json.loads(content)
        if isinstance(result, dict):
            return {k: str(v) for k, v in result.items()}
    except json.JSONDecodeError:
        pass

    # 尝试提取 JSON 块（```json ... ``` 或 ``` ... ```）
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
    if m:
        try:
            result = json.loads(m.group(1))
            if isinstance(result, dict):
                return {k: str(v) for k, v in result.items()}
        except json.JSONDecodeError:
            pass

    # 尝试匹配 { ... }
    m = re.search(r"\{[\s\S]*\}", content)
    if m:
        try:
            result = json.loads(m.group(0))
            if isinstance(result, dict):
                return {k: str(v) for k, v in result.items()}
        except json.JSONDecodeError:
            pass

    return {}


async def classify_template_slots(doc_id: str) -> dict[str, Any]:
    """对文档的所有 heading_section 和 table_cell 类型 slot 进行语义分类。

    先尝试 LLM 分类，失败时降级为关键词规则匹配。
    分类结果回写到 template_slots.expected_content_type。
    """
    gw = SupabaseGateway()
    mgw = ModelGateway()

    doc = gw.get_document(doc_id)
    if not doc:
        raise ValueError(f"文档不存在: {doc_id}")

    slots = gw.get_template_slots(doc_id)
    if not slots:
        raise ValueError("文档尚未生成 TemplateSlot，请先调用 /generate-slots 端点")

    # 分类待处理的 slot
    heading_slots = [s for s in slots if s["slot_type"] == "heading_section"]
    table_slots = [
        s for s in slots if s["slot_type"] == "table_cell"
    ]

    llm_classified: dict[str, str] = {}
    keyword_classified: dict[str, str] = {}

    # ── 章节分类 ──
    if heading_slots:
        llm_result = await _classify_headings_llm(heading_slots, mgw, gw)
        for slot_id, category in llm_result.items():
            llm_classified[slot_id] = category

        # 降级：LLM 未能分类的用关键词规则
        remaining = [s for s in heading_slots if s["id"] not in llm_classified]
        for slot in remaining:
            text = (slot.get("expected_content_type") or "") + " " + (slot.get("section_path") or "")
            fallback = _classify_by_keywords(text, SECTION_KEYWORD_RULES)
            if fallback:
                keyword_classified[slot["id"]] = fallback

    # ── 表格分类 ──
    if table_slots:
        llm_result = await _classify_tables_llm(table_slots, mgw, gw)
        for slot_id, category in llm_result.items():
            llm_classified[slot_id] = category

        remaining = [s for s in table_slots if s["id"] not in llm_classified]
        for slot in table_slots:
            text = (slot.get("expected_content_type") or "")
            fallback = _classify_by_keywords(text, TABLE_KEYWORD_RULES)
            if fallback:
                keyword_classified[slot["id"]] = fallback

    # ── 回写分类结果 ──
    all_classified = {**keyword_classified, **llm_classified}
    for slot in slots:
        slot_id = slot["id"]
        if slot_id in all_classified:
            new_type = all_classified[slot_id]
            if slot.get("expected_content_type") != new_type:
                gw.update_template_slot_content_type(slot_id, new_type)

    return {
        "document_id": doc_id,
        "total_slots": len(slots),
        "heading_slots_count": len(heading_slots),
        "table_slots_count": len(table_slots),
        "llm_classified": len(llm_classified),
        "keyword_classified": len(keyword_classified),
    }


async def _classify_headings_llm(
    slots: list[dict[str, Any]],
    mgw: ModelGateway,
    gw: SupabaseGateway,
) -> dict[str, str]:
    """通过 LLM 对章节标题进行分类。"""
    prompt = _build_section_classification_prompt(slots)
    messages = [
        {"role": "system", "content": "你是一个精确的 JSON 输出助手，只返回要求的 JSON 格式。"},
        {"role": "user", "content": prompt},
    ]

    result = await mgw.chat_completion(messages, temperature=0.3, max_tokens=1024)
    call_log = mgw.build_call_log(
        scenario="semantic_classification",
        result=result,
        request_json={"type": "section_classification", "slot_count": len(slots)},
    )
    gw.insert_model_call_log(call_log)

    if result["content"] and not result["error"]:
        return _parse_llm_json_response(result["content"])

    return {}


async def _classify_tables_llm(
    slots: list[dict[str, Any]],
    mgw: ModelGateway,
    gw: SupabaseGateway,
) -> dict[str, str]:
    """通过 LLM 对表格进行分类。"""
    prompt = _build_table_classification_prompt(slots)
    messages = [
        {"role": "system", "content": "你是一个精确的 JSON 输出助手，只返回要求的 JSON 格式。"},
        {"role": "user", "content": prompt},
    ]

    result = await mgw.chat_completion(messages, temperature=0.3, max_tokens=1024)
    call_log = mgw.build_call_log(
        scenario="semantic_classification",
        result=result,
        request_json={"type": "table_classification", "slot_count": len(slots)},
    )
    gw.insert_model_call_log(call_log)

    if result["content"] and not result["error"]:
        return _parse_llm_json_response(result["content"])

    return {}
