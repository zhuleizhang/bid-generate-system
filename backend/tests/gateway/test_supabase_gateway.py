"""SupabaseGateway 测试 — 验证 DB 操作方法调用。"""

from unittest.mock import MagicMock, patch


class TestTransitionProjectStatus:
    """状态转换方法。"""

    def test_transition_calls_update_with_correct_conditions(self):
        """验证 transition_project_status 使用正确的 where 条件。"""
        mock_client = MagicMock()
        mock_table = MagicMock()
        mock_update = MagicMock()
        mock_eq1 = MagicMock()
        mock_eq2 = MagicMock()
        mock_execute = MagicMock()

        mock_client.table.return_value = mock_table
        mock_table.update.return_value = mock_update
        mock_update.eq.return_value = mock_eq1
        mock_eq1.eq.return_value = mock_eq2
        mock_eq2.execute.return_value = mock_execute
        mock_execute.data = [{"id": "p1", "status": "pending_confirmation"}]

        with patch("app.gateway.supabase_gateway.create_client", return_value=mock_client), \
             patch("app.gateway.supabase_gateway.get_settings") as mock_settings:
            mock_settings.return_value.SUPABASE_SERVICE_ROLE_KEY = "key"
            mock_settings.return_value.SUPABASE_URL = "http://localhost"
            mock_settings.return_value.SUPABASE_KEY = "key"
            mock_settings.return_value.STORAGE_BUCKET_DOCUMENTS = "docs"

            from app.gateway.supabase_gateway import SupabaseGateway
            gw = SupabaseGateway()
            result = gw.transition_project_status("p1", "draft", "pending_confirmation")

            assert result is not None
            assert result["status"] == "pending_confirmation"
            mock_table.update.assert_called_once_with({"status": "pending_confirmation"})
