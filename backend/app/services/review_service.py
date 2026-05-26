"""响应性检查服务 — 检查招标要求是否已有对应的 AIRevision 或章节内容覆盖。"""

from app.gateway.supabase_gateway import SupabaseGateway


async def check_project_review(project_id: str) -> dict:
    """检查项目中每条招标要求的响应覆盖情况。

    建立 requirement_id → AIRevision 的映射关系，
    对每条 is_mandatory 的 requirement 判断其覆盖状态。
    废标项（risk_level = 'blocking'）全部检查。
    """
    gw = SupabaseGateway()

    project = gw.get_project(project_id)
    if not project:
        raise ValueError("项目不存在")

    requirements = gw.get_requirements(project_id)
    if not requirements:
        return {
            "project_id": project_id,
            "status": "success",
            "error": "",
            "total_requirements": 0,
            "pass_count": 0,
            "fail_count": 0,
            "warning_count": 0,
            "coverage_rate": 1.0,
            "has_blocking_issues": False,
            "items": [],
        }

    # 获取项目下所有文档的 AIRevision
    documents = gw.get_documents_by_project(project_id)
    all_revisions: list[dict] = []
    for doc in documents:
        doc_id = doc["id"]
        revisions = gw.get_ai_revisions(doc_id)
        all_revisions.extend(revisions)

    # 构建 requirement_id → 匹配到的 revisions 映射
    req_to_revisions: dict[str, list[dict]] = {}
    for req in requirements:
        req_to_revisions[req["id"]] = []

    for rev in all_revisions:
        source_ids = rev.get("source_requirement_ids", [])
        if isinstance(source_ids, list):
            for rid in source_ids:
                if rid in req_to_revisions:
                    req_to_revisions[rid].append(rev)

    # 逐条检查
    pass_count = 0
    fail_count = 0
    warning_count = 0
    items: list[dict] = []

    for req in requirements:
        rid = req["id"]
        matched_revs = req_to_revisions.get(rid, [])

        accepted_statuses = {"accepted", "edited_then_accepted"}
        pending_statuses = {"pending", "need_human_confirm"}

        accepted_revs = [r for r in matched_revs if r.get("status") in accepted_statuses]
        pending_revs = [r for r in matched_revs if r.get("status") in pending_statuses]

        matched_rev_ids = [r["id"] for r in matched_revs]

        if accepted_revs:
            check_status = "PASS"
            message = f"已有 {len(accepted_revs)} 条已接受的修订覆盖"
        elif pending_revs:
            check_status = "WARNING"
            message = f"存在 {len(pending_revs)} 条待确认的修订，尚未最终确认"
        else:
            check_status = "FAIL"
            is_blocking = req.get("risk_level") == "blocking" or req.get("requirement_type") == "废标项"
            if is_blocking:
                message = "废标项/强制要求无响应覆盖，必须处理"
            else:
                message = "未找到匹配的修订或章节内容"

        # 强制要求（is_mandatory）无覆盖时提升为 FAIL
        if req.get("is_mandatory") and check_status != "FAIL" and not accepted_revs:
            check_status = "FAIL"
            message = "强制要求无已接受的修订覆盖"

        # 建议动作
        if check_status == "FAIL":
            suggested_action = "为该项添加 AIRevision 内容或手动填写章节内容"
        elif check_status == "WARNING":
            suggested_action = "确认或拒绝待处理的修订"
        else:
            suggested_action = ""

        if check_status == "PASS":
            pass_count += 1
        elif check_status == "FAIL":
            fail_count += 1
        else:
            warning_count += 1

        items.append({
            "requirement_id": rid,
            "requirement_type": req.get("requirement_type", ""),
            "title": req.get("title", ""),
            "description": req.get("description", ""),
            "is_mandatory": req.get("is_mandatory", False),
            "risk_level": req.get("risk_level", "medium"),
            "status": check_status,
            "message": message,
            "suggested_action": suggested_action,
            "matched_revision_ids": matched_rev_ids,
        })

    total = len(requirements)
    coverage_rate = pass_count / total if total > 0 else 1.0
    has_blocking = any(
        item["risk_level"] == "blocking" and item["status"] == "FAIL"
        for item in items
    )

    return {
        "project_id": project_id,
        "status": "success",
        "error": "",
        "total_requirements": total,
        "pass_count": pass_count,
        "fail_count": fail_count,
        "warning_count": warning_count,
        "coverage_rate": round(coverage_rate, 4),
        "has_blocking_issues": has_blocking,
        "items": items,
    }
