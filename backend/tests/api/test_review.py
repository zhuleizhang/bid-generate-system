"""响应性检查 API 测试。"""

from unittest.mock import patch

import pytest


class TestRunReview:
    """执行响应性检查。"""

    @pytest.mark.anyio
    async def test_run_review_success(self, async_client):
        """正常执行检查。"""
        mock_result = {
            "project_id": "p1", "status": "completed",
            "total_requirements": 5, "total_covered": 4,
            "coverage_rate": 0.8, "check_items": [],
            "blocking_count": 0, "warning_count": 1, "total_checks": 5,
        }
        with patch("app.api.review.check_project_review", return_value=mock_result):
            resp = await async_client.post("/api/projects/p1/review")
            assert resp.status_code == 200
            assert resp.json()["coverage_rate"] == 0.8

    @pytest.mark.anyio
    async def test_run_review_value_error(self, async_client):
        """ValueError 返回 400。"""
        with patch("app.api.review.check_project_review", side_effect=ValueError("项目不存在")):
            resp = await async_client.post("/api/projects/p1/review")
            assert resp.status_code == 400

    @pytest.mark.anyio
    async def test_run_review_runtime_error(self, async_client):
        """通用异常返回 500。"""
        with patch("app.api.review.check_project_review", side_effect=RuntimeError("check error")):
            resp = await async_client.post("/api/projects/p1/review")
            assert resp.status_code == 500


class TestGetReview:
    """查询响应性检查结果。"""

    @pytest.mark.anyio
    async def test_get_review_success(self, async_client):
        """正常查询。"""
        mock_result = {
            "project_id": "p1", "status": "completed",
            "total_requirements": 3, "total_covered": 3,
            "coverage_rate": 1.0, "check_items": [],
            "blocking_count": 0, "warning_count": 0, "total_checks": 3,
        }
        with patch("app.api.review.check_project_review", return_value=mock_result):
            resp = await async_client.get("/api/projects/p1/review")
            assert resp.status_code == 200
