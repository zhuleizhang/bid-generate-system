"""未完成项 API — 状态变更与补充资料流程。"""

import io
import json

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from app.gateway.supabase_gateway import SupabaseGateway
from app.gateway.model_gateway import ModelGateway

unfinished_router = APIRouter(prefix="/unfinished", tags=["unfinished"])


class UnfinishedStatusUpdate(BaseModel):
    """UnfinishedItem 状态变更请求体。"""

    status: str  # resolved / ignored
    ignore_reason: str | None = None  # ignored 时必填


class ManualFillRequest(BaseModel):
    """手动填写请求体。"""

    content: str  # 用户填写的内容


def _parse_llm_response(raw: str | None) -> dict:
    """解析 LLM JSON 响应，支持纯 JSON、```json``` 代码块和裸文本三种格式。"""
    if not raw:
        return {}
    text = raw.strip()
    if text.startswith("```json"):
        text = text.removeprefix("```json").removesuffix("```").strip()
    elif text.startswith("```"):
        text = text.removeprefix("```").removesuffix("```").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {}


@unfinished_router.get("/count")
async def count_unfinished_items():
    """获取全局未完成项计数（按风险等级分组）。

    返回 {total, blocking, high, medium, low}。
    前端 MainLayout 顶栏使用此数据渲染 Badge。
    """
    gw = SupabaseGateway()
    # 直接从数据库获取所有 status=pending 的未完成项
    try:
        # 通过底层 Supabase client 查询
        result = gw.client.table("unfinished_items").select("*", count="exact").eq("status", "pending").execute()  # type: ignore[arg-type]
        items: list[dict] = result.data  # type: ignore[assignment]
        total = result.count or 0  # type: ignore[union-attr]

        counts: dict[str, int] = {"total": total, "blocking": 0, "high": 0, "medium": 0, "low": 0}
        for item in items:
            risk: str = item.get("risk_level", "low")
            if risk in counts:
                counts[risk] += 1
        return counts
    except Exception:
        return {"total": 0, "blocking": 0, "high": 0, "medium": 0, "low": 0}


@unfinished_router.get("/project/{project_id}/count")
async def count_project_unfinished_items(project_id: str):
    """获取指定项目的未完成项计数。"""
    gw = SupabaseGateway()
    docs = gw.get_documents_by_project(project_id)
    if not docs:
        return {"total": 0, "blocking": 0, "high": 0, "medium": 0, "low": 0}

    counts: dict[str, int] = {"total": 0, "blocking": 0, "high": 0, "medium": 0, "low": 0}
    for doc in docs:
        items = gw.get_unfinished_items(doc["id"])
        for item in items:
            if item.get("status") == "pending":
                risk: str = item.get("risk_level", "low")
                counts["total"] += 1
                if risk in counts:
                    counts[risk] += 1
    return counts


@unfinished_router.get("/{item_id}")
async def get_unfinished_item(item_id: str):
    """查询单条 UnfinishedItem 记录。"""
    gw = SupabaseGateway()
    item = gw.get_unfinished_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="未完成项不存在")
    return item


@unfinished_router.patch("/{item_id}/status")
async def update_unfinished_item_status(item_id: str, body: UnfinishedStatusUpdate):
    """更新 UnfinishedItem 状态（resolved / ignored）。

    ignored 时必须提供 ignore_reason，会一并写入 audit_logs。
    """
    gw = SupabaseGateway()

    item = gw.get_unfinished_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="未完成项不存在")

    if body.status == "ignored" and not body.ignore_reason:
        raise HTTPException(status_code=400, detail="忽略未完成项时需填写忽略原因")

    update_data: dict = {"status": body.status}
    if body.ignore_reason:
        # 将忽略原因存入现有 metadata 或直接写入
        existing_meta = item.get("metadata") or {}
        if isinstance(existing_meta, str):
            try:
                existing_meta = json.loads(existing_meta)
            except json.JSONDecodeError:
                existing_meta = {}
        existing_meta["ignore_reason"] = body.ignore_reason
        update_data["metadata"] = existing_meta

    updated = gw.update_unfinished_item(item_id, update_data)
    if not updated:
        raise HTTPException(status_code=500, detail="状态更新失败")

    # 记录审计日志
    gw.insert_audit_log({
        "entity_type": "unfinished_item",
        "entity_id": item_id,
        "action": f"mark_{body.status}",
        "details": {
            "old_status": item.get("status"),
            "new_status": body.status,
            "document_id": item.get("document_id"),
            "ignore_reason": body.ignore_reason,
        },
    })

    return updated


