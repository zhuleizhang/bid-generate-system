"""标书任务 API 测试。"""

from unittest.mock import patch

import pytest

from tests.conftest import make_mock_gw


class TestDecomposeTasks:
    """任务拆解。"""

    @pytest.mark.anyio
    async def test_decompose_success(self, async_client):
        """正常拆解任务。"""
        mock_result = {"project_id": "p1", "total_tasks": 3, "tasks": [], "status": "success"}
        with patch("app.api.bid_tasks.decompose_project_tasks", return_value=mock_result):
            resp = await async_client.post("/api/projects/p1/decompose-tasks")
            assert resp.status_code == 200
            assert resp.json()["total_tasks"] == 3

    @pytest.mark.anyio
    async def test_decompose_value_error(self, async_client):
        """ValueError 返回 400。"""
        with patch("app.api.bid_tasks.decompose_project_tasks", side_effect=ValueError("no requirements")):
            resp = await async_client.post("/api/projects/p1/decompose-tasks")
            assert resp.status_code == 400

    @pytest.mark.anyio
    async def test_decompose_runtime_error(self, async_client):
        """通用异常返回 500。"""
        with patch("app.api.bid_tasks.decompose_project_tasks", side_effect=RuntimeError("fail")):
            resp = await async_client.post("/api/projects/p1/decompose-tasks")
            assert resp.status_code == 500


class TestListTasks:
    """任务列表查询。"""

    @pytest.mark.anyio
    async def test_list_tasks_success(self, async_client):
        """正常查询。"""
        gw = make_mock_gw(
            get_project={"id": "p1"},
            get_bid_tasks=[{"id": "t1", "title": "写技术方案", "status": "pending"}],
        )
        with patch("app.api.bid_tasks.SupabaseGateway", return_value=gw):
            resp = await async_client.get("/api/projects/p1/tasks")
            assert resp.status_code == 200
            assert len(resp.json()) == 1

    @pytest.mark.anyio
    async def test_list_tasks_project_not_found(self, async_client):
        """项目不存在返回 404。"""
        gw = make_mock_gw(get_project=None)
        with patch("app.api.bid_tasks.SupabaseGateway", return_value=gw):
            resp = await async_client.get("/api/projects/p1/tasks")
            assert resp.status_code == 404


class TestUpdateTask:
    """任务更新。"""

    @pytest.mark.anyio
    async def test_update_status_success(self, async_client):
        """正常更新状态。"""
        gw = make_mock_gw(
            get_project={"id": "p1"},
            update_bid_task={"id": "t1", "status": "in_progress"},
        )
        with patch("app.api.bid_tasks.SupabaseGateway", return_value=gw):
            resp = await async_client.patch("/api/projects/p1/tasks/t1", json={"status": "in_progress"})
            assert resp.status_code == 200

    @pytest.mark.anyio
    async def test_update_no_fields_returns_400(self, async_client):
        """无字段时返回 400。"""
        gw = make_mock_gw(get_project={"id": "p1"})
        with patch("app.api.bid_tasks.SupabaseGateway", return_value=gw):
            resp = await async_client.patch("/api/projects/p1/tasks/t1", json={})
            assert resp.status_code == 400

    @pytest.mark.anyio
    async def test_update_project_not_found(self, async_client):
        """项目不存在返回 404。"""
        gw = make_mock_gw(get_project=None)
        with patch("app.api.bid_tasks.SupabaseGateway", return_value=gw):
            resp = await async_client.patch("/api/projects/p1/tasks/t1", json={"status": "done"})
            assert resp.status_code == 404

    @pytest.mark.anyio
    async def test_update_task_not_found(self, async_client):
        """任务不存在返回 404。"""
        gw = make_mock_gw(
            get_project={"id": "p1"},
            update_bid_task=None,
        )
        with patch("app.api.bid_tasks.SupabaseGateway", return_value=gw):
            resp = await async_client.patch("/api/projects/p1/tasks/t1", json={"status": "done"})
            assert resp.status_code == 404
