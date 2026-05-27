"""确认并生成编排器 — 串联所有生成步骤，按 PRD 定义的风险分流策略生成 AIRevision。

流程：extract_requirements → detect_sections → generate_slots →
      classify_slots → generate_ai_revisions → generate_unfinished_items

每条 slot 按四级分流：
  低风险 + 高置信度 → accepted（静默通过）
  中风险 → pending（提示关注）
  低置信度 / 涉资质 → need_human_confirm（锁定）
  无法填充 → UnfinishedItem
"""

from typing import Any

from app.gateway.supabase_gateway import SupabaseGateway


async def orchestrate_full_generation(project_id: str, doc_id: str) -> dict[str, Any]:
    """串联从要求提取到修订生成的全流程。

    1. 确保 requirements 已提取
    2. 确保 DOCX 结构已解析
    3. 确保 sections 已检测
    4. 确保 slots 已生成并分类
    5. 调用 AIRevision 生成
    6. 汇总结果

    失败时不推进项目状态，返回错误信息。
    """
    gw = SupabaseGateway()
    errors: list[str] = []

    project = gw.get_project(project_id)
    if not project:
        return {"status": "failed", "error": "项目不存在"}

    doc = gw.get_document(doc_id)
    if not doc:
        return {"status": "failed", "error": f"文档不存在: {doc_id}"}

    # 1. 检查 requirements
    requirements = gw.get_requirements(project_id)
    if not requirements:
        errors.append("未找到招标要求，请先在文件管理中上传并解析招标文件")

    # 2. 检查 DOCX 结构解析
    nodes = gw.get_document_nodes(doc_id)
    if not nodes:
        errors.append("模板尚未解析，请先对投标模板执行文档解析")

    # 3. 检查 sections
    section_contents = gw.get_section_contents(doc_id)
    if not section_contents:
        errors.append("模板章节尚未检测，请先执行章节检测")

    # 4. 检查 slots
    slots = gw.get_template_slots(doc_id)
    if not slots:
        errors.append("模板填充位置尚未生成，请先执行 Slot 生成和分类")

    if errors:
        return {"status": "failed", "errors": errors}

    # 5. 触发 AIRevision 生成
    from app.services.ai_revision_service import generate_ai_revisions

    try:
        result = await generate_ai_revisions(doc_id)
    except Exception as e:
        return {"status": "failed", "error": f"AIRevision 生成失败: {str(e)}"}

    # 6. 从 generation 结果汇总 UnfinishedItem 状态
    unfinished = gw.get_unfinished_items(doc_id)

    return {
        "status": "success",
        "project_id": project_id,
        "document_id": doc_id,
        "total_revisions": result.get("total_revisions", 0),
        "total_slots": result.get("total_slots", 0),
        "unfinished_count": len(unfinished),
        "llm_model": result.get("llm_model", ""),
        "llm_tokens": result.get("llm_tokens", 0),
    }
