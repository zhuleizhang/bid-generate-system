"""招标要求 API 测试（补充）。"""

from unittest.mock import patch

import pytest

from tests.conftest import make_mock_gw


class TestRequirementsCRUD:
    """要求 CRUD 操作。"""

    @pytest.mark.anyio
    async def test_list_requirements_success(self, async_client):
        """正常查询要求列表。"""
        gw = make_mock_gw(
            get_project={"id": "p1"},
            get_requirements=[
                {"id": "r1", "project_id": "p1", "source_document_id": None,
                 "requirement_type": "technical_requirement", "title": "性能",
                 "description": "", "priority": "high", "is_mandatory": True,
                 "risk_level": "high", "source_text": "", "status": "active",
                 "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z"},
            ],
        )
        with patch("app.api.requirements.SupabaseGateway", return_value=gw):
            resp = await async_client.get("/api/projects/p1/requirements")
            assert resp.status_code == 200
            assert len(resp.json()) == 1

    @pytest.mark.anyio
    async def test_list_requirements_project_not_found(self, async_client):
        """项目不存在返回 404。"""
        gw = make_mock_gw(get_project=None)
        with patch("app.api.requirements.SupabaseGateway", return_value=gw):
            resp = await async_client.get("/api/projects/p1/requirements")
            assert resp.status_code == 404

    @pytest.mark.anyio
    async def test_add_requirement_success(self, async_client):
        """手动添加要求。"""
        gw = make_mock_gw(
            get_project={"id": "p1"},
            insert_requirements=[{
                "id": "r1", "project_id": "p1", "requirement_type": "technical_requirement",
                "title": "新增要求", "description": "desc", "priority": "high",
                "is_mandatory": True, "risk_level": "high", "source_text": "",
                "status": "manual", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z",
            }],
        )
        with patch("app.api.requirements.SupabaseGateway", return_value=gw):
            resp = await async_client.post("/api/projects/p1/requirements", json={
                "requirement_type": "technical_requirement",
                "title": "新增要求", "description": "desc",
                "priority": "high", "is_mandatory": True, "risk_level": "high",
                "source_text": "",
            })
            assert resp.status_code == 201

    @pytest.mark.anyio
    async def test_add_requirement_project_not_found(self, async_client):
        """项目不存在时添加失败。"""
        gw = make_mock_gw(get_project=None)
        with patch("app.api.requirements.SupabaseGateway", return_value=gw):
            resp = await async_client.post("/api/projects/p1/requirements", json={
                "requirement_type": "technical_requirement", "title": "test",
                "description": "", "priority": "medium", "is_mandatory": False,
                "risk_level": "low", "source_text": "",
            })
            assert resp.status_code == 404

    @pytest.mark.anyio
    async def test_update_requirement_success(self, async_client):
        """正常编辑要求。"""
        gw = make_mock_gw(
            get_project={"id": "p1"},
            update_requirement={
                "id": "r1", "project_id": "p1", "requirement_type": "technical_requirement",
                "title": "更新标题", "description": "", "priority": "high",
                "is_mandatory": True, "risk_level": "high", "source_text": "",
                "status": "active", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z",
            },
        )
        with patch("app.api.requirements.SupabaseGateway", return_value=gw):
            resp = await async_client.put("/api/projects/p1/requirements/r1", json={"title": "更新标题"})
            assert resp.status_code == 200

    @pytest.mark.anyio
    async def test_update_requirement_no_fields(self, async_client):
        """无需要更新的字段时返回 400。"""
        gw = make_mock_gw(get_project={"id": "p1"})
        with patch("app.api.requirements.SupabaseGateway", return_value=gw):
            resp = await async_client.put("/api/projects/p1/requirements/r1", json={})
            assert resp.status_code == 400

    @pytest.mark.anyio
    async def test_update_status_success(self, async_client):
        """软删除要求。"""
        gw = make_mock_gw(
            get_project={"id": "p1"},
            update_requirement={
                "id": "r1", "project_id": "p1", "requirement_type": "technical_requirement",
                "title": "test", "description": "", "priority": "high",
                "is_mandatory": True, "risk_level": "high", "source_text": "",
                "status": "ignored", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z",
            },
        )
        with patch("app.api.requirements.SupabaseGateway", return_value=gw):
            resp = await async_client.patch("/api/projects/p1/requirements/r1/status?status=ignored")
            assert resp.status_code == 200
