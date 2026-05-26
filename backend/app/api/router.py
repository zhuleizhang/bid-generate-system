from fastapi import APIRouter

from app.api.documents import documents_router

router = APIRouter()
router.include_router(documents_router)


@router.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "ok", "app": "智能标书系统"}
