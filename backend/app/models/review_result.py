"""响应性检查结果模型。"""

from pydantic import BaseModel


class ReviewCheckItem(BaseModel):
    """单条要求的检查结果。"""

    requirement_id: str
    requirement_type: str
    title: str
    description: str = ""
    is_mandatory: bool = False
    risk_level: str = "medium"
    status: str  # PASS / FAIL / WARNING
    message: str = ""
    suggested_action: str = ""
    matched_revision_ids: list[str] = []


class ReviewCheckResult(BaseModel):
    """响应性检查总体结果。"""

    project_id: str
    status: str  # success / failed
    error: str = ""
    total_requirements: int = 0
    pass_count: int = 0
    fail_count: int = 0
    warning_count: int = 0
    coverage_rate: float = 0.0
    has_blocking_issues: bool = False
    items: list[ReviewCheckItem] = []
