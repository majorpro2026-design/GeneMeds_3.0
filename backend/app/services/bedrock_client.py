from __future__ import annotations

import base64
import json
import os
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError


class BedrockError(RuntimeError):
    """Raised when a Bedrock invocation fails or returns an unusable response."""


_DEFAULT_REGION = os.getenv("AWS_REGION", os.getenv("AWS_DEFAULT_REGION", "us-east-1"))

# Anthropic Claude on Bedrock is used for both OCR (multimodal) and chat, since it
# accepts the same Messages-API request shape for text-only and image+text calls.
# Override via env if your account uses different model IDs / regions / inference profiles.
OCR_MODEL_ID = os.getenv("BEDROCK_OCR_MODEL_ID", "anthropic.claude-3-5-sonnet-20241022-v2:0")
CHAT_MODEL_ID = os.getenv("BEDROCK_CHAT_MODEL_ID", "anthropic.claude-3-5-sonnet-20241022-v2:0")

_ANTHROPIC_VERSION = "bedrock-2023-05-31"

_MEDIA_TYPES = {
    "image/jpeg": "image/jpeg",
    "image/png": "image/png",
    "image/webp": "image/webp",
    "image/tiff": "image/tiff",
}

_client = None


def _get_client():
    """Lazily create a single shared bedrock-runtime client.

    Credentials are resolved the normal boto3 way (env vars, shared config/
    credentials files, or an instance/task role) — nothing is hardcoded here.
    """
    global _client
    if _client is None:
        _client = boto3.client(
            "bedrock-runtime",
            region_name=_DEFAULT_REGION,
            config=Config(retries={"max_attempts": 3, "mode": "standard"}),
        )
    return _client


def _media_type_for(content_type: str) -> str:
    return _MEDIA_TYPES.get(content_type, "image/jpeg")


def _extract_text(payload: dict[str, Any]) -> str:
    blocks = payload.get("content", [])
    parts = [
        block.get("text", "")
        for block in blocks
        if isinstance(block, dict) and block.get("type") == "text"
    ]
    return "\n".join(part for part in parts if part).strip()


def _invoke(model_id: str, body: dict[str, Any]) -> dict[str, Any]:
    client = _get_client()
    try:
        response = client.invoke_model(
            modelId=model_id,
            body=json.dumps(body),
            contentType="application/json",
            accept="application/json",
        )
    except (BotoCoreError, ClientError) as exc:
        raise BedrockError(f"Bedrock invocation failed: {exc}") from exc

    try:
        return json.loads(response["body"].read())
    except (json.JSONDecodeError, KeyError) as exc:
        raise BedrockError(f"Bedrock returned an unparseable response: {exc}") from exc


def invoke_vision_text(
    *,
    image_bytes: bytes,
    content_type: str,
    prompt: str,
    model_id: str | None = None,
    max_tokens: int = 2048,
    temperature: float = 0.0,
) -> str:
    """Send a single image + text prompt to a Bedrock multimodal model, return the text reply."""
    b64_image = base64.standard_b64encode(image_bytes).decode()

    body = {
        "anthropic_version": _ANTHROPIC_VERSION,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": _media_type_for(content_type),
                            "data": b64_image,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    }

    payload = _invoke(model_id or OCR_MODEL_ID, body)
    text = _extract_text(payload)
    if not text:
        raise BedrockError("Bedrock returned no text content for the OCR request.")
    return text


def invoke_chat(
    *,
    messages: list[dict[str, str]],
    system: str | None = None,
    model_id: str | None = None,
    max_tokens: int = 1024,
    temperature: float = 0.4,
) -> str:
    """Send a text-only conversation to Bedrock and return the assistant's reply."""
    body: dict[str, Any] = {
        "anthropic_version": _ANTHROPIC_VERSION,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": [
            {"role": m["role"], "content": [{"type": "text", "text": m["content"]}]}
            for m in messages
        ],
    }
    if system:
        body["system"] = system

    payload = _invoke(model_id or CHAT_MODEL_ID, body)
    return _extract_text(payload)
