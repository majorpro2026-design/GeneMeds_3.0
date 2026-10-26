"""Tests for HCP registration approval and Gmail SMTP welcome email dispatching.

Ensures:
- Successful approval triggers exactly one welcome email.
- Recipient email and name are retrieved from the database.
- Rejected and unauthorized requests do not trigger emails.
- Repeated approvals return 409 and do not send duplicate emails.
- Database transaction errors prevent email scheduling.
- SMTP delivery failures do not roll back successful approvals.
"""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.auth.security import hash_password
from app.database import engine
from app.main import app
from app.services.email_service import EmailDeliveryError

PASSWORD = "Test@12345"


def _user_id(email: str) -> int:
    with engine.connect() as conn:
        return conn.execute(
            text("SELECT id FROM core.user_account WHERE lower(email) = :e"), {"e": email.lower()}
        ).scalar_one()


def _get_user_status(user_id: int) -> dict:
    with engine.connect() as conn:
        return conn.execute(
            text("SELECT status, approved_by, approved_at FROM core.user_account WHERE id = :id"),
            {"id": user_id},
        ).mappings().one()


def _create_admin(email: str, name: str) -> int:
    with engine.begin() as conn:
        return conn.execute(
            text(
                """
                INSERT INTO core.user_account (role, email, full_name, password_hash, status, approved_at)
                VALUES ('admin', :email, :name, :pw, 'active', now())
                RETURNING id
                """
            ),
            {"email": email, "name": name, "pw": hash_password(PASSWORD)},
        ).scalar_one()


def _login(client: TestClient, email: str, password: str = PASSWORD):
    return client.post("/api/auth/login", json={"identifier": email, "password": password})


@pytest.fixture(scope="module")
def email_test_env():
    tag = uuid.uuid4().hex[:8]
    data = {
        "tag": tag,
        "admin": f"zz.{tag}.admin@example.com",
        "doctor": f"zz.{tag}.doc@example.com",
        "receptionist": f"zz.{tag}.rec@example.com",
    }
    yield data
    emails = [v for k, v in data.items() if k != "tag"]
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE core.user_account SET approved_by = NULL WHERE lower(email) = ANY(:emails)"),
            {"emails": emails},
        )
        conn.execute(
            text("DELETE FROM core.user_account WHERE lower(email) = ANY(:emails)"),
            {"emails": emails},
        )


def test_approval_schedules_one_welcome_email(email_test_env):
    tag = email_test_env["tag"]
    admin_client = TestClient(app)
    anon_client = TestClient(app)

    _create_admin(email_test_env["admin"], "Approval Admin")
    assert _login(admin_client, email_test_env["admin"]).status_code == 200

    doctor_payload = {
        "fullName": "Dr. Sarah Welcomed",
        "email": email_test_env["doctor"],
        "phone": "+91 9999911111",
        "password": PASSWORD,
        "confirmPassword": PASSWORD,
        "registrationNumber": f"MED-{tag}",
        "degrees": "MBBS, MD",
        "hospitalName": "Apollo Clinic",
        "hospitalAddress": "742 Evergreen Terrace",
    }
    reg_resp = anon_client.post("/api/auth/register/doctor", json=doctor_payload)
    assert reg_resp.status_code == 201

    doc_id = _user_id(email_test_env["doctor"])

    with patch("app.auth.admin_router.send_welcome_email_task") as mock_email_task:
        resp = admin_client.post(f"/api/admin/users/{doc_id}/approve")
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"
        assert resp.json()["message"] == "Account approve successful."

        # Verify exactly one email task was scheduled
        mock_email_task.assert_called_once_with(
            email_test_env["doctor"],
            "Dr. Sarah Welcomed",
        )


def test_repeated_approval_does_not_duplicate_email(email_test_env):
    admin_client = TestClient(app)
    assert _login(admin_client, email_test_env["admin"]).status_code == 200

    doc_id = _user_id(email_test_env["doctor"])

    with patch("app.auth.admin_router.send_welcome_email_task") as mock_email_task:
        # Second approval request must return 409 Conflict
        resp = admin_client.post(f"/api/admin/users/{doc_id}/approve")
        assert resp.status_code == 409
        # No email task should be scheduled for repeated request
        mock_email_task.assert_not_called()


