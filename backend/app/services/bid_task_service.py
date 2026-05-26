"""标书任务拆解服务 — 根据招标要求自动生成 bid_tasks。

输入：项目 ID（需已有 requirements 数据）
输出：按任务类型拆解的 bid_tasks 列表，写入 bid_tasks 表。
"""

import re
from typing import Any

from app.gateway.supabase_gateway import SupabaseGateway

# requirement_type → task_type 的映射关系
_REQUIREMENT_TO_TASK: dict[str, str] = {
    "business_requirement": "商务标",
    "project_basic_info": "商务标",
    "technical_requirement": "技术标",
    "qualification_requirement": "资质材料",
    "delivery_requirement": "售后服务",
    "scoring_criteria": "响应表",
    "disqualification_item": "格式检查",
    "format_requirement": "格式检查",
}

# task_type → section_path 分组标签
_TASK_SECTION_MAP: dict[str, str] = {
    "商务标": "商务标",
    "技术标": "技术标",
    "报价": "商务标/报价",
    "资质材料": "商务标/资质材料",
    "项目案例": "商务标/项目案例",
    "人员材料": "技术标/人员材料",
    "售后服务": "技术标/售后服务",
    "偏离表": "商务标/偏离表",
    "响应表": "技术标/响应表",
    "格式检查": "格式检查",
}

# 敏感任务类型 → 默认 assignee_type = human_required
_SENSITIVE_TASK_TYPES = {"报价", "资质材料", "偏离表"}

# 关键词触发的特定任务类型
_KEYWORD_TASK_RULES: list[tuple[str, str, list[str]]] = [
    ("报价", "报价", ["报价", "投标报价", "价格", "预算", "金额", "总价", "单价"]),
    ("项目案例", "项目案例", ["案例", "业绩", "项目经验", "类似项目", "合同证明"]),
    ("人员材料", "人员材料", ["人员", "团队", "项目经理", "负责人", "技术人员", "工程师"]),
    ("偏离表", "偏离表", ["偏离", "偏差", "差异", "不响应"]),
]


def _extract_task_type(req_type: str) -> str:
    """根据 requirement_type 映射到基础 task_type。"""
    return _REQUIREMENT_TO_TASK.get(req_type, "技术标")


def _detect_special_task_types(
    req: dict[str, Any],
) -> list[str]:
    """根据需求文本中的关键词检测特殊任务类型（报价/案例/人员/偏离表）。"""
    title = req.get("title", "")
    desc = req.get("description", "")
    combined = f"{title} {desc}"

    detected: list[str] = []
    for task_type, _, keywords in _KEYWORD_TASK_RULES:
        for kw in keywords:
            if kw in combined:
                if task_type not in detected:
                    detected.append(task_type)
                break
    return detected


def _compute_priority(reqs: list[dict[str, Any]]) -> str:
    """根据关联需求的最高优先级确定任务优先级。"""
    has_high = any(r.get("priority") == "high" for r in reqs)
    if has_high:
        return "high"
    has_low = all(r.get("priority") == "low" for r in reqs)
    if has_low:
        return "low"
    return "medium"


def _compute_assignee_type(task_type: str) -> str:
    """根据任务类型确定负责人类型，敏感任务默认 human_required。"""
    if task_type in _SENSITIVE_TASK_TYPES:
        return "human_required"
    if task_type in ("商务标", "技术标"):
        return "ai_then_human"
    if task_type == "格式检查":
        return "ai"
    return "ai"


def _generate_task_title(task_type: str, req_count: int) -> str:
    """根据任务类型和关联需求数生成任务标题。"""
    if req_count <= 1:
        return f"编制{task_type}"
    return f"编制{task_type}（{req_count} 条要求）"


async def decompose_project_tasks(project_id: str) -> dict[str, Any]:
    """根据项目招标要求拆解标书制作任务清单。

    按 requirement_type 和关键词匹配生成 bid_tasks，
    敏感任务（报价/资质/偏离表）默认 assignee_type = human_required。
    """
    gw = SupabaseGateway()

    project = gw.get_project(project_id)
    if not project:
        raise ValueError(f"项目不存在: {project_id}")

    requirements = gw.get_requirements(project_id)
    if not requirements:
        return {
            "project_id": project_id,
            "status": "success",
            "total_tasks": 0,
            "tasks": [],
        }

    # 第一步：按 requirement_type 分组
    type_groups: dict[str, list[dict[str, Any]]] = {}
    for req in requirements:
        req_type = req.get("requirement_type", "technical_requirement")
        task_type = _extract_task_type(req_type)
        if task_type not in type_groups:
            type_groups[task_type] = []
        type_groups[task_type].append(req)

    # 第二步：检测关键词触发的特殊任务类型，从基础分组中拆分出相关需求
    special_groups: dict[str, list[dict[str, Any]]] = {}
    for req in requirements:
        special_types = _detect_special_task_types(req)
        for st in special_types:
            if st not in special_groups:
                special_groups[st] = []
            special_groups[st].append(req)

    # 第三步：构建任务列表
    tasks: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    # 特殊任务优先
    for task_type in ["报价", "资质材料", "项目案例", "人员材料", "偏离表"]:
        reqs = special_groups.get(task_type, [])
        if not reqs:
            continue
        req_ids = [r["id"] for r in reqs]
        seen_ids.update(req_ids)
        tasks.append({
            "title": _generate_task_title(task_type, len(req_ids)),
            "task_type": task_type,
            "related_requirement_ids": req_ids,
            "assignee_type": _compute_assignee_type(task_type),
            "priority": _compute_priority(reqs),
            "status": "pending",
            "section_path": _TASK_SECTION_MAP.get(task_type, task_type),
        })

    # 基础任务类型（排除已被特殊任务覆盖的需求）
    for task_type, reqs in type_groups.items():
        remaining_reqs = [r for r in reqs if r["id"] not in seen_ids]
        if not remaining_reqs:
            continue
        req_ids = [r["id"] for r in remaining_reqs]
        seen_ids.update(req_ids)
        tasks.append({
            "title": _generate_task_title(task_type, len(req_ids)),
            "task_type": task_type,
            "related_requirement_ids": req_ids,
            "assignee_type": _compute_assignee_type(task_type),
            "priority": _compute_priority(remaining_reqs),
            "status": "pending",
            "section_path": _TASK_SECTION_MAP.get(task_type, task_type),
        })

    if not tasks:
        return {
            "project_id": project_id,
            "status": "success",
            "total_tasks": 0,
            "tasks": [],
        }

    # 第四步：写入 bid_tasks 表（先清除旧的拆解结果）
    gw.delete_bid_tasks_by_project(project_id)

    db_records: list[dict[str, Any]] = []
    for t in tasks:
        db_records.append({
            "project_id": project_id,
            "title": t["title"],
            "task_type": t["task_type"],
            "related_requirement_ids": t["related_requirement_ids"],
            "assignee_type": t["assignee_type"],
            "priority": t["priority"],
            "status": t["status"],
            "section_path": t["section_path"],
        })

    inserted = gw.insert_bid_tasks(db_records)

    return {
        "project_id": project_id,
        "status": "success",
        "total_tasks": len(inserted),
        "tasks": [
            {
                "title": r["title"],
                "task_type": r["task_type"],
                "related_requirement_ids": r["related_requirement_ids"],
                "assignee_type": r["assignee_type"],
                "priority": r["priority"],
                "status": r["status"],
                "section_path": r.get("section_path", ""),
            }
            for r in inserted
        ],
    }
