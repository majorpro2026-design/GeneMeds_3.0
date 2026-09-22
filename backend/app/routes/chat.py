from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.services.bedrock_client import BedrockError, invoke_chat


router = APIRouter(prefix="/api")

_SYSTEM_PROMPT = (
    "You are the GeneMeds assistant, embedded in a clinician-facing prescription "
    "workflow that combines drug prescribing with CPIC pharmacogenomic guidance. "
    "Help the doctor with questions about using the app (adding medicines, "
    "entering diplotypes, reading gene test recommendations, uploading lab "
    "reports) and with general pharmacogenomics questions. You are not a "
    "substitute for clinical judgement — when relevant, remind the user to "
    "confirm any drug safety decision against the full CPIC guideline and their "
    "own clinical assessment. Keep answers concise and practical."
)

_MAX_HISTORY_MESSAGES = 20


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1)
    # Optional lightweight context (e.g. drugs currently on the prescription)
    # so the assistant can answer "what does this recommendation mean" style
    # questions without the frontend re-sending the whole page.
    context: dict[str, Any] | None = None


@router.post("/chat")
def chat(payload: ChatRequest) -> Any:
    # Keep only the most recent turns — this is a lightweight assistant, not a
    # long-running case history, and it keeps token usage bounded.
    trimmed = payload.messages[-_MAX_HISTORY_MESSAGES:]
    messages = [{"role": m.role, "content": m.content} for m in trimmed]

    system = _SYSTEM_PROMPT
    if payload.context:
        system += f"\n\nCurrent prescription context (JSON): {payload.context}"

    try:
        reply = invoke_chat(messages=messages, system=system)
    except BedrockError as exc:
        return JSONResponse(status_code=502, content={"detail": str(exc)})

    if not reply:
        return JSONResponse(status_code=502, content={"detail": "Empty response from the assistant."})

    return {"reply": reply}
