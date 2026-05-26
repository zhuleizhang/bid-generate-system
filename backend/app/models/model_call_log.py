"""Model Call Log 相关的 Pydantic 模型。"""

from pydantic import BaseModel


class ModelCallLogResponse(BaseModel):
    """LLM 调用日志响应。"""

    id: str
    scenario: str
    model_name: str | None = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cost: float | None = None
    duration_ms: int | None = None
    status: str = "success"
    error_message: str | None = None
    created_at: str = ""
