"""项目文件 API 测试。"""

from unittest.mock import patch

import pytest

from tests.conftest import make_mock_gw


class TestListFiles:
    """查询项目文件列表。"""

    @pytest.mark.anyio
    async def test_list_files_success(self, async_client):
        """正常返回文件列表。"""
        gw = make_mock_gw(
            get_project={"id": "p1", "status": "draft"},
            get_documents_by_project=[
                {"id": "d1", "name": "模板.docx", "document_type": "bid_template", "file_size": 1024, "status": "uploaded", "created_at": "2026-01-01T00:00:00Z"},
            ],
        )
        with patch("app.api.project_files.SupabaseGateway", return_value=gw):
            resp = await async_client.get("/api/projects/p1/files")
            assert resp.status_code == 200
            data = resp.json()
            assert data["project_id"] == "p1"
            assert len(data["files"]) == 1
            assert data["files"][0]["name"] == "模板.docx"

    @pytest.mark.anyio
    async def test_list_files_project_not_found(self, async_client):
        """项目不存在返回 404。"""
        gw = make_mock_gw(get_project=None)
        with patch("app.api.project_files.SupabaseGateway", return_value=gw):
            resp = await async_client.get("/api/projects/p1/files")
            assert resp.status_code == 404

    @pytest.mark.anyio
    async def test_list_files_empty(self, async_client):
        """无文件时返回空列表。"""
        gw = make_mock_gw(
            get_project={"id": "p1", "status": "draft"},
            get_documents_by_project=[],
        )
        with patch("app.api.project_files.SupabaseGateway", return_value=gw):
            resp = await async_client.get("/api/projects/p1/files")
            assert resp.status_code == 200
            assert len(resp.json()["files"]) == 0
