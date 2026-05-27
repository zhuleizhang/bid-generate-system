"""导出 API 测试。"""

from unittest.mock import patch

import pytest

from tests.conftest import make_mock_gw


class TestExportDocx:
    """导出 DOCX。"""

    @pytest.mark.anyio
    async def test_export_blocked_by_unfinished(self, async_client):
        """有 blocking 未完成项时返回 409。"""
        with patch("app.api.exports.export_project_docx") as mock_export:
            mock_export.return_value = {"status": "blocked", "blocked_by": ["u1"]}

            resp = await async_client.post("/api/projects/p1/export?document_id=d1")
            assert resp.status_code == 409

    @pytest.mark.anyio
    async def test_export_value_error_returns_400(self, async_client):
        """ValueError 返回 400。"""
        with patch("app.api.exports.export_project_docx") as mock_export:
            mock_export.side_effect = ValueError("缺少投标模板")

            resp = await async_client.post("/api/projects/p1/export?document_id=d1")
            assert resp.status_code == 400

    @pytest.mark.anyio
    async def test_export_generic_error_returns_500(self, async_client):
        """通用异常返回 500。"""
        with patch("app.api.exports.export_project_docx") as mock_export:
            mock_export.side_effect = RuntimeError("oops")

            resp = await async_client.post("/api/projects/p1/export?document_id=d1")
            assert resp.status_code == 500


class TestExportHistory:
    """导出历史记录。"""

    @pytest.mark.anyio
    async def test_get_history_success(self, async_client):
        """正常返回导出历史。"""
        gw = make_mock_gw(
            get_export_records=[
                {"id": "e1", "project_id": "p1", "document_id": "d1", "exported_by": "user1",
                 "file_path": "/exports/test.docx", "file_size": 2048, "revision_count": 5,
                 "status": "completed", "created_at": "2026-01-01T00:00:00Z"},
            ],
        )
        with patch("app.api.exports.SupabaseGateway", return_value=gw):
            resp = await async_client.get("/api/projects/p1/exports")
            assert resp.status_code == 200
            assert len(resp.json()) == 1


class TestDownloadExport:
    """下载导出文件。"""

    @pytest.mark.anyio
    async def test_download_project_not_found(self, async_client):
        """项目不存在返回 404。"""
        gw = make_mock_gw(get_project=None)
        with patch("app.api.exports.SupabaseGateway", return_value=gw):
            resp = await async_client.get("/api/projects/p1/export/download")
            assert resp.status_code == 404

    @pytest.mark.anyio
    async def test_download_no_records(self, async_client):
        """无导出记录返回 404。"""
        gw = make_mock_gw(
            get_project={"id": "p1", "name": "测试"},
            get_export_records=[],
        )
        with patch("app.api.exports.SupabaseGateway", return_value=gw):
            resp = await async_client.get("/api/projects/p1/export/download")
            assert resp.status_code == 404
