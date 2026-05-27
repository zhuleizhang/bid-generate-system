"""生成编排器测试。"""

from unittest.mock import patch

import pytest

from tests.conftest import make_mock_gw


class TestOrchestrateFullGeneration:
    """orchestrate_full_generation 测试。"""

    @pytest.mark.anyio
    async def test_no_requirements_returns_errors(self):
        """无招标要求时返回错误。"""
        from app.services.generation_orchestrator import orchestrate_full_generation

        gw = make_mock_gw(
            get_project={"id": "p1", "status": "pending_confirmation"},
            get_document={"id": "d1", "project_id": "p1"},
            get_requirements=[],
        )

        with patch("app.services.generation_orchestrator.SupabaseGateway", return_value=gw):
            result = await orchestrate_full_generation("p1", "d1")
            assert result["status"] == "failed"
            assert "errors" in result

    @pytest.mark.anyio
    async def test_no_nodes_returns_errors(self):
        """模板未解析时返回错误。"""
        from app.services.generation_orchestrator import orchestrate_full_generation

        gw = make_mock_gw(
            get_project={"id": "p1", "status": "pending_confirmation"},
            get_document={"id": "d1", "project_id": "p1"},
            get_requirements=[{"id": "r1"}],
            get_document_nodes=[],
        )

        with patch("app.services.generation_orchestrator.SupabaseGateway", return_value=gw):
            result = await orchestrate_full_generation("p1", "d1")
            assert result["status"] == "failed"

    @pytest.mark.anyio
    async def test_no_slots_returns_errors(self):
        """Slot 未生成时返回错误。"""
        from app.services.generation_orchestrator import orchestrate_full_generation

        gw = make_mock_gw(
            get_project={"id": "p1", "status": "pending_confirmation"},
            get_document={"id": "d1", "project_id": "p1"},
            get_requirements=[{"id": "r1"}],
            get_document_nodes=[{"id": "n1"}],
            get_section_contents=[{"id": "s1"}],
            get_template_slots=[],
        )

        with patch("app.services.generation_orchestrator.SupabaseGateway", return_value=gw):
            result = await orchestrate_full_generation("p1", "d1")
            assert result["status"] == "failed"
