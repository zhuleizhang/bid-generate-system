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
