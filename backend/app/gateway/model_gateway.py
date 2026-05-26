"""Model Gateway — 封装 LLM 调用，支持 OpenAI 兼容 API。"""

import json
import time
from typing import Any

import httpx

from app.core.config import get_settings


class ModelGateway:
    """通过 httpx 调用 OpenAI 兼容的 LLM API。"""

    def __init__(self) -> None:
        settings = get_settings()
        self.base_url: str = settings.MODEL_GATEWAY_URL.rstrip("/")
        self.api_key: str = settings.MODEL_GATEWAY_API_KEY
        self.default_model: str = settings.DEFAULT_MODEL

    async def chat_completion(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 512,
    ) -> dict[str, Any]:
        """发送 chat completion 请求，返回 {content, model, prompt_tokens, completion_tokens, total_tokens, duration_ms, error}。"""
        start_time = time.monotonic()

        payload: dict[str, Any] = {
            "model": model or self.default_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                )
                resp.raise_for_status()
                body = resp.json()

            choice = body["choices"][0]
            usage = body.get("usage", {})

            return {
                "content": choice["message"]["content"],
                "model": body.get("model", model or self.default_model),
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
                "duration_ms": int((time.monotonic() - start_time) * 1000),
                "error": None,
            }
        except Exception as e:
            return {
                "content": None,
                "model": model or self.default_model,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0,
                "duration_ms": int((time.monotonic() - start_time) * 1000),
                "error": str(e),
            }

    def build_call_log(
        self,
        scenario: str,
        result: dict[str, Any],
        request_json: dict[str, Any],
    ) -> dict[str, Any]:
        """根据 chat_completion 结果构造 model_call_logs 插入数据。"""
        return {
            "scenario": scenario,
            "model_name": result["model"],
            "prompt_tokens": result["prompt_tokens"],
            "completion_tokens": result["completion_tokens"],
            "total_tokens": result["total_tokens"],
            "duration_ms": result["duration_ms"],
            "status": "success" if result["error"] is None else "error",
            "error_message": result["error"],
            "request_json": json.dumps(request_json, ensure_ascii=False),
            "response_json": result.get("content"),
        }
