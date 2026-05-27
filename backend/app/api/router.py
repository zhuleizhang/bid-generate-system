from fastapi import APIRouter

from app.api.documents import documents_router
from app.api.projects import projects_router
from app.api.project_files import project_files_router
from app.api.bid_tasks import bid_tasks_router
from app.api.review import review_router
from app.api.exports import exports_router
from app.api.requirements import requirements_router
from app.api.revisions import revisions_router
from app.api.unfinished import unfinished_router
from app.api.workbench import workbench_router

router = APIRouter()
router.include_router(documents_router)
router.include_router(projects_router)
router.include_router(project_files_router)
router.include_router(bid_tasks_router)
router.include_router(review_router)
router.include_router(exports_router)
router.include_router(requirements_router)
router.include_router(revisions_router)
router.include_router(unfinished_router)
router.include_router(workbench_router)


@router.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "ok", "app": "智能标书系统"}
