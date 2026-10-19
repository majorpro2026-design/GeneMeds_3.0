from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.auth.user_dependencies import require_roles
from app.auth.user_schemas import UserResponse
from app.database import engine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["Admin"])
class DecisionRequest(BaseModel):
    """Required for reject and suspend."""

    model_config = ConfigDict(str_strip_whitespace=True)
    reason: str = Field(..., min_length=5, max_length=500)


class OptionalDecisionRequest(BaseModel):
    """Optional for approve, reactivate and reopen."""

    model_config = ConfigDict(str_strip_whitespace=True)
    reason: str | None = Field(default=None, max_length=500)

MANAGED_ROLES = ("doctor", "receptionist")
MAX_BIGINT = 9_223_372_036_854_775_807

# action -> (status the account must currently have, status it moves to)
_TRANSITIONS: dict[str, tuple[str, str]] = {
    "approve": ("pending", "active"),
    "reject": ("pending", "rejected"),
    "suspend": ("active", "suspended"),
    "reactivate": ("suspended", "active"),
    "reopen": ("rejected", "pending"),
}


def _iso(value: Any) -> str | None:
    return value.isoformat() if value is not None else None


def _profile(row: Any) -> dict[str, Any]:
    if row["role"] == "doctor":
        return {
            "registrationNumber": row["registration_number"],
            "degrees": row["doctor_degrees"],
            "hospitalName": row["doctor_hospital_name"],
            "hospitalAddress": row["doctor_hospital_address"],
        }
    return {
        "degree": row["receptionist_degree"],
        "hospitalName": row["receptionist_hospital_name"],
        "hospitalAddress": row["receptionist_hospital_address"],
    }


@router.get("/users")
def list_users(
    status_filter: Literal["pending", "active", "suspended", "rejected"] | None = Query(None, alias="status"),
    role: Literal["doctor", "receptionist"] | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: UserResponse = Depends(require_roles("admin")),
) -> dict[str, Any]:
    query = text(
        """
        SELECT
            ua.id, ua.full_name, ua.email, ua.phone, ua.role, ua.status,
            ua.created_at, ua.approved_at, ua.approved_by,
            dp.registration_number,
            dp.degrees AS doctor_degrees,
            dp.hospital_name AS doctor_hospital_name,
            dp.hospital_address AS doctor_hospital_address,
            rp.degree AS receptionist_degree,
            rp.hospital_name AS receptionist_hospital_name,
            rp.hospital_address AS receptionist_hospital_address,
            COUNT(*) OVER() AS total
        FROM core.user_account ua
        LEFT JOIN core.doctor_profile dp ON dp.user_id = ua.id
        LEFT JOIN core.receptionist_profile rp ON rp.user_id = ua.id
        WHERE ua.role IN ('doctor', 'receptionist')
          AND (CAST(:status AS text) IS NULL OR ua.status = CAST(:status AS text))
          AND (CAST(:role AS text) IS NULL OR ua.role = CAST(:role AS text))
        ORDER BY ua.created_at DESC, ua.id DESC
        LIMIT :limit OFFSET :offset
        """
    )
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                query,
                {"status": status_filter, "role": role, "limit": limit, "offset": offset},
            ).mappings().all()
    except SQLAlchemyError:
        logger.exception("Admin user listing failed")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not load users.")

    items = [
        {
            "id": row["id"],
            "fullName": row["full_name"],
            "email": row["email"],
            "phone": row["phone"],
            "role": row["role"],
            "status": row["status"],
            "createdAt": _iso(row["created_at"]),
            "approvedAt": _iso(row["approved_at"]),
            "approvedBy": row["approved_by"],
            "profile": _profile(row),
        }
        for row in rows
    ]
    total = rows[0]["total"] if rows else 0
    return {"total": total, "limit": limit, "offset": offset, "items": items}


def _change_status(user_id: int, action: str, admin: UserResponse, reason: str | None) -> dict[str, Any]:
    required_status, new_status = _TRANSITIONS[action]

    if user_id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot change your own account.")

    # Constant SQL fragment (never user input): only 'approve' records who approved and when.
    approval_sql = ", approved_by = :admin_id, approved_at = now()" if action == "approve" else ""
    params: dict[str, Any] = {
        "id": user_id,
        "new_status": new_status,
        "required_status": required_status,
    }
    if action == "approve":
        params["admin_id"] = admin.id

    try:
        with engine.begin() as conn:
            row = conn.execute(
                text("SELECT role, status FROM core.user_account WHERE id = :id"),
                {"id": user_id},
            ).mappings().first()

            if row is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
            if row["role"] not in MANAGED_ROLES:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only doctor and receptionist accounts can be managed here.")
            if row["status"] != required_status:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    f"Cannot {action}: the account is currently '{row['status']}'.",
                )

            updated = conn.execute(
                text(
                    f"""
                    UPDATE core.user_account
                    SET status = :new_status, updated_at = now(){approval_sql}
                    WHERE id = :id AND status = :required_status
                    RETURNING id, status
                    """
                ),
                params,
            ).mappings().first()

            if updated is None:
                # Someone else changed the account between our check and the update.
                raise HTTPException(status.HTTP_409_CONFLICT, "The account was changed by someone else. Reload and retry.")

            # Same transaction: the status change and its audit row are saved together or not at all.
            conn.execute(
                text(
                    """
                    INSERT INTO core.audit_log
                        (actor_user_id, actor_role, action, target_type, target_id, reason, details)
                    VALUES
                        (:actor_id, :actor_role, :action, 'user', :target_id, :reason, CAST(:details AS jsonb))
                    """
                ),
                {
                    "actor_id": admin.id,
                    "actor_role": admin.role,
                    "action": f"user.{action}",
                    "target_id": user_id,
                    "reason": reason,
                    "details": json.dumps({"from": required_status, "to": new_status}),
                },
            )
    except HTTPException:
        raise
    except SQLAlchemyError:
        logger.exception("Status change failed (user_id=%s, action=%s)", user_id, action)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not update the account.")

    return {"id": updated["id"], "status": updated["status"], "message": f"Account {action} successful."}


