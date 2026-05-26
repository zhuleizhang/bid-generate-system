"""响应性检查 API — 检查招标要求是否已有对应的 AIRevision 或章节内容覆盖。"""

from fastapi import APIRouter, HTTPException

from app.services.review_service import check_project_review
from app.models.review_result import ReviewCheckResult

review_router = APIRouter(prefix="/projects", tags=["review"])


@review_router.post("/{project_id}/review", response_model=ReviewCheckResult)
async def run_review_check(project_id: str):
    """对项目的所有招标要求进行响应性检查。

    建立 requirement_id → AIRevision 的响应映射，
    检查每条 is_mandatory 的 Requirement 是否已有已接受的 AIRevision。
    废标项未覆盖时标记为 blocking 问题。
    输出每个要求的 PASS/FAIL/WARNING 状态。
    """
    try:
        result = await check_project_review(project_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"响应性检查失败: {str(e)}")

    return ReviewCheckResult(**result)


@review_router.get("/{project_id}/review")
async def get_review_result(project_id: str):
    """查询项目最近一次响应性检查的结果。

    返回每条要求的覆盖状态（PASS/FAIL/WARNING）、覆盖率和阻断问题。
    """
    try:
        result = await check_project_review(project_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"响应性检查查询失败: {str(e)}")

    return ReviewCheckResult(**result)
