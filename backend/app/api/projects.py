"""项目 API — 创建、查询、编辑、删除投标项目。"""

from fastapi import APIRouter, HTTPException, Query

from app.models.project import ProjectCreate, ProjectTransitionRequest, ProjectUpdate, ProjectResponse, ProjectListResponse
from app.gateway.supabase_gateway import SupabaseGateway

projects_router = APIRouter(prefix="/projects", tags=["projects"])


@projects_router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(body: ProjectCreate):
    """创建新的投标项目。"""
    gw = SupabaseGateway()
    data = body.model_dump(exclude_none=True)
    result = gw.insert_project(data)
    return result


@projects_router.get("", response_model=ProjectListResponse)
async def list_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    search: str | None = Query(None),
):
    """项目列表，支持分页、按状态筛选、按名称搜索、按创建时间降序排列。"""
    gw = SupabaseGateway()
    items, total = gw.get_projects(page=page, page_size=page_size, status=status, search=search)
    return ProjectListResponse(items=items, total=total, page=page, page_size=page_size)  # type: ignore[arg-type]


@projects_router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str):
    """获取单个项目详情，含文件数量。"""
    gw = SupabaseGateway()
    project = gw.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


@projects_router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, body: ProjectUpdate):
    """编辑项目信息。"""
    gw = SupabaseGateway()
    project = gw.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="没有需要更新的字段")

    result = gw.update_project(project_id, data)
    return result


@projects_router.delete("/{project_id}", status_code=200)
async def delete_project(project_id: str):
    """删除项目，仅允许删除 draft 状态的项目。"""
    gw = SupabaseGateway()
    project = gw.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    if project.get("status") != "draft":
        raise HTTPException(
            status_code=409,
            detail=f"仅允许删除 draft 状态的项目，当前状态为 {project.get('status')}",
        )

    gw.delete_project(project_id)
    return {"message": "项目已删除"}


# 合法的状态转换路径
VALID_TRANSITIONS: dict[str, list[str]] = {
    "draft": ["pending_confirmation"],
    "pending_confirmation": ["in_review"],
    "in_review": ["review_completed"],
    "review_completed": ["exported"],
    "exported": ["completed"],
}


@projects_router.post("/{project_id}/transition", response_model=ProjectResponse)
async def transition_project(project_id: str, body: ProjectTransitionRequest):
    """原子性状态转换，当前状态匹配才允许更新。"""
    gw = SupabaseGateway()
    project = gw.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    allowed = VALID_TRANSITIONS.get(body.from_status, [])
    if body.to_status not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"不允许从 {body.from_status} 转换到 {body.to_status}",
        )

    result = gw.transition_project_status(project_id, body.from_status, body.to_status)
    if not result:
        raise HTTPException(
            status_code=409,
            detail=f"状态转换失败：项目当前状态不是 {body.from_status}",
        )

    return result