@router.post("/users/{user_id}/approve")
def approve_user(
    user_id: int = Path(..., ge=1, le=MAX_BIGINT),
    payload: OptionalDecisionRequest | None = None,
    admin: UserResponse = Depends(require_roles("admin")),
) -> dict[str, Any]:
    return _change_status(user_id, "approve", admin, (payload.reason if payload else None) or None)


@router.post("/users/{user_id}/reject")
def reject_user(
    payload: DecisionRequest,
    user_id: int = Path(..., ge=1, le=MAX_BIGINT),
    admin: UserResponse = Depends(require_roles("admin")),
) -> dict[str, Any]:
    return _change_status(user_id, "reject", admin, payload.reason)


@router.post("/users/{user_id}/suspend")
def suspend_user(
    payload: DecisionRequest,
    user_id: int = Path(..., ge=1, le=MAX_BIGINT),
    admin: UserResponse = Depends(require_roles("admin")),
) -> dict[str, Any]:
    return _change_status(user_id, "suspend", admin, payload.reason)


@router.post("/users/{user_id}/reactivate")
def reactivate_user(
    user_id: int = Path(..., ge=1, le=MAX_BIGINT),
    payload: OptionalDecisionRequest | None = None,
    admin: UserResponse = Depends(require_roles("admin")),
) -> dict[str, Any]:
    return _change_status(user_id, "reactivate", admin, (payload.reason if payload else None) or None)


@router.post("/users/{user_id}/reopen")
def reopen_user(
    user_id: int = Path(..., ge=1, le=MAX_BIGINT),
    payload: OptionalDecisionRequest | None = None,
    admin: UserResponse = Depends(require_roles("admin")),
) -> dict[str, Any]:
    return _change_status(user_id, "reopen", admin, (payload.reason if payload else None) or None)


@router.get("/audit-logs")
def list_audit_logs(
    action: str | None = Query(None, max_length=60),
    actor_user_id: int | None = Query(None, ge=1, le=MAX_BIGINT),
    target_type: str | None = Query(None, max_length=40),
    target_id: int | None = Query(None, ge=1, le=MAX_BIGINT),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: UserResponse = Depends(require_roles("admin")),
) -> dict[str, Any]:
    query = text(
        """
        SELECT
            id, occurred_at, actor_user_id, actor_role, action,
            target_type, target_id, reason, details,
            COUNT(*) OVER() AS total
        FROM core.audit_log
        WHERE (CAST(:action AS text) IS NULL OR action = CAST(:action AS text))
          AND (CAST(:actor AS bigint) IS NULL OR actor_user_id = CAST(:actor AS bigint))
          AND (CAST(:target_type AS text) IS NULL OR target_type = CAST(:target_type AS text))
          AND (CAST(:target_id AS bigint) IS NULL OR target_id = CAST(:target_id AS bigint))
          AND (CAST(:date_from AS timestamptz) IS NULL OR occurred_at >= CAST(:date_from AS timestamptz))
          AND (CAST(:date_to AS timestamptz) IS NULL OR occurred_at <= CAST(:date_to AS timestamptz))
        ORDER BY occurred_at DESC, id DESC
        LIMIT :limit OFFSET :offset
        """
    )
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                query,
                {
                    "action": action,
                    "actor": actor_user_id,
                    "target_type": target_type,
                    "target_id": target_id,
                    "date_from": date_from,
                    "date_to": date_to,
                    "limit": limit,
                    "offset": offset,
                },
            ).mappings().all()
    except SQLAlchemyError:
        logger.exception("Audit log listing failed")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not load the audit log.")

    items = [
        {
            "id": row["id"],
            "occurredAt": _iso(row["occurred_at"]),
            "actorUserId": row["actor_user_id"],
            "actorRole": row["actor_role"],
            "action": row["action"],
            "targetType": row["target_type"],
            "targetId": row["target_id"],
            "reason": row["reason"],
            "details": row["details"],
        }
        for row in rows
    ]
    total = rows[0]["total"] if rows else 0
    return {"total": total, "limit": limit, "offset": offset, "items": items}