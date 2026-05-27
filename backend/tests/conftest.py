"""共享 pytest fixtures — mock 数据库和 LLM 调用，隔离外部依赖。

每个 API 文件在模块顶层 import SupabaseGateway，因此 mock 必须
patch 在 API 模块的命名空间中（如 app.api.projects.SupabaseGateway）。
此处仅提供通用工具 fixture，具体 mock 由各测试文件在 setUp 中处理。
"""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def async_client():
    """FastAPI TestClient，支持 async 测试。"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def sample_project_data():
    """测试用项目创建数据。"""
    return {
        "name": "测试投标项目",
        "tender_org": "测试招标单位",
        "industry": "信息化",
        "project_type": "政府采购",
        "deadline": "2026-12-31",
    }


def make_mock_gw(**overrides):
    """创建一个 mock SupabaseGateway，所有方法默认返回 None。"""
    gw = MagicMock()
    # 为常用方法设置默认返回值
    gw.insert_project.return_value = {"id": "proj-0000-0000-000000000001", "status": "draft"}
    gw.get_project.return_value = None
    gw.update_project.return_value = None
    gw.delete_project.return_value = False
    gw.transition_project_status.return_value = None
    gw.insert_document.return_value = {"id": "doc-0000-0000-000000000001"}
    gw.get_document.return_value = None
    # 应用覆盖
    for k, v in overrides.items():
        if hasattr(gw, k):
            getattr(gw, k).return_value = v
    return gw
