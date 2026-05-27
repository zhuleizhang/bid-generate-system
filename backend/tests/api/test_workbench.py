"""工作台 API 测试。"""

from unittest.mock import patch

import pytest

from tests.conftest import make_mock_gw


class TestConfirmRequirements:
    """确认招标要求。"""

    @pytest.mark.anyio
    async def test_confirm_requirements_success(self, async_client):
        """正常确认招标要求。"""
        gw = make_mock_gw(get_project={"id": "p1", "status": "pending_confirmation"})

        with patch("app.api.workbench.SupabaseGateway", return_value=gw):
            resp = await async_client.post("/api/projects/p1/workbench/confirm-requirements")
            assert resp.status_code == 200
            assert resp.json()["confirmed"] is True

    @pytest.mark.anyio
    async def test_confirm_requirements_project_not_found(self, async_client):
        """项目不存在返回 404。"""
        gw = make_mock_gw(get_project=None)

        with patch("app.api.workbench.SupabaseGateway", return_value=gw):
            resp = await async_client.post("/api/projects/nonexistent/workbench/confirm-requirements")
            assert resp.status_code == 404


class TestConfirmStructure:
    """确认模板结构。"""

    @pytest.mark.anyio
    async def test_confirm_structure_success(self, async_client):
        """正常确认模板结构。"""
        gw = make_mock_gw(get_project={"id": "p1", "status": "pending_confirmation"})

        with patch("app.api.workbench.SupabaseGateway", return_value=gw):
            resp = await async_client.post("/api/projects/p1/workbench/confirm-structure")
            assert resp.status_code == 200
            assert resp.json()["confirmed"] is True


class TestConfirmAndGenerate:
    """确认并生成。"""

    @pytest.mark.anyio
    async def test_generate_not_in_pending_confirmation(self, async_client):
        """非 pending_confirmation 状态不允许生成。"""
        gw = make_mock_gw(get_project={"id": "p1", "status": "draft"})

        with patch("app.api.workbench.SupabaseGateway", return_value=gw):
            resp = await async_client.post("/api/projects/p1/workbench/confirm-and-generate")
            assert resp.status_code == 409

    @pytest.mark.anyio
    async def test_generate_no_bid_template(self, async_client):
        """没有投标模板时返回错误。"""
        gw = make_mock_gw(
            get_project={"id": "p1", "status": "pending_confirmation"},
            get_documents_by_project=[{"id": "d1", "document_type": "tender_doc"}],
        )

        with patch("app.api.workbench.SupabaseGateway", return_value=gw):
            resp = await async_client.post("/api/projects/p1/workbench/confirm-and-generate")
            assert resp.status_code == 400

    @pytest.mark.anyio
    async def test_generate_success(self, async_client):
        """正常触发生成流程。"""
        gw = make_mock_gw(
            get_project={"id": "p1", "status": "pending_confirmation"},
            get_documents_by_project=[
                {"id": "d1", "document_type": "bid_template"},
                {"id": "d2", "document_type": "tender_doc"},
            ],
        )

        with patch("app.api.workbench.SupabaseGateway", return_value=gw):
            resp = await async_client.post("/api/projects/p1/workbench/confirm-and-generate")
            assert resp.status_code == 200
            data = resp.json()
            assert data["project_id"] == "p1"
            assert data["document_id"] == "d1"
