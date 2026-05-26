"""招标要求提取引擎 — 调用 LLM 从解析后的招标文件中提取结构化要求。

输入：文档 ID（需已完成 parse-tender 解析）
输出：结构化 requirements 列表，写入 requirements 表。
"""

import json
import re
from typing import Any

from app.gateway.supabase_gateway import SupabaseGateway
from app.gateway.model_gateway import ModelGateway

# 各 requirement_type 的中文标签
_REQUIREMENT_TYPE_LABELS = {
    "project_basic_info": "项目基本信息",
    "business_requirement": "商务要求",
    "technical_requirement": "技术要求",
    "scoring_criteria": "评分标准",
    "disqualification_item": "废标项",
    "qualification_requirement": "资质要求",
    "delivery_requirement": "交付要求",
    "format_requirement": "格式要求",
}


def _build_extraction_prompt(full_text: str, sections: list[dict[str, Any]]) -> str:
    """构建招标要求提取 prompt，包含文档全文和章节结构。"""
    section_summary_parts: list[str] = []
    for s in sections:
        title = s.get("title", "")
        level = s.get("level", 0)
        indent = "  " * max(level - 1, 0)
        section_summary_parts.append(f"{indent}- [{level}] {title}")

    section_summary = "\n".join(section_summary_parts[:80])

    # 截取全文前 12000 字符，避免超出 token 限制
    text_snippet = full_text[:12000]
    if len(full_text) > 12000:
        text_snippet += f"\n\n... （全文共 {len(full_text)} 字符，以上为前 12000 字符）"

    type_desc_parts = [f'"{k}": {v}' for k, v in _REQUIREMENT_TYPE_LABELS.items()]
    type_desc = "\n".join(type_desc_parts)

    return f"""你是一位专业的投标分析专家。请从以下招标文件中提取所有关键要求，输出为结构化 JSON。

## 文档章节结构
{section_summary}

## 招标文件全文
{text_snippet}

## 要提取的要求类型
{type_desc}

## 提取规则
- "project_basic_info"：项目名称、招标单位、预算金额、建设地点、工期、质保期等基本信息
- "business_requirement"：投标人资格、业绩要求、财务状况、商务条款等
- "technical_requirement"：技术方案、系统功能、性能指标、技术标准等
- "scoring_criteria"：评审办法、评分项、分值分配、评标标准等
- "disqualification_item"：废标条件、无效投标情形。这些要求 is_mandatory=true, risk_level="blocking"
- "qualification_requirement"：资质证书、许可证、认证要求等
- "delivery_requirement"：交付物、交付时间、验收标准、交付方式等
- "format_requirement"：投标文件格式、装订要求、签字盖章、份数要求等

## 提取要点
1. 每条要求包含 title（简短概括）、description（详细描述）、source_text（原文摘录）
2. priority 分级：对中标影响重大 → high，一般要求 → medium，次要或参考性 → low
3. 明确标注"必须""不得""应"等强制字眼的要求，is_mandatory=true
4. is_mandatory=true 的要求，risk_level 应为 "high"
5. 废标项（disqualification_item）的 risk_level 必须为 "blocking"
6. 评分标准中分值较高的项，priority 应设为 high
7. 每条要求的 source_text 尽量引用原文，保持原文措辞
8. 不要遗漏任何明确列出的要求，宁可多提取也不要漏掉

## 输出格式
返回纯 JSON，格式如下：
{{
  "requirements": [
    {{
      "requirement_type": "technical_requirement",
      "title": "系统需支持XXX功能",
      "description": "投标人提供的系统应具备XXX功能的详细说明",
      "priority": "high",
      "is_mandatory": true,
      "risk_level": "high",
      "source_text": "原文摘录内容..."
    }}
  ]
}}

只返回 JSON，不要包含其他内容。"""


def _parse_llm_json_response(content: str) -> dict[str, Any]:
    """解析 LLM 返回的 JSON 字符串。"""
    try:
        result = json.loads(content)
        if isinstance(result, dict):
            return result
    except json.JSONDecodeError:
        pass

    # 尝试提取 JSON 块（```json ... ``` 或 ``` ... ```）
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
    if m:
        try:
            result = json.loads(m.group(1))
            if isinstance(result, dict):
                return result
        except json.JSONDecodeError:
            pass

    # 尝试匹配 { ... }
    m = re.search(r"\{[\s\S]*\}", content)
    if m:
        try:
            result = json.loads(m.group(0))
            if isinstance(result, dict):
                return result
        except json.JSONDecodeError:
            pass

    return {}


