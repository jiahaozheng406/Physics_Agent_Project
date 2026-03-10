from __future__ import annotations

import base64
import json
import urllib.error
import urllib.request
from typing import Any, Iterable

from openai import OpenAI


def extract_delta_text(delta_content: Any) -> str:
    if delta_content is None:
        return ""
    if isinstance(delta_content, str):
        return delta_content
    if isinstance(delta_content, list):
        parts: list[str] = []
        for item in delta_content:
            if isinstance(item, str):
                parts.append(item)
                continue
            text_value = getattr(item, "text", None)
            if isinstance(text_value, str):
                parts.append(text_value)
                continue
            if isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        return "".join(parts)
    return str(delta_content)


class ModelGateway:
    def __init__(
        self,
        *,
        api_key: str,
        openai_base_url: str,
        dashscope_api_url: str,
        text_model: str,
        vision_model: str,
        audio_model: str,
    ):
        self.api_key = api_key
        self.openai_base_url = openai_base_url
        self.dashscope_api_url = dashscope_api_url
        self.text_model = text_model
        self.vision_model = vision_model
        self.audio_model = audio_model

    def _client(self) -> OpenAI:
        return OpenAI(api_key=self.api_key, base_url=self.openai_base_url)

    def stream_chat(self, *, messages: list[dict[str, Any]], model: str) -> Iterable[Any]:
        client = self._client()
        return client.chat.completions.create(model=model, messages=messages, stream=True)

    def call_audio(
        self,
        *,
        messages: list[dict[str, Any]],
    ) -> dict[str, Any]:
        payload = {
            "model": self.audio_model,
            "input": {"messages": messages},
        }
        body = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            self.dashscope_api_url,
            data=body,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"DashScope audio request failed: HTTP {exc.code} {detail}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"DashScope audio request failed: {exc.reason}") from exc

    def build_audio_messages(
        self,
        *,
        system_prompt: str,
        history_messages: list[dict[str, str]],
        audio_b64: str,
        audio_mime: str,
        text_prompt: str,
    ) -> list[dict[str, Any]]:
        user_content: list[dict[str, str]] = [
            {"audio": f"data:{audio_mime};base64,{audio_b64}"},
        ]
        if text_prompt.strip():
            user_content.append({"text": text_prompt.strip()})

        messages: list[dict[str, Any]] = [
            {
                "role": "system",
                "content": [{"text": system_prompt}],
            }
        ]
        for item in history_messages:
            if not item["content"].strip():
                continue
            messages.append(
                {
                    "role": item["role"],
                    "content": [{"text": item["content"]}],
                }
            )
        messages.append({"role": "user", "content": user_content})
        return messages


def encode_base64_bytes(raw: bytes) -> str:
    return base64.b64encode(raw).decode("utf-8")
