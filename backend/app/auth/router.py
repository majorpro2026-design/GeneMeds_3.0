from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import engine
from app.auth.dependencies import SESSION_COOKIE_NAME, get_current_hcp
from app.auth.models import Base
from app.auth.schemas import HCPLoginRequest, HCPRegisterRequest, HCPResponse
from app.auth.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth/hcp", tags=["HCP Authentication"])


def ensure_hcp_account_table_exists() -> None:
    """Ensure that the core schema and core.hcp_account table exist in PostgreSQL."""
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS core;"))
            Base.metadata.create_all(bind=conn)
    except Exception as exc:
        print(f"[Auth Init] Note: Could not auto-create core.hcp_account table: {exc}", flush=True)


# Run table check on module import
ensure_hcp_account_table_exists()


def _set_session_cookie(response: Response, token: str) -> None:
    expire_minutes = int(os.getenv("JWT_EXPIRE_MINUTES", "30"))
    max_age = expire_minutes * 60
    is_production = os.getenv("ENVIRONMENT", "development").lower() == "production"

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=is_production,
        path="/",
        max_age=max_age,
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: HCPRegisterRequest, response: Response) -> dict[str, Any]:
    email_clean = payload.email.strip().lower()
    reg_clean = payload.registration_number.strip()
    full_name_clean = payload.full_name.strip()

    check_query = text(
        """
        SELECT
            (LOWER(TRIM(email)) = :email) AS email_exists,
            (LOWER(TRIM(registration_number)) = LOWER(TRIM(:reg_num))) AS reg_exists
        FROM core.hcp_account
        WHERE LOWER(TRIM(email)) = :email
           OR LOWER(TRIM(registration_number)) = LOWER(TRIM(:reg_num))
        """
    )

    try:
        with engine.connect() as conn:
            existing_rows = conn.execute(
                check_query, {"email": email_clean, "reg_num": reg_clean}
            ).mappings().all()
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during registration check: {exc}",
        )

    for row in existing_rows:
        if row["email_exists"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )
        if row["reg_exists"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This registration number is already registered.",
            )

    hashed_pw = hash_password(payload.password)

    insert_query = text(
        """
        INSERT INTO core.hcp_account
            (full_name, registration_number, email, password_hash, is_active, created_at, updated_at, last_login_at)
        VALUES
            (:full_name, :registration_number, :email, :password_hash, true, NOW(), NOW(), NOW())
        RETURNING id, full_name, registration_number, email, is_active, last_login_at
        """
    )

    try:
        with engine.begin() as conn:
            row = conn.execute(
                insert_query,
                {
                    "full_name": full_name_clean,
                    "registration_number": reg_clean,
                    "email": email_clean,
                    "password_hash": hashed_pw,
                },
            ).mappings().first()
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create HCP account: {exc}",
        )

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve created HCP account record.",
        )

    hcp_data = HCPResponse(
        id=row["id"],
        fullName=row["full_name"],
        registrationNumber=row["registration_number"],
        email=row["email"],
        isActive=row["is_active"],
        lastLoginAt=row["last_login_at"],
    )

    token = create_access_token(row["id"])
    _set_session_cookie(response, token)

    return {
        "message": "HCP account created successfully",
        "hcp": hcp_data,
    }


@router.post("/login")
def login(payload: HCPLoginRequest, response: Response) -> dict[str, Any]:
    email_clean = payload.email.strip().lower()

    select_query = text(
        """
        SELECT id, full_name, registration_number, email, password_hash, is_active, last_login_at
        FROM core.hcp_account
        WHERE LOWER(TRIM(email)) = :email
        LIMIT 1
        """
    )

    try:
        with engine.connect() as conn:
            row = conn.execute(select_query, {"email": email_clean}).mappings().first()
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during login: {exc}",
        )

    if row is None or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not row["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive. Please contact support.",
        )

    update_query = text(
        """
        UPDATE core.hcp_account
        SET last_login_at = NOW(), updated_at = NOW()
        WHERE id = :id
        RETURNING last_login_at
        """
    )
    try:
        with engine.begin() as conn:
            updated_row = conn.execute(update_query, {"id": row["id"]}).mappings().first()
            last_login = updated_row["last_login_at"] if updated_row else row["last_login_at"]
    except SQLAlchemyError:
        last_login = row["last_login_at"]

    hcp_data = HCPResponse(
        id=row["id"],
        fullName=row["full_name"],
        registrationNumber=row["registration_number"],
        email=row["email"],
        isActive=row["is_active"],
        lastLoginAt=last_login,
    )

    token = create_access_token(row["id"])
    _set_session_cookie(response, token)

    return {
        "message": "Login successful",
        "hcp": hcp_data,
    }


@router.get("/me")
def get_me(current_hcp: HCPResponse = Depends(get_current_hcp)) -> dict[str, Any]:
    return {"hcp": current_hcp}


@router.post("/logout")
def logout(response: Response) -> dict[str, str]:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
    )
    return {"message": "Logged out successfully"}
