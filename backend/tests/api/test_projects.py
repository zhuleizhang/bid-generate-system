"""项目 API 测试 — 状态转换、CRUD 操作。"""

from unittest.mock import patch

import pytest

from tests.conftest import make_mock_gw


class TestCreateProject:
    """创建项目。"""

    @pytest.mark.anyio
    async def test_create_project(self, async_client, sample_project_data):
        """新建项目默认状态应为 draft。"""
        gw = make_mock_gw(insert_project={
            "id": "p1",
            "name": "测试投标项目",
            "status": "draft",
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        })

        with patch("app.api.projects.SupabaseGateway", return_value=gw):
            resp = await async_client.post("/api/projects", json=sample_project_data)
            assert resp.status_code == 201
            assert resp.json()["status"] == "draft"


class TestTransitionProject:
    """项目状态转换。"""

    @pytest.mark.anyio
    async def test_valid_transition(self, async_client):
        """合法状态转换：draft → pending_confirmation。"""
        gw = make_mock_gw(
            get_project={"id": "p1", "name": "test", "status": "draft"},
            transition_project_status={
                "id": "p1", "name": "test", "status": "pending_confirmation",
                "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z",
            },
        )

        with patch("app.api.projects.SupabaseGateway", return_value=gw):
            resp = await async_client.post(
                "/api/projects/p1/transition",
                json={"from_status": "draft", "to_status": "pending_confirmation"},
            )
            assert resp.status_code == 200
            assert resp.json()["status"] == "pending_confirmation"

    @pytest.mark.anyio
    async def test_invalid_skip_transition(self, async_client):
        """跳状态被拒绝：draft → in_review。"""
        gw = make_mock_gw(
            get_project={"id": "p1", "name": "test", "status": "draft"},
        )

        with patch("app.api.projects.SupabaseGateway", return_value=gw):
            resp = await async_client.post(
                "/api/projects/p1/transition",
                json={"from_status": "draft", "to_status": "in_review"},
            )
            assert resp.status_code == 422

    @pytest.mark.anyio
    async def test_conflict_when_status_mismatch(self, async_client):
        """当前状态不匹配时返回 409。"""
        gw = make_mock_gw(
            get_project={"id": "p1", "name": "test", "status": "in_review"},
            transition_project_status=None,
        )

        with patch("app.api.projects.SupabaseGateway", return_value=gw):
            resp = await async_client.post(
                "/api/projects/p1/transition",
                json={"from_status": "draft", "to_status": "pending_confirmation"},
            )
            assert resp.status_code == 409

    @pytest.mark.anyio
    async def test_full_valid_flow(self, async_client):
        """全流程六状态依次转换均成功。"""
        flow = [
            ("draft", "pending_confirmation"),
            ("pending_confirmation", "in_review"),
            ("in_review", "review_completed"),
            ("review_completed", "exported"),
            ("exported", "completed"),
        ]
        for from_s, to_s in flow:
            gw = make_mock_gw(
                get_project={"id": "p1", "status": from_s},
                transition_project_status={
                    "id": "p1", "name": "test", "status": to_s,
                    "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z",
                },
            )

            with patch("app.api.projects.SupabaseGateway", return_value=gw):
                resp = await async_client.post(
                    "/api/projects/p1/transition",
                    json={"from_status": from_s, "to_status": to_s},
                )
                assert resp.status_code == 200, f"transition {from_s} -> {to_s} failed"
                assert resp.json()["status"] == to_s


class TestDeleteProject:
    """删除项目。"""

    @pytest.mark.anyio
    async def test_delete_draft_project(self, async_client):
        """可以删除 draft 状态的项目。"""
        gw = make_mock_gw(
            get_project={"id": "p1", "status": "draft"},
            delete_project=True,
        )

        with patch("app.api.projects.SupabaseGateway", return_value=gw):
            resp = await async_client.delete("/api/projects/p1")
            assert resp.status_code == 200

    @pytest.mark.anyio
    async def test_cannot_delete_in_review_project(self, async_client):
        """不能删除 in_review 状态的项目。"""
        gw = make_mock_gw(
            get_project={"id": "p1", "status": "in_review"},
        )

        with patch("app.api.projects.SupabaseGateway", return_value=gw):
            resp = await async_client.delete("/api/projects/p1")
            assert resp.status_code == 409


class TestGetProject:
    """获取项目。"""

    @pytest.mark.anyio
    async def test_get_nonexistent_project_returns_404(self, async_client):
        """不存在的项目返回 404。"""
        gw = make_mock_gw(get_project=None)

        with patch("app.api.projects.SupabaseGateway", return_value=gw):
            resp = await async_client.get("/api/projects/nonexistent")
            assert resp.status_code == 404
