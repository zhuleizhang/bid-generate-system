"""后端测试基础设施冒烟测试 — 确认 FastAPI TestClient 和 fixtures 正常工作。"""

import pytest


class TestHealthEndpoint:
    """健康检查端点测试。"""

    @pytest.mark.anyio
    async def test_health_ok(self, async_client):
        resp = await async_client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["app"] == "智能标书系统"

    @pytest.mark.anyio
    async def test_root_ok(self, async_client):
        resp = await async_client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert "app" in data