@unfinished_router.post("/{item_id}/manual-fill")
async def manual_fill_unfinished_item(item_id: str, body: ManualFillRequest):
    """手动填写未完成项内容，创建一条 status=accepted 的 AIRevision，
    并将未完成项标记为 resolved。
    """
    gw = SupabaseGateway()

    item = gw.get_unfinished_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="未完成项不存在")

    if not body.content.strip():
        raise HTTPException(status_code=400, detail="填写内容不能为空")

    # 根据 template_slot 推断 revision_type
    revision_type = "replace"
    fill_strategy = "replace"
    template_slot_id = item.get("template_slot_id")
    node_id = item.get("node_id")

    if template_slot_id:
        slot = gw.get_template_slot(template_slot_id)
        if slot:
            strategy = slot.get("fill_strategy", "")
            if strategy == "append":
                revision_type = "append"
            elif strategy == "section_append":
                revision_type = "new_section"
            elif strategy == "cell_fill":
                revision_type = "replace"
            fill_strategy = strategy

    # 创建 AIRevision
    ai_revision_data = {
        "document_id": item["document_id"],
        "node_id": node_id,
        "template_slot_id": template_slot_id,
        "revision_type": revision_type,
        "before_content": None,
        "ai_content": body.content.strip(),
        "comment": "用户手动填写",
        "source_requirement_ids": [],
        "related_experience_ids": [],
        "risk_level": "low",
        "confidence": 1.0,
        "status": "accepted",
        "metadata": {"source": "manual_fill", "unfinished_item_id": item_id, "fill_strategy": fill_strategy},
    }

    revisions = gw.insert_ai_revisions([ai_revision_data])
    new_revision = revisions[0] if revisions else None

    # 标记未完成项为 resolved
    gw.update_unfinished_item(item_id, {"status": "resolved"})

    # 审计日志
    gw.insert_audit_log({
        "entity_type": "unfinished_item",
        "entity_id": item_id,
        "action": "manual_fill",
        "details": {
            "document_id": item.get("document_id"),
            "created_revision_id": new_revision["id"] if new_revision else None,
        },
    })

    return {
        "unfinished_item_id": item_id,
        "status": "resolved",
        "ai_revision": new_revision,
    }


