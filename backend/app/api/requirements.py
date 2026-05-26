"""招标要求 API — 查询、编辑、新增、删除端点。"""

from fastapi import APIRouter, HTTPException

from app.gateway.supabase_gateway import SupabaseGateway
from app.models.requirement import RequirementCreate, RequirementDBItem, RequirementUpdate

requirements_router = APIRouter(prefix="/projects", tags=["requirements"])


@requirements_router.get("/{project_id}/requirements")
async def list_requirements(project_id: str) -> list[RequirementDBItem]:
    """查询指定项目的所有招标要求列表。"""
    gw = SupabaseGateway()
    project = gw.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    items = gw.get_requirements(project_id)
    return [RequirementDBItem(**item) for item in items]


@requirements_router.post("/{project_id}/requirements", status_code=201, response_model=RequirementDBItem)
async def add_requirement(project_id: str, body: RequirementCreate):
    """手动添加一条招标要求到指定项目。"""
    gw = SupabaseGateway()
    project = gw.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    data = body.model_dump()
    data["project_id"] = project_id
    data["status"] = "manual"
    result = gw.insert_requirements([data])
    if not result:
        raise HTTPException(status_code=500, detail="添加要求失败")
    return RequirementDBItem(**result[0])


@requirements_router.put("/{project_id}/requirements/{requirement_id}", response_model=RequirementDBItem)
async def update_requirement(project_id: str, requirement_id: str, body: RequirementUpdate):
    """编辑一条招标要求。"""
    gw = SupabaseGateway()
    project = gw.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="没有需要更新的字段")

    result = gw.update_requirement(requirement_id, updates)
    if not result:
        raise HTTPException(status_code=404, detail="要求不存在")
    return RequirementDBItem(**result)


@requirements_router.patch("/{project_id}/requirements/{requirement_id}/status")
async def update_requirement_status(project_id: str, requirement_id: str, status: str = "ignored"):
    """软删除招标要求（将状态标记为 ignored）。"""
    gw = SupabaseGateway()
    project = gw.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    result = gw.update_requirement(requirement_id, {"status": status})
    if not result:
        raise HTTPException(status_code=404, detail="要求不存在")
    return RequirementDBItem(**result)
