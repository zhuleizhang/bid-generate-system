from fastapi import APIRouter

from app.api.documents import documents_router
from app.api.projects import projects_router
from app.api.project_files import project_files_router
from app.api.bid_tasks import bid_tasks_router
from app.api.review import review_router

router = APIRouter()
router.include_router(documents_router)
router.include_router(projects_router)
router.include_router(project_files_router)
router.include_router(bid_tasks_router)
router.include_router(review_router)


@router.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "ok", "app": "智能标书系统"}
