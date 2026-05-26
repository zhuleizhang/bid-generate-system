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
        """从 Storage 下载文件内容。"""
        return self.client.storage.from_(self.bucket).download(path)

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
