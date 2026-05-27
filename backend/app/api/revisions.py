"""修订 API — AIRevision 状态变更和批量操作。"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.gateway.supabase_gateway import SupabaseGateway

revisions_router = APIRouter(prefix="/revisions", tags=["revisions"])

# 合法的状态转换路径
VALID_TRANSITIONS: dict[str, list[str]] = {
    "draft": ["pending_confirmation"],
    "pending_confirmation": ["in_review"],
    "in_review": ["review_completed"],
    "review_completed": ["exported"],
    "exported": ["completed"],
}


class RevisionStatusUpdate(BaseModel):
    """AIRevision 状态变更请求体。"""

    status: str  # accepted / rejected / edited_then_accepted / need_human_confirm
    ai_content: str | None = None  # 用户编辑后的内容（edited_then_accepted 时必填）


class BatchStatusUpdate(BaseModel):
    """批量 AIRevision 状态变更请求体。"""

    revision_ids: list[str]
    status: str  # accepted / rejected


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


@revisions_router.post("/batch-status")
async def batch_update_revision_status(body: BatchStatusUpdate):
    """批量更新 AIRevision 状态，逐条处理并汇总成功/失败结果。

    仅支持 accepted 和 rejected 两种批量操作。
    每条修订独立处理：验证存在性 → 更新 → 写审计日志。
    """
    gw = SupabaseGateway()

    results: dict = {"success_count": 0, "fail_count": 0, "failures": []}

    for rev_id in body.revision_ids:
        try:
            revision = gw.get_ai_revision(rev_id)
            if not revision:
                results["failures"].append({"revision_id": rev_id, "error": "修订不存在"})
                results["fail_count"] += 1
                continue

            updated = gw.update_ai_revision_status(rev_id, body.status)
            if not updated:
                results["failures"].append({"revision_id": rev_id, "error": "状态更新失败"})
                results["fail_count"] += 1
                continue

            # 记录审计日志
            action = _STATUS_ACTION_MAP.get(body.status, body.status)
            gw.insert_audit_log({
                "entity_type": "ai_revision",
                "entity_id": rev_id,
                "action": action,
                "details": {
                    "old_status": revision.get("status"),
                    "new_status": body.status,
                    "document_id": revision.get("document_id"),
                    "batch": True,
                },
            })

            results["success_count"] += 1
        except Exception as e:
            results["failures"].append({"revision_id": rev_id, "error": str(e)})
            results["fail_count"] += 1

    return results


@revisions_router.post("/check-review-complete/{project_id}")
async def check_review_complete(project_id: str):
    """检查项目是否所有修订已处理，若完成则转换状态为 review_completed。

    查询项目下所有文档的 AIRevision，全部状态为 accepted/rejected/
    edited_then_accepted/unable_to_fill 时视为完成。
    """
    gw = SupabaseGateway()

    project = gw.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    if project.get("status") != "in_review":
        raise HTTPException(
            status_code=409,
            detail=f"当前状态为 {project.get('status')}，不允许执行审阅完成检查",
        )

    documents = gw.get_documents_by_project(project_id)
    pending_found = False
    total = 0

    for doc in documents:
        revisions = gw.get_ai_revisions(doc["id"])
        total += len(revisions)
        for rev in revisions:
            if rev.get("status") not in ("accepted", "rejected", "edited_then_accepted", "unable_to_fill"):
                pending_found = True
                break
        if pending_found:
            break

    if not pending_found and total > 0:
        # 自动转换状态
        result = gw.transition_project_status(project_id, "in_review", "review_completed")
        return {
            "complete": True,
            "total_revisions": total,
            "new_status": "review_completed",
            "transitioned": result is not None,
        }

    return {
        "complete": False,
        "total_revisions": total,
        "has_pending": pending_found,
        "current_status": project.get("status"),
    }
