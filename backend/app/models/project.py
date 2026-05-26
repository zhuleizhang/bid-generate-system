"""项目相关的 Pydantic 模型。"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    """创建项目请求体。"""

    name: str
    tender_org: Optional[str] = None
    industry: Optional[str] = None
    project_type: Optional[str] = None
    deadline: Optional[date] = None


class ProjectUpdate(BaseModel):
    """编辑项目请求体，所有字段可选。"""

    name: Optional[str] = None
    tender_org: Optional[str] = None
    industry: Optional[str] = None
    project_type: Optional[str] = None
    deadline: Optional[date] = None
    status: Optional[str] = None


class ProjectResponse(BaseModel):
    """项目详情响应。"""

    id: str
    name: str
    tender_org: Optional[str] = None
    industry: Optional[str] = None
    project_type: Optional[str] = None
    deadline: Optional[date] = None
    status: str
    created_at: datetime
    updated_at: datetime


class ProjectListResponse(BaseModel):
    """项目列表响应（含分页信息）。"""

    items: list[ProjectResponse]
    total: int
    page: int
    page_size: int
