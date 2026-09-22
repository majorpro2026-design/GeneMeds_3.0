from __future__ import annotations

from typing import Any

import jwt
from fastapi import HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import engine
from app.auth.schemas import HCPResponse
from app.auth.security import decode_access_token

SESSION_COOKIE_NAME = "genemeds_session"


def get_current_hcp(request: Request) -> HCPResponse:
    """
    FastAPI dependency to extract and validate the authenticated HCP from the session cookie.
    Flow: cookie -> decode JWT -> HCP ID -> DB lookup -> return HCP
    """
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    try:
        payload = decode_access_token(token)
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session.",
        )

    if payload.get("type") != "hcp" or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims.",
        )

    try:
        hcp_id = int(payload["sub"])
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject.",
        )

    query = text(
        """
        SELECT
            id,
            full_name,
            registration_number,
            email,
            is_active,
            last_login_at
        FROM core.hcp_account
        WHERE id = :hcp_id
        LIMIT 1
        """
    )

    try:
        with engine.connect() as conn:
            row = conn.execute(query, {"hcp_id": hcp_id}).mappings().first()
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database query error: {exc}",
        )

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="HCP account not found.",
        )

    if not row["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="HCP account is inactive.",
        )

    return HCPResponse(
        id=row["id"],
        fullName=row["full_name"],
        registrationNumber=row["registration_number"],
        email=row["email"],
        isActive=row["is_active"],
        lastLoginAt=row["last_login_at"],
    )