def _post_process_requirements(raw_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """后处理 LLM 返回的 requirements 列表，修正分类逻辑。"""
    valid_types = set(_REQUIREMENT_TYPE_LABELS.keys())
    valid_priorities = {"high", "medium", "low"}
    valid_risk_levels = {"blocking", "high", "medium", "low"}

    processed: list[dict[str, Any]] = []
    for item in raw_items:
        req_type = item.get("requirement_type", "")
        # 修正无效的 requirement_type
        if req_type not in valid_types:
            req_type = "technical_requirement"
        item["requirement_type"] = req_type

        # 废标项强制 blocking
        if req_type == "disqualification_item":
            item["is_mandatory"] = True
            item["risk_level"] = "blocking"
            item["priority"] = "high"

        # 强制要求自动提升 risk_level
        is_mandatory = item.get("is_mandatory", False)
        if is_mandatory and item.get("risk_level", "medium") not in ("blocking", "high"):
            item["risk_level"] = "high"

        # 修正无效值
        if item.get("priority", "medium") not in valid_priorities:
            item["priority"] = "medium"

        risk = item.get("risk_level", "medium")
        if risk not in valid_risk_levels:
            # 尝试修复常见 LLM 输出
            risk_map = {"critical": "blocking", "urgent": "high", "normal": "medium", "minor": "low"}
            item["risk_level"] = risk_map.get(risk, "medium")

        # 确保 boolean
        item["is_mandatory"] = bool(item.get("is_mandatory", False))

        # 确保 title 非空
        if not item.get("title", "").strip():
            item["title"] = item.get("description", "未命名要求")[:80] or "未命名要求"

        processed.append(item)

    return processed


async def extract_requirements_from_document(doc_id: str) -> dict[str, Any]:
    """从已解析的招标文档中提取结构化要求。

    前提：文档需先调用 /parse-tender 完成解析。
    提取结果写入 requirements 表，关联到文档所属项目。
    """
    gw = SupabaseGateway()
    mgw = ModelGateway()

    doc = gw.get_document(doc_id)
    if not doc:
        raise ValueError(f"文档不存在: {doc_id}")

    project_id = doc.get("project_id", "")
    if not project_id:
        raise ValueError("文档未关联到任何项目，请先通过项目文件上传接口上传")

    # 获取解析结果
    versions = gw.get_document_versions(doc_id)
    parsed_versions = [v for v in versions if v.get("version_type") == "parsed"]
    if not parsed_versions:
        raise ValueError("文档尚未解析，请先调用 /parse-tender 端点完成解析")

    latest = parsed_versions[0]
    content_raw = latest.get("content", "{}")
    parsed = json.loads(content_raw) if isinstance(content_raw, str) else content_raw

    full_text = parsed.get("full_text", "")
    sections = parsed.get("sections", [])

    if not full_text.strip():
        raise ValueError("解析结果中无文本内容，无法提取要求")

    # 构建 prompt 并调用 LLM
    prompt = _build_extraction_prompt(full_text, sections)
    messages = [
        {"role": "system", "content": "你是一个精确的 JSON 输出助手，只返回要求的 JSON 格式，不输出任何额外内容。"},
        {"role": "user", "content": prompt},
    ]

    result = await mgw.chat_completion(messages, temperature=0.1, max_tokens=4096)
    call_log = mgw.build_call_log(
        scenario="requirement_extraction",
        result=result,
        request_json={
            "document_id": doc_id,
            "text_length": len(full_text),
            "section_count": len(sections),
        },
    )
    gw.insert_model_call_log(call_log)

    # 解析 LLM 响应
    requirements: list[dict[str, Any]] = []
    if result["content"] and not result["error"]:
        parsed_response = _parse_llm_json_response(result["content"])
        raw_items = parsed_response.get("requirements", [])
        requirements = _post_process_requirements(raw_items)
    else:
        # LLM 完全失败，返回空结果
        return {
            "document_id": doc_id,
            "project_id": project_id,
            "status": "failed",
            "error": result.get("error", "LLM 调用失败"),
            "total_requirements": 0,
            "requirements": [],
            "llm_model": result["model"],
            "llm_tokens": result["total_tokens"],
        }

    if not requirements:
        return {
            "document_id": doc_id,
            "project_id": project_id,
            "status": "success",
            "total_requirements": 0,
            "requirements": [],
            "llm_model": result["model"],
            "llm_tokens": result["total_tokens"],
        }

    # 写入 requirements 表
    db_records: list[dict[str, Any]] = []
    for item in requirements:
        db_records.append({
            "project_id": project_id,
            "source_document_id": doc_id,
            "requirement_type": item["requirement_type"],
            "title": item["title"],
            "description": item.get("description", ""),
            "priority": item["priority"],
            "is_mandatory": item["is_mandatory"],
            "risk_level": item["risk_level"],
            "source_text": item.get("source_text", ""),
            "status": "active",
        })

    inserted = gw.insert_requirements(db_records)

    return {
        "document_id": doc_id,
        "project_id": project_id,
        "status": "success",
        "total_requirements": len(inserted),
        "requirements": [
            {
                "requirement_type": r["requirement_type"],
                "title": r["title"],
                "description": r.get("description", ""),
                "priority": r["priority"],
                "is_mandatory": r["is_mandatory"],
                "risk_level": r["risk_level"],
                "source_text": r.get("source_text", ""),
            }
            for r in inserted
        ],
        "llm_model": result["model"],
        "llm_tokens": result["total_tokens"],
    }