def test_rejected_request_does_not_send_email(email_test_env):
    tag = email_test_env["tag"]
    admin_client = TestClient(app)
    anon_client = TestClient(app)
    assert _login(admin_client, email_test_env["admin"]).status_code == 200

    rec_payload = {
        "fullName": "Receptionist Rita",
        "email": email_test_env["receptionist"],
        "phone": "+91 9888822222",
        "password": PASSWORD,
        "confirmPassword": PASSWORD,
        "degree": "B.Com",
        "hospitalName": "Apollo Clinic",
        "hospitalAddress": "742 Evergreen Terrace",
    }
    reg_resp = anon_client.post("/api/auth/register/receptionist", json=rec_payload)
    assert reg_resp.status_code == 201

    rec_id = _user_id(email_test_env["receptionist"])

    with patch("app.auth.admin_router.send_welcome_email_task") as mock_email_task:
        resp = admin_client.post(
            f"/api/admin/users/{rec_id}/reject",
            json={"reason": "Incomplete registration documentation provided"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "rejected"
        mock_email_task.assert_not_called()


def test_unauthorized_request_does_not_send_email(email_test_env):
    anon_client = TestClient(app)
    doc_id = _user_id(email_test_env["doctor"])

    with patch("app.auth.admin_router.send_welcome_email_task") as mock_email_task:
        resp = anon_client.post(f"/api/admin/users/{doc_id}/approve")
        assert resp.status_code == 401
        mock_email_task.assert_not_called()


def test_failed_db_transaction_does_not_schedule_email(email_test_env):
    admin_client = TestClient(app)
    assert _login(admin_client, email_test_env["admin"]).status_code == 200

    doc_id = _user_id(email_test_env["doctor"])

    with patch("app.auth.admin_router.send_welcome_email_task") as mock_email_task:
        with patch.object(engine, "begin", side_effect=OperationalError("Simulated DB connection failure", params={}, orig=Exception("DB error"))):
            resp = admin_client.post(f"/api/admin/users/{doc_id}/approve")
            assert resp.status_code == 500
            mock_email_task.assert_not_called()


def test_smtp_failure_does_not_rollback_approval():
    """If SMTP delivery fails in the background task, the user status must remain active."""
    tag = uuid.uuid4().hex[:8]
    test_admin_email = f"zz.{tag}.admin@example.com"
    test_doc_email = f"zz.{tag}.smtpdoc@example.com"

    admin_client = TestClient(app)
    anon_client = TestClient(app)

    _create_admin(test_admin_email, "SMTP Admin")
    assert _login(admin_client, test_admin_email).status_code == 200

    reg_resp = anon_client.post(
        "/api/auth/register/doctor",
        json={
            "fullName": "Dr. SMTP Failure Test",
            "email": test_doc_email,
            "phone": "+91 9777733333",
            "password": PASSWORD,
            "confirmPassword": PASSWORD,
            "registrationNumber": f"SMTP-{tag}",
            "degrees": "MBBS",
            "hospitalName": "General Hospital",
            "hospitalAddress": "404 Error Way",
        },
    )
    assert reg_resp.status_code == 201
    doc_id = _user_id(test_doc_email)

    try:
        # Simulate real SMTP failure when background task executes
        with patch(
            "app.services.email_service.send_welcome_email",
            side_effect=EmailDeliveryError("Connection refused by SMTP server"),
        ):
            resp = admin_client.post(f"/api/admin/users/{doc_id}/approve")
            assert resp.status_code == 200
            assert resp.json()["status"] == "active"

        # Check DB directly to ensure approval was preserved and NOT rolled back
        user_info = _get_user_status(doc_id)
        assert user_info["status"] == "active"
        assert user_info["approved_by"] is not None
        assert user_info["approved_at"] is not None
    finally:
        with engine.begin() as conn:
            conn.execute(
                text("UPDATE core.user_account SET approved_by = NULL WHERE lower(email) IN (:a, :b)"),
                {"a": test_admin_email, "b": test_doc_email},
            )
            conn.execute(
                text("DELETE FROM core.user_account WHERE lower(email) IN (:a, :b)"),
                {"a": test_admin_email, "b": test_doc_email},
            )
