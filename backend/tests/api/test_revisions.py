"""修订 API 测试（补充单条修改 + 批量操作）。"""

from unittest.mock import MagicMock, patch

import pytest

from tests.conftest import make_mock_gw


class TestUpdateRevisionStatus:
    """单条修订状态更新。"""

    @pytest.mark.anyio
    async def test_update_status_accepted(self, async_client):
        """接受修订。"""
        gw = make_mock_gw(
            get_ai_revision={"id": "r1", "status": "pending", "document_id": "d1"},
            update_ai_revision_status={"id": "r1", "status": "accepted"},
            insert_audit_log={"id": "a1"},
        )
        with patch("app.api.revisions.SupabaseGateway", return_value=gw):
            resp = await async_client.patch("/api/revisions/r1/status", json={"status": "accepted"})
            assert resp.status_code == 200
            assert resp.json()["status"] == "accepted"

    @pytest.mark.anyio
    async def test_update_status_edited_then_accepted(self, async_client):
        """修改后接受（含 ai_content）。"""
        gw = make_mock_gw(
            get_ai_revision={"id": "r1", "status": "pending", "document_id": "d1"},
            update_ai_revision_status={"id": "r1", "status": "edited_then_accepted", "ai_content": "edited"},
            insert_audit_log={"id": "a1"},
        )
        with patch("app.api.revisions.SupabaseGateway", return_value=gw):
            resp = await async_client.patch("/api/revisions/r1/status", json={
                "status": "edited_then_accepted", "ai_content": "edited",
            })
            assert resp.status_code == 200

    @pytest.mark.anyio
    async def test_update_status_revision_not_found(self, async_client):
        """修订不存在返回 404。"""
        gw = make_mock_gw(get_ai_revision=None)
        with patch("app.api.revisions.SupabaseGateway", return_value=gw):
            resp = await async_client.patch("/api/revisions/r1/status", json={"status": "accepted"})
            assert resp.status_code == 404


class TestBatchUpdate:
    """批量修订状态更新。"""

    @pytest.mark.anyio
    async def test_batch_update_all_success(self, async_client):
        """全部成功批量更新。"""
        gw = make_mock_gw(
            get_ai_revision={"id": "r1", "status": "pending", "document_id": "d1"},
            update_ai_revision_status={"id": "r1", "status": "accepted"},
            insert_audit_log={"id": "a1"},
        )
        with patch("app.api.revisions.SupabaseGateway", return_value=gw):
            resp = await async_client.post("/api/revisions/batch-status", json={
                "revision_ids": ["r1", "r2"],
                "status": "accepted",
            })
            assert resp.status_code == 200
            data = resp.json()
            assert data["success_count"] == 2

    @pytest.mark.anyio
    async def test_batch_update_some_fail(self, async_client):
        """部分失败时的处理。"""
        call_count = [0]

        def side_effect_get_revision(rev_id):
            call_count[0] += 1
            if call_count[0] == 1:
                return {"id": "r1", "status": "pending", "document_id": "d1"}
            return None

        gw = make_mock_gw(
            get_ai_revision=MagicMock(side_effect=side_effect_get_revision),
            update_ai_revision_status={"id": "r1", "status": "accepted"},
            insert_audit_log={"id": "a1"},
        )

        with patch("app.api.revisions.SupabaseGateway", return_value=gw):
            resp = await async_client.post("/api/revisions/batch-status", json={
                "revision_ids": ["r1", "r2"],
                "status": "accepted",
            })
            assert resp.status_code == 200
            data = resp.json()
            assert data["success_count"] + data["fail_count"] == 2
