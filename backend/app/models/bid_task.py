"""标书任务模型 — 任务拆解结果与 API 响应。"""

from pydantic import BaseModel


class BidTaskItem(BaseModel):
    """单条标书任务。"""

    title: str
    task_type: str
    related_requirement_ids: list[str] = []
    assignee_type: str = "ai"  # ai / human / ai_then_human / human_required
    priority: str = "medium"  # high / medium / low
    status: str = "pending"  # pending / in_progress / completed
    section_path: str = ""


class BidTaskUpdate(BaseModel):
    """标书任务更新 — 看板拖拽状态变更和认领操作。"""

    status: str | None = None
    assignee: str | None = None


class TaskDecompositionResult(BaseModel):
    """任务拆解结果。"""

    project_id: str
    status: str  # success / failed
    error: str = ""
    total_tasks: int = 0
    tasks: list[BidTaskItem] = []
