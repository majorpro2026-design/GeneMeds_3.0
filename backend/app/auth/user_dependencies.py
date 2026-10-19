from __future__ import annotations

import logging

import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.auth.security import decode_access_token
from app.auth.user_schemas import UserResponse
from app.database import engine

logger = logging.getLogger(__name__)

USER_COOKIE_NAME = "genemeds_user_session"


def get_current_user(request: Request) -> UserResponse:
    """Cookie -> JWT -> user id -> fresh DB lookup (role and status are never trusted from the token)."""
    token = request.cookies.get(USER_COOKIE_NAME)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required.")

    try:
        payload = decode_access_token(token)
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session.")

    if payload.get("type") != "user":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token claims.")

    try:
        user_id = int(payload.get("sub", ""))
    except (TypeError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token subject.")

    query = text(
        """
        SELECT id, full_name, email, phone, role, status
        FROM core.user_account
        WHERE id = :user_id
        LIMIT 1
        """
    )
    try:
        with engine.connect() as conn:
            row = conn.execute(query, {"user_id": user_id}).mappings().first()
    except SQLAlchemyError:
        logger.exception("Session lookup failed")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not verify session.")

    if row is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account not found.")
    if row["status"] != "active":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is not active.")

    return UserResponse(
        id=row["id"],
        fullName=row["full_name"],
        email=row["email"],
        phone=row["phone"],
        role=row["role"],
        status=row["status"],
    )


def require_roles(*allowed_roles: str):
    """Dependency factory: require_roles('doctor') or require_roles('doctor', 'admin')."""

    def checker(user: UserResponse = Depends(get_current_user)) -> UserResponse:
        if user.role not in allowed_roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to perform this action.")
        return user

    return checker