@unfinished_router.post("/{item_id}/regenerate")
async def regenerate_unfinished_item(
    item_id: str,
    file: UploadFile = File(...),
):
    """上传补充资料后重新生成该位置 AIRevision。

    上传的补充文件会被解析为文本，作为额外上下文注入到 LLM prompt 中，
    重新为关联的 TemplateSlot 生成 AI 修订内容。
    """
    gw = SupabaseGateway()

    item = gw.get_unfinished_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="未完成项不存在")

    doc_id = item["document_id"]
    template_slot_id = item.get("template_slot_id")
    node_id = item.get("node_id")

    # 获取关联的 TemplateSlot
    slot = None
    if template_slot_id:
        slot = gw.get_template_slot(template_slot_id)

    # 获取上下文：前后节点
    nodes = gw.get_document_nodes(doc_id)
    context_before: list[str] = []
    context_after: list[str] = []
    target_idx = -1
    if node_id:
        for i, n in enumerate(nodes):
            if n["id"] == node_id:
                target_idx = i
                break
        if target_idx >= 0:
            for j in range(max(0, target_idx - 2), target_idx):
                t = (nodes[j].get("text") or "").strip()
                if t:
                    context_before.append(t)
            for j in range(target_idx + 1, min(len(nodes), target_idx + 3)):
                t = (nodes[j].get("text") or "").strip()
                if t:
                    context_after.append(t)

    # 解析上传的补充文件
    try:
        file_bytes = await file.read()
        file_name = file.filename or "supplement"
        supplement_text = ""
        if file_name.lower().endswith(".pdf"):
            try:
                import pdfplumber
                with pdfplumber.open(io.BytesIO(file_bytes)) as pdf_obj:
                    pages = [p.extract_text() or "" for p in pdf_obj.pages]
                supplement_text = "\n".join(pages)
            except Exception:
                from pypdf import PdfReader
                reader = PdfReader(io.BytesIO(file_bytes))
                supplement_text = "\n".join(p.extract_text() or "" for p in reader.pages)
        elif file_name.lower().endswith(".docx"):
            import docx as docx_lib
            docx_doc = docx_lib.Document(io.BytesIO(file_bytes))
            supplement_text = "\n".join(p.text for p in docx_doc.paragraphs)
        else:
            # 纯文本兜底（.doc 或 .txt）
            try:
                supplement_text = file_bytes.decode("utf-8")
            except UnicodeDecodeError:
                supplement_text = file_bytes.decode("gbk", errors="replace")

        supplement_text = supplement_text[:6000]  # 截取前 6000 字符控制 token
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"补充文件解析失败: {str(e)}")

    # 上传补充文件到 Storage
    safe_name = file_name.replace(" ", "_")
    storage_path = f"projects/{item.get('project_id', 'unknown')}/supplements/{item_id}/{safe_name}"
    mime_type = file.content_type or "application/octet-stream"
    gw.upload_file(storage_path, file_bytes, mime_type)

    # 获取项目招标要求作为补充上下文
    section_path = item.get("section_path") or ""
    expected_content_type = slot.get("expected_content_type", "") if slot else ""

    requirements_context = ""
    doc = gw.get_document(doc_id)
    if doc and doc.get("project_id"):
        reqs = gw.get_requirements(doc["project_id"])
        if reqs:
            req_lines = [f"- [{r.get('requirement_type', '')}] {r.get('title', '')}: {r.get('description', '')}" for r in reqs[:10]]
            requirements_context = "\n".join(req_lines)

    # 构建 LLM prompt
    prompt_content = f"""你是一名专业的标书撰写专家。用户补充了一份资料，请根据该资料和招标要求，为标书模板中的指定位置生成恰当的填充内容。

## 位置信息
- 章节路径：{section_path or "未知"}
- 内容类型：{expected_content_type or "通用"}
- 原文位置：{item.get('reason', '')}
- 建议动作：{item.get('suggested_action', '请生成合适的内容')}

## 上文
{chr(10).join(context_before) if context_before else "（无上文）"}

## 下文
{chr(10).join(context_after) if context_after else "（无下文）"}

## 招标要求
{requirements_context if requirements_context else "（无特定要求）"}

## 用户补充资料
{supplement_text}

## 要求
1. 根据补充资料生成专业、准确的标书内容
2. 内容与上下文体例保持一致
3. 只返回需要填充的内容文本，不要包含标题或解释
4. 返回 JSON 格式：{{"content": "生成的填充内容"}}
"""
    model_gw = ModelGateway()
    result = await model_gw.chat_completion(
        messages=[{"role": "user", "content": prompt_content}],
        temperature=0.3,
        max_tokens=1024,
    )

    llm_response = model_gw.build_call_log(
        scenario="regeneration",
        result=result,
        request_json={"section_path": section_path, "doc_id": doc_id, "unfinished_item_id": item_id},
    )
    gw.insert_model_call_log(llm_response)

    if result.get("error") or not result.get("content"):
        raise HTTPException(status_code=500, detail=f"内容生成失败: {result.get('error', 'LLM 返回为空')}")

    parsed = _parse_llm_response(result["content"])
    ai_content = parsed.get("content", result["content"]).strip()
    if not ai_content:
        raise HTTPException(status_code=500, detail="LLM 生成内容为空")

    # 推断 revision_type 和 fill_strategy
    revision_type = "replace"
    fill_strategy = "replace"
    if slot:
        strategy = slot.get("fill_strategy", "")
        if strategy == "append":
            revision_type = "append"
        elif strategy == "section_append":
            revision_type = "new_section"
        elif strategy == "cell_fill":
            revision_type = "replace"
        fill_strategy = strategy

    # 创建 AIRevision
    ai_revision_data = {
        "document_id": doc_id,
        "node_id": node_id,
        "template_slot_id": template_slot_id,
        "revision_type": revision_type,
        "before_content": None,
        "ai_content": ai_content,
        "comment": "补充资料后重新生成",
        "source_requirement_ids": [],
        "related_experience_ids": [],
        "risk_level": "medium",
        "confidence": 0.75,
        "status": "pending",
        "metadata": {"source": "regenerate", "unfinished_item_id": item_id, "fill_strategy": fill_strategy, "supplement_file": safe_name},
    }

    revisions = gw.insert_ai_revisions([ai_revision_data])
    new_revision = revisions[0] if revisions else None

    # 标记未完成项为 resolved
    gw.update_unfinished_item(item_id, {"status": "resolved"})

    # 审计日志
    gw.insert_audit_log({
        "entity_type": "unfinished_item",
        "entity_id": item_id,
        "action": "regenerate",
        "details": {
            "document_id": doc_id,
            "supplement_file": safe_name,
            "created_revision_id": new_revision["id"] if new_revision else None,
        },
    })

    return {
        "unfinished_item_id": item_id,
        "status": "resolved",
        "ai_revision": new_revision,
    }
