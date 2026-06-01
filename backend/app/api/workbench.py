"""工作台 API — 确认招标要求、模板结构，触发全量生成。"""

from fastapi import APIRouter, HTTPException

from app.gateway.supabase_gateway import SupabaseGateway
from app.services.generation_orchestrator import orchestrate_full_generation

workbench_router = APIRouter(prefix="/projects", tags=["workbench"])


@workbench_router.post("/{project_id}/workbench/confirm-requirements")
async def confirm_requirements(project_id: str):
    """确认招标要求解析结果，标记 Tab 1 已完成。"""
    gw = SupabaseGateway()
    project = gw.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    return {"confirmed": True, "message": "招标要求已确认"}


@workbench_router.post("/{project_id}/workbench/confirm-structure")
async def confirm_template_structure(project_id: str):
    """确认模板结构识别结果，标记 Tab 2 已完成。"""
    gw = SupabaseGateway()
    project = gw.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    return {"confirmed": True, "message": "模板结构已确认"}


@workbench_router.post("/{project_id}/workbench/confirm-and-generate")
async def confirm_and_generate(project_id: str):
    """确认并全量生成 AIRevision 和 UnfinishedItem。"""
    gw = SupabaseGateway()
    project = gw.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    if project.get("status") != "pending_confirmation":
        raise HTTPException(
            status_code=409,
            detail="当前项目状态不允许生成，请先在项目工作台中确认招标要求和模板结构",
        )

    # 查找项目的投标模板文档
    documents = gw.get_documents_by_project(project_id)
    bid_template = next((d for d in documents if d.get("document_type") == "bid_template"), None)
    if not bid_template:
        raise HTTPException(status_code=400, detail="未找到投标模板文档，请先上传模板")

    # 执行全量生成编排
    result = await orchestrate_full_generation(project_id, bid_template["id"])

    if result.get("status") == "failed":
        raise HTTPException(
            status_code=500,
            detail={
                "message": "生成流程失败",
                "errors": result.get("errors") or result.get("error"),
            },
        )

    # 生成成功后，状态从 pending_confirmation 流转到 in_review
    gw.transition_project_status(project_id, "pending_confirmation", "in_review")

    return result
