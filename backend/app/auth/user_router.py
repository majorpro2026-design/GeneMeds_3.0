from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.auth.security import create_user_token, hash_password, verify_password
from app.auth.user_dependencies import USER_COOKIE_NAME, get_current_user, require_roles
from app.auth.user_schemas import (
    DoctorRegisterRequest,
    LoginRequest,
    ReceptionistRegisterRequest,
    UserResponse,
)
from app.auth.user_dependencies import USER_COOKIE_NAME, get_current_user
from app.database import engine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Used so a wrong email takes about as long as a wrong password (reduces user enumeration by timing).
_DUMMY_HASH = hash_password("not-a-real-password-1!")

_PENDING_MESSAGE = "Registration received. Your account is awaiting admin approval."
_LOGIN_BLOCKED = {
    "pending": "Your account is awaiting admin approval.",
    "rejected": "Your registration was not approved. Please contact the administrator.",
    "suspended": "Your account has been suspended. Please contact the administrator.",
}


def _set_session_cookie(response: Response, token: str) -> None:
    max_age = int(os.getenv("JWT_EXPIRE_MINUTES", "30")) * 60
    is_production = os.getenv("ENVIRONMENT", "development").lower() == "production"
    response.set_cookie(
        key=USER_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=is_production,
        path="/",
        max_age=max_age,
    )


def _exists(sql: str, params: dict[str, Any]) -> bool:
    try:
        with engine.connect() as conn:
            return conn.execute(text(sql), params).first() is not None
    except SQLAlchemyError:
        logger.exception("Existence check failed")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not process the request.")


def _insert_pending_user(conn, role: str, full_name: str, email: str, phone: str, password: str) -> int:
    return conn.execute(
        text(
            """
            INSERT INTO core.user_account (role, email, full_name, phone, password_hash, status)
            VALUES (:role, :email, :full_name, :phone, :password_hash, 'pending')
            RETURNING id
            """
        ),
        {
            "role": role,
            "email": email,
            "full_name": full_name,
            "phone": phone,
            "password_hash": hash_password(password),
        },
    ).scalar_one()


@router.post("/register/doctor", status_code=status.HTTP_201_CREATED)
def register_doctor(payload: DoctorRegisterRequest) -> dict[str, str]:
    if _exists("SELECT 1 FROM core.user_account WHERE lower(email) = :email", {"email": payload.email}):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    if _exists(
        "SELECT 1 FROM core.doctor_profile WHERE lower(btrim(registration_number)) = lower(btrim(:reg))",
        {"reg": payload.registration_number},
    ):
        raise HTTPException(status.HTTP_409_CONFLICT, "This registration number is already registered.")

    try:
        with engine.begin() as conn:
            user_id = _insert_pending_user(
                conn, "doctor", payload.full_name, payload.email, payload.phone, payload.password
            )
            conn.execute(
                text(
                    """
                    INSERT INTO core.doctor_profile
                        (user_id, registration_number, degrees, hospital_name, hospital_address)
                    VALUES (:user_id, :reg, :degrees, :hospital_name, :hospital_address)
                    """
                ),
                {
                    "user_id": user_id,
                    "reg": payload.registration_number,
                    "degrees": payload.degrees,
                    "hospital_name": payload.hospital_name,
                    "hospital_address": payload.hospital_address,
                },
            )
    except IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with these details already exists.")
    except SQLAlchemyError:
        logger.exception("Doctor registration failed")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not create the account.")

    return {"message": _PENDING_MESSAGE}


@router.post("/register/receptionist", status_code=status.HTTP_201_CREATED)
def register_receptionist(payload: ReceptionistRegisterRequest) -> dict[str, str]:
    if _exists("SELECT 1 FROM core.user_account WHERE lower(email) = :email", {"email": payload.email}):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")

    try:
        with engine.begin() as conn:
            user_id = _insert_pending_user(
                conn, "receptionist", payload.full_name, payload.email, payload.phone, payload.password
            )
            conn.execute(
                text(
                    """
                    INSERT INTO core.receptionist_profile (user_id, degree, hospital_name, hospital_address)
                    VALUES (:user_id, :degree, :hospital_name, :hospital_address)
                    """
                ),
                {
                    "user_id": user_id,
                    "degree": payload.degree,
                    "hospital_name": payload.hospital_name,
                    "hospital_address": payload.hospital_address,
                },
            )
    except IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with these details already exists.")
    except SQLAlchemyError:
        logger.exception("Receptionist registration failed")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not create the account.")

    return {"message": _PENDING_MESSAGE}


@router.post("/login")
def login(payload: LoginRequest, response: Response) -> dict[str, Any]:
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT id, full_name, email, phone, role, status, password_hash
                    FROM core.user_account
                    WHERE lower(email) = :identifier
                    LIMIT 1
                    """
                ),
                {"identifier": payload.identifier},
            ).mappings().first()
    except SQLAlchemyError:
        logger.exception("Login lookup failed")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not process the request.")

    password_ok = verify_password(payload.password, row["password_hash"] if row else _DUMMY_HASH)
    if row is None or not password_ok:
                raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password.")

    # Status is only revealed after the password is proven correct.
    if row["status"] != "active":
        raise HTTPException(status.HTTP_403_FORBIDDEN, _LOGIN_BLOCKED.get(row["status"], "Account is not active."))

    try:
        with engine.begin() as conn:
            conn.execute(
                text("UPDATE core.user_account SET last_login_at = now(), updated_at = now() WHERE id = :id"),
                {"id": row["id"]},
            )
    except SQLAlchemyError:
        logger.exception("Could not update last_login_at")  # non-fatal

    _set_session_cookie(response, create_user_token(row["id"]))
    user = UserResponse(
        id=row["id"],
        fullName=row["full_name"],
        email=row["email"],
        phone=row["phone"],
        role=row["role"],
        status=row["status"],
    )
    return {"message": "Login successful", "user": user}


@router.get("/me")
def me(user: UserResponse = Depends(get_current_user)) -> dict[str, Any]:
    return {"user": user}


@router.post("/logout")
def logout(response: Response) -> dict[str, str]:
    response.delete_cookie(key=USER_COOKIE_NAME, path="/")
    return {"message": "Logged out successfully"}
