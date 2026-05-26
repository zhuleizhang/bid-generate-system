"""Supabase 网关 — 封装 Storage 和 Database 操作。"""

from typing import Any

from supabase import Client, create_client

from app.core.config import get_settings


def get_supabase_client() -> Client:
    """创建 Supabase 客户端，使用 service_role_key 以获得完整权限。"""
    settings = get_settings()
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY
    return create_client(settings.SUPABASE_URL, key)


class SupabaseGateway:
    """封装 Supabase Storage 和 Database 的常用操作。"""

    def __init__(self) -> None:
        self.client = get_supabase_client()
        self.bucket = get_settings().STORAGE_BUCKET_DOCUMENTS

    def upload_file(self, path: str, file_bytes: bytes, mime_type: str) -> str:
        """上传文件到 Storage，返回存储路径。"""
        self.client.storage.from_(self.bucket).upload(
            path,
            file_bytes,
            {"content-type": mime_type},
        )
        return path

    def get_file_url(self, path: str) -> str:
        """获取文件的公开访问 URL（60 分钟有效）。"""
        return self.client.storage.from_(self.bucket).get_public_url(path)

    def download_file(self, path: str) -> bytes:
        """从 Storage 下载文件内容（按 bucket 相对路径）。"""
        return self.client.storage.from_(self.bucket).download(path)

    def download_file_by_url(self, url: str) -> bytes:
        """通过公开 URL 下载文件内容。"""
        import httpx
        resp = httpx.get(url, follow_redirects=True)
        resp.raise_for_status()
        return resp.content

    def insert_document(self, data: dict[str, Any]) -> dict[str, Any]:
        """在 documents 表中创建记录，返回插入后的文档数据。"""
        result = self.client.table("documents").insert(data).execute()
        items: list[dict[str, Any]] = result.data  # type: ignore[assignment]
        return items[0] if items else {}

    def get_document(self, doc_id: str) -> dict[str, Any] | None:
        """按 ID 查询文档记录。"""
        result = self.client.table("documents").select("*").eq("id", doc_id).execute()
        items: list[dict[str, Any]] = result.data  # type: ignore[assignment]
        return items[0] if items else None

    # ── Document Nodes ──────────────────────────────────────────

    def insert_document_nodes(self, nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """批量插入文档节点，返回插入后的节点列表（含数据库生成的 id）。"""
        all_inserted: list[dict[str, Any]] = []
        # 分批插入，每批最多 100 条，避免单次请求过大
        batch_size = 100
        for i in range(0, len(nodes), batch_size):
            batch = nodes[i : i + batch_size]
            result = self.client.table("document_nodes").insert(batch).execute()
            items: list[dict[str, Any]] = result.data  # type: ignore[assignment]
            all_inserted.extend(items)
        return all_inserted

    def delete_document_nodes(self, document_id: str) -> None:
        """删除指定文档的所有解析节点。"""
        self.client.table("document_nodes").delete().eq("document_id", document_id).execute()

    def get_document_nodes(self, document_id: str) -> list[dict[str, Any]]:
        """查询指定文档的所有节点，按 order_index 排序。"""
        result = (
            self.client.table("document_nodes")
            .select("*")
            .eq("document_id", document_id)
            .order("order_index")
            .execute()
        )
        items: list[dict[str, Any]] = result.data  # type: ignore[assignment]
        return items

    def update_document_status(self, doc_id: str, status: str) -> dict[str, Any]:
        """更新文档状态。"""
        result = self.client.table("documents").update({"status": status}).eq("id", doc_id).execute()
        items: list[dict[str, Any]] = result.data  # type: ignore[assignment]
        return items[0] if items else {}

    def update_node_parent(self, node_id: str, parent_node_id: str) -> None:
        """更新单个节点的 parent_node_id。"""
        self.client.table("document_nodes").update({"parent_node_id": parent_node_id}).eq("id", node_id).execute()

    def update_node_section(self, node_id: str, section_id: str) -> None:
        """更新单个节点的 section_id。"""
        self.client.table("document_nodes").update({"section_id": section_id}).eq("id", node_id).execute()

    def delete_section_contents(self, document_id: str) -> None:
        """删除指定文档的所有章节内容记录。"""
        self.client.table("section_contents").delete().eq("document_id", document_id).execute()

    def insert_section_contents(self, contents: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """批量插入章节内容记录。"""
        all_inserted: list[dict[str, Any]] = []
        batch_size = 100
        for i in range(0, len(contents), batch_size):
            batch = contents[i : i + batch_size]
            result = self.client.table("section_contents").insert(batch).execute()
            items: list[dict[str, Any]] = result.data  # type: ignore[assignment]
            all_inserted.extend(items)
        return all_inserted

    def get_section_contents(self, document_id: str) -> list[dict[str, Any]]:
        """查询指定文档的章节内容列表。"""
        result = (
            self.client.table("section_contents")
            .select("*")
            .eq("document_id", document_id)
            .order("created_at")
            .execute()
        )
        items: list[dict[str, Any]] = result.data  # type: ignore[assignment]
        return items

    # ── Template Slots ──────────────────────────────────────────

    def insert_template_slots(self, slots: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """批量插入 TemplateSlot 记录。"""
        all_inserted: list[dict[str, Any]] = []
        batch_size = 100
        for i in range(0, len(slots), batch_size):
            batch = slots[i : i + batch_size]
            result = self.client.table("template_slots").insert(batch).execute()
            items: list[dict[str, Any]] = result.data  # type: ignore[assignment]
            all_inserted.extend(items)
        return all_inserted

    def delete_template_slots(self, document_id: str) -> None:
        """删除指定文档的所有 TemplateSlot 记录。"""
        self.client.table("template_slots").delete().eq("document_id", document_id).execute()

    def get_template_slots(self, document_id: str) -> list[dict[str, Any]]:
        """查询指定文档的所有 TemplateSlot 记录。"""
        result = (
            self.client.table("template_slots")
            .select("*")
            .eq("document_id", document_id)
            .order("created_at")
            .execute()
        )
        items: list[dict[str, Any]] = result.data  # type: ignore[assignment]
        return items

    def update_template_slot_content_type(self, slot_id: str, content_type: str) -> None:
        """更新单条 TemplateSlot 的 expected_content_type。"""
        self.client.table("template_slots").update(
            {"expected_content_type": content_type}
        ).eq("id", slot_id).execute()

    # ── Model Call Logs ─────────────────────────────────────────

    # ── Unfinished Items ────────────────────────────────────────

    def insert_unfinished_items(self, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """批量插入 UnfinishedItem 记录。"""
        all_inserted: list[dict[str, Any]] = []
        batch_size = 100
        for i in range(0, len(items), batch_size):
            batch = items[i : i + batch_size]
            result = self.client.table("unfinished_items").insert(batch).execute()
            inserted: list[dict[str, Any]] = result.data  # type: ignore[assignment]
            all_inserted.extend(inserted)
        return all_inserted

    def delete_unfinished_items(self, document_id: str) -> None:
        """删除指定文档的所有 UnfinishedItem 记录。"""
        self.client.table("unfinished_items").delete().eq("document_id", document_id).execute()

    def get_unfinished_items(self, document_id: str) -> list[dict[str, Any]]:
        """查询指定文档的所有 UnfinishedItem 记录，按 risk_level 降序排列。"""
        result = (
            self.client.table("unfinished_items")
            .select("*")
            .eq("document_id", document_id)
            .order("created_at")
            .execute()
        )
        items: list[dict[str, Any]] = result.data  # type: ignore[assignment]
        # risk_level 降序：blocking > high > medium > low
        risk_order = {"blocking": 0, "high": 1, "medium": 2, "low": 3}
        items.sort(key=lambda x: risk_order.get(x.get("risk_level", "low"), 99))
        return items

    # ── Model Call Logs ─────────────────────────────────────────

    def insert_model_call_log(self, data: dict[str, Any]) -> dict[str, Any]:
        """插入一条 LLM 调用日志记录。"""
        result = self.client.table("model_call_logs").insert(data).execute()
        items: list[dict[str, Any]] = result.data  # type: ignore[assignment]
        return items[0] if items else {}

    # ── Projects ─────────────────────────────────────────────────

    def insert_project(self, data: dict[str, Any]) -> dict[str, Any]:
        """创建项目记录，返回插入后的项目数据。"""
        result = self.client.table("projects").insert(data).execute()
        items: list[dict[str, Any]] = result.data  # type: ignore[assignment]
        return items[0] if items else {}

    def get_projects(
        self, page: int = 1, page_size: int = 20, status: str | None = None, search: str | None = None
    ) -> tuple[list[dict[str, Any]], int]:
        """分页查询项目列表，支持按状态筛选和名称搜索，返回 (items, total)。"""
        query = self.client.table("projects").select("*", count="exact")  # type: ignore[arg-type]

        if status:
            query = query.eq("status", status)
        if search:
            query = query.ilike("name", f"%{search}%")

        offset = (page - 1) * page_size
        result = query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
        items: list[dict[str, Any]] = result.data  # type: ignore[assignment]
        total = result.count or 0  # type: ignore[union-attr]
        return items, total

    def get_project(self, project_id: str) -> dict[str, Any] | None:
        """按 ID 查询单个项目。"""
        result = self.client.table("projects").select("*").eq("id", project_id).execute()
        items: list[dict[str, Any]] = result.data  # type: ignore[assignment]
        return items[0] if items else None

    def update_project(self, project_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
        """更新项目信息，返回更新后的记录。"""
        result = self.client.table("projects").update(data).eq("id", project_id).execute()
        items: list[dict[str, Any]] = result.data  # type: ignore[assignment]
        return items[0] if items else None

    def delete_project(self, project_id: str) -> bool:
        """删除项目，返回是否成功。"""
        result = self.client.table("projects").delete().eq("id", project_id).execute()
        items: list[dict[str, Any]] = result.data  # type: ignore[assignment]
        return len(items) > 0

    def get_project_document_count(self, project_id: str) -> int:
        """查询项目下的文件数量。"""
        result = (
            self.client.table("documents")
            .select("*", count="exact")  # type: ignore[arg-type]
            .eq("project_id", project_id)
            .execute()
        )
        return result.count or 0  # type: ignore[union-attr]
