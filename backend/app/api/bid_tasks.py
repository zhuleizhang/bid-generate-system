"""标书任务 API — 任务拆解与查询端点。"""

from fastapi import APIRouter, HTTPException

from app.services.bid_task_service import decompose_project_tasks
from app.models.bid_task import TaskDecompositionResult
from app.gateway.supabase_gateway import SupabaseGateway

bid_tasks_router = APIRouter(prefix="/projects", tags=["bid_tasks"])


@bid_tasks_router.post("/{project_id}/decompose-tasks", response_model=TaskDecompositionResult)
async def decompose_tasks(project_id: str):
    """根据项目招标要求自动拆解标书制作任务清单。

    按 requirement_type 和需求文本关键词生成 bid_tasks，
    敏感任务（报价/资质/偏离表）默认 assignee_type = human_required。
    任务按 section_path 分组，与模板章节对应。
    """
    try:
        result = await decompose_project_tasks(project_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"任务拆解失败: {str(e)}")

    return TaskDecompositionResult(**result)


@bid_tasks_router.get("/{project_id}/tasks")
async def list_tasks(project_id: str):
    """查询指定项目的所有标书任务列表。"""
    gw = SupabaseGateway()
    project = gw.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    return gw.get_bid_tasks(project_id)
