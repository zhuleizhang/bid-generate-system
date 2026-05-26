"""修订 API — AIRevision 状态变更和单条操作。"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.gateway.supabase_gateway import SupabaseGateway

revisions_router = APIRouter(prefix="/revisions", tags=["revisions"])


class RevisionStatusUpdate(BaseModel):
    """AIRevision 状态变更请求体。"""

    status: str  # accepted / rejected / edited_then_accepted / need_human_confirm
    ai_content: str | None = None  # 用户编辑后的内容（edited_then_accepted 时必填）


# 状态 → audit action 映射
_STATUS_ACTION_MAP: dict[str, str] = {
    "accepted": "accept_revision",
    "rejected": "reject_revision",
    "edited_then_accepted": "edit_revision",
    "need_human_confirm": "mark_revision_pending",
}


@revisions_router.patch("/{revision_id}/status")
async def update_revision_status(revision_id: str, body: RevisionStatusUpdate):
    """更新 AIRevision 状态，同时写入审计日志。

    status 可选值：
    - accepted：接受修订
    - rejected：拒绝修订
    - edited_then_accepted：用户编辑后接受（需提供 ai_content）
    - need_human_confirm：标记为待确认
    """
    gw = SupabaseGateway()

    revision = gw.get_ai_revision(revision_id)
    if not revision:
        raise HTTPException(status_code=404, detail="修订不存在")

    update_fields: dict = {}
    if body.status == "edited_then_accepted" and body.ai_content is not None:
        update_fields["ai_content"] = body.ai_content

    updated = gw.update_ai_revision_status(revision_id, body.status, **update_fields)
    if not updated:
        raise HTTPException(status_code=500, detail="状态更新失败")

    # 记录审计日志
    action = _STATUS_ACTION_MAP.get(body.status, body.status)
    gw.insert_audit_log({
        "entity_type": "ai_revision",
        "entity_id": revision_id,
        "action": action,
        "details": {
            "old_status": revision.get("status"),
            "new_status": body.status,
            "document_id": revision.get("document_id"),
        },
    })

    return updated
