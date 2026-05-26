from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "ok", "app": "智能标书系统"}
