from __future__ import annotations

import os
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError


class BedrockError(RuntimeError):
    """Raised when a Bedrock invocation fails or returns an unusable response."""


_DEFAULT_REGION = os.getenv("AWS_REGION", os.getenv("AWS_DEFAULT_REGION", "us-east-1"))

# Amazon Nova is used here instead of Anthropic's Claude models. Anthropic models on
# Bedrock are billed through an AWS Marketplace "consumption pricing" contract, which
# AISPL (India) accounts cannot pay for with a card/UPI as the default payment method
# — only via invoicing terms. Nova is a first-party Amazon model billed directly like
# any other AWS service, so it isn't subject to that restriction.
#
# We use the Bedrock Converse API (client.converse) rather than the raw invoke_model
# request shape, since Converse is a single, model-agnostic interface that works the
# same way across Nova, Claude, and other Bedrock models — so swapping models again in
# future (env var only) won't require touching this request-building code.
OCR_MODEL_ID = os.getenv("BEDROCK_OCR_MODEL_ID", "amazon.nova-lite-v1:0")
CHAT_MODEL_ID = os.getenv("BEDROCK_CHAT_MODEL_ID", "amazon.nova-lite-v1:0")

_SUPPORTED_IMAGE_FORMATS = {
    "image/jpeg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
    "image/tiff": "jpeg",  # Converse API has no tiff support; best-effort fallback.
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


def _image_format_for(content_type: str) -> str:
    return _SUPPORTED_IMAGE_FORMATS.get(content_type, "jpeg")


def _extract_text(response: dict[str, Any]) -> str:
    try:
        blocks = response["output"]["message"]["content"]
    except (KeyError, TypeError):
        return ""
    parts = [b.get("text", "") for b in blocks if isinstance(b, dict) and "text" in b]
    return "\n".join(part for part in parts if part).strip()


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
    client = _get_client()

    try:
        response = client.converse(
            modelId=model_id or OCR_MODEL_ID,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "image": {
                                "format": _image_format_for(content_type),
                                "source": {"bytes": image_bytes},
                            }
                        },
                        {"text": prompt},
                    ],
                }
            ],
            inferenceConfig={"maxTokens": max_tokens, "temperature": temperature},
        )
    except (BotoCoreError, ClientError) as exc:
        raise BedrockError(f"Bedrock invocation failed: {exc}") from exc

    text = _extract_text(response)
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
    client = _get_client()

    kwargs: dict[str, Any] = {
        "modelId": model_id or CHAT_MODEL_ID,
        "messages": [
            {"role": m["role"], "content": [{"text": m["content"]}]}
            for m in messages
        ],
        "inferenceConfig": {"maxTokens": max_tokens, "temperature": temperature},
    }
    if system:
        kwargs["system"] = [{"text": system}]

    try:
        response = client.converse(**kwargs)
    except (BotoCoreError, ClientError) as exc:
        raise BedrockError(f"Bedrock invocation failed: {exc}") from exc

    return _extract_text(response)