from __future__ import annotations

import json
import os
from typing import Any

from sqlalchemy import text

from app.auth.user_schemas import UserResponse

CLINIC_TZ = os.getenv("CLINIC_TIMEZONE", "Asia/Kolkata")
MAX_BIGINT = 9_223_372_036_854_775_807


def iso(v: Any) -> str | None:
    return v.isoformat() if v is not None else None


def like_pattern(q: str) -> str:
    return "%" + q.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%"


def log_audit(conn: Any, actor: UserResponse, action: str, target_type: str, target_id: int, details: dict | None = None) -> None:
    conn.execute(
        text(
            """
            INSERT INTO core.audit_log (actor_user_id, actor_role, action, target_type, target_id, details)
            VALUES (:actor, :role, :action, :tt, :tid, CAST(:details AS jsonb))
            """
        ),
        {"actor": actor.id, "role": actor.role, "action": action, "tt": target_type, "tid": target_id,
         "details": json.dumps(details or {})},
    )