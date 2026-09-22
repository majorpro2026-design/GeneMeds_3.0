from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

_pwd_context = PasswordHash((Argon2Hasher(),))


def hash_password(password: str) -> str:
    """Hash a plain text password using Argon2."""
    return _pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain text password against a stored Argon2 hash."""
    return _pwd_context.verify(plain_password, hashed_password)


def _get_secret_key() -> str:
    secret = os.getenv("AUTH_SECRET_KEY")
    if not secret:
        raise ValueError("AUTH_SECRET_KEY environment variable is not configured.")
    return secret


def _get_algorithm() -> str:
    return os.getenv("JWT_ALGORITHM", "HS256")


def _get_expire_minutes() -> int:
    return int(os.getenv("JWT_EXPIRE_MINUTES", "30"))


def create_access_token(hcp_id: int) -> str:
    """Create a signed JWT access token containing HCP ID."""
    secret = _get_secret_key()
    algo = _get_algorithm()
    expire_delta = timedelta(minutes=_get_expire_minutes())
    expire = datetime.now(timezone.utc) + expire_delta

    payload: dict[str, Any] = {
        "sub": str(hcp_id),
        "type": "hcp",
        "exp": expire,
    }
    return jwt.encode(payload, secret, algorithm=algo)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a signed JWT access token."""
    secret = _get_secret_key()
    algo = _get_algorithm()
    return jwt.decode(token, secret, algorithms=[algo])
