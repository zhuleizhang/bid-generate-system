"""应用配置 — 从环境变量读取 Supabase、Model Gateway、Storage 等配置。"""

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# 加载 backend/.env 文件
load_dotenv(Path(__file__).resolve().parents[2] / ".env")


class Settings:
    # 应用基础
    APP_NAME: str = "智能标书系统"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    # Model Gateway（LLM 调用）
    MODEL_GATEWAY_URL: str = os.getenv("MODEL_GATEWAY_URL", "")
    MODEL_GATEWAY_API_KEY: str = os.getenv("MODEL_GATEWAY_API_KEY", "")
    DEFAULT_MODEL: str = os.getenv("DEFAULT_MODEL", "gpt-4o")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")

    # Storage
    STORAGE_BUCKET_DOCUMENTS: str = os.getenv("STORAGE_BUCKET_DOCUMENTS", "documents")
    STORAGE_BUCKET_EXPORTS: str = os.getenv("STORAGE_BUCKET_EXPORTS", "exports")

    # CORS
    CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

    class Config:
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
