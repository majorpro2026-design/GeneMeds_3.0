"""One-time admin creation. Usage (from backend/ with venv active):

    $env:ADMIN_EMAIL="admin@example.com"; $env:ADMIN_PASSWORD="Admin@12345"
    python -m app.scripts.create_admin
"""
from __future__ import annotations

import os
import sys

from sqlalchemy import text

from app.auth.security import hash_password
from app.auth.user_schemas import validate_password_strength
from app.database import engine


def main() -> int:
    email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    password = os.getenv("ADMIN_PASSWORD", "")
    full_name = os.getenv("ADMIN_FULL_NAME", "System Administrator").strip()

    if not email or not password:
        print("Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables first.")
        return 1
    try:
        validate_password_strength(password)
    except ValueError as exc:
        print(f"Weak password: {exc}")
        return 1

    with engine.begin() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM core.user_account WHERE lower(email) = :email"), {"email": email}
        ).first()
        if exists:
            print("An account with this email already exists. Nothing changed.")
            return 0
        conn.execute(
            text(
                """
                INSERT INTO core.user_account
                    (role, email, full_name, password_hash, status, approved_at)
                VALUES ('admin', :email, :full_name, :password_hash, 'active', now())
                """
            ),
            {"email": email, "full_name": full_name, "password_hash": hash_password(password)},
        )
    print(f"Admin created: {email}")
    return 0


if __name__ == "__main__":
    sys.exit(main())