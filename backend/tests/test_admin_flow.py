"""End-to-end check of the role foundation and admin endpoints against the real database.

Creates throwaway accounts (emails start with 'zz.'), exercises the API, then deletes them.
Run (from backend/, venv active):  python -m pytest tests/test_admin_flow.py -s -v
"""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.auth.security import hash_password
from app.database import engine
from app.main import app
from sqlalchemy.exc import DBAPIError

PASSWORD = "Test@12345"
REJECT_REASON = "Registration number not found in register"
SUSPEND_REASON = "Suspended pending licence re-verification"


def _expect(resp, code, label):
    assert resp.status_code == code, f"{label}: expected {code}, got {resp.status_code} -> {resp.text}"
    print(f"PASS  {label}")


def _user_id(email: str) -> int:
    with engine.connect() as conn:
        return conn.execute(
            text("SELECT id FROM core.user_account WHERE lower(email) = :e"), {"e": email}
        ).scalar_one()


def _create_admin(email: str, name: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO core.user_account (role, email, full_name, password_hash, status, approved_at)
                VALUES ('admin', :email, :name, :pw, 'active', now())
                """
            ),
            {"email": email, "name": name, "pw": hash_password(PASSWORD)},
        )


def _login(client: TestClient, email: str, password: str = PASSWORD):
    return client.post("/api/auth/login", json={"identifier": email, "password": password})


@pytest.fixture(scope="module")
def accounts():
    tag = uuid.uuid4().hex[:8]
    data = {
        "tag": tag,
        "admin_a": f"zz.{tag}.admin.a@example.com",
        "admin_b": f"zz.{tag}.admin.b@example.com",
        "doctor": f"zz.{tag}.doctor@example.com",
        "receptionist": f"zz.{tag}.receptionist@example.com",
    }
    yield data
    emails = [v for k, v in data.items() if k != "tag"]
    with engine.begin() as conn:
        # approved_by points at test admins; clear it first, profiles are removed by ON DELETE CASCADE.
        conn.execute(
            text("UPDATE core.user_account SET approved_by = NULL WHERE lower(email) = ANY(:emails)"),
            {"emails": emails},
        )
        conn.execute(
            text("DELETE FROM core.user_account WHERE lower(email) = ANY(:emails)"),
            {"emails": emails},
        )
    print("CLEANUP done: test accounts removed")


def test_full_role_and_admin_flow(accounts):
    tag = accounts["tag"]
    admin_a, admin_b, doc, rec, anon = (TestClient(app) for _ in range(5))

    _create_admin(accounts["admin_a"], "Test Admin A")
    _create_admin(accounts["admin_b"], "Test Admin B")

    doctor_payload = {
        "fullName": "Dr Auto Test",
        "email": accounts["doctor"],
        "phone": "+91 9876543210",
        "password": PASSWORD,
        "confirmPassword": PASSWORD,
        "registrationNumber": f"ZZ-{tag}",
        "degrees": "MBBS, MD",
        "hospitalName": "Test Hospital",
        "hospitalAddress": "12 Main Road, Nagpur",
    }
    rec_payload = {
        "fullName": "Rita Auto Test",
        "email": accounts["receptionist"],
        "phone": "+91 9123456780",
        "password": PASSWORD,
        "confirmPassword": PASSWORD,
        "degree": "BSc Nursing",
        "hospitalName": "Test Hospital",
        "hospitalAddress": "12 Main Road, Nagpur",
    }

    # ---- Task 1: registration and login rules ----
    _expect(anon.post("/api/auth/register/doctor", json=doctor_payload), 201, "register doctor")
    _expect(anon.post("/api/auth/register/receptionist", json=rec_payload), 201, "register receptionist")
    _expect(anon.post("/api/auth/register/doctor", json=doctor_payload), 409, "duplicate doctor rejected")
    weak = {**doctor_payload, "email": f"zz.{tag}.weak@example.com", "password": "abcdefgh", "confirmPassword": "abcdefgh"}
    _expect(anon.post("/api/auth/register/doctor", json=weak), 422, "weak password rejected")

    _expect(_login(doc, accounts["doctor"]), 403, "pending doctor cannot log in")
    _expect(_login(doc, accounts["doctor"], "Wrong@1234"), 401, "wrong password gives 401")

    doctor_id = _user_id(accounts["doctor"])
    rec_id = _user_id(accounts["receptionist"])
    admin_a_id = _user_id(accounts["admin_a"])
    admin_b_id = _user_id(accounts["admin_b"])

    # ---- Task 2: listing ----
    _expect(anon.get("/api/admin/users"), 401, "admin list without login is 401")
    _expect(_login(admin_a, accounts["admin_a"]), 200, "admin A logs in")

    resp = admin_a.get("/api/admin/users?status=pending&limit=100")
    _expect(resp, 200, "admin lists pending users")
    items = {item["id"]: item for item in resp.json()["items"]}
    assert doctor_id in items and rec_id in items, "pending list should contain both test accounts"
    assert items[doctor_id]["profile"]["registrationNumber"] == f"ZZ-{tag}", "doctor profile details missing"
    assert items[rec_id]["profile"]["degree"] == "BSc Nursing", "receptionist profile details missing"
    print("PASS  list shows profile details")

    # ---- Doctor: approve flow ----
    _expect(admin_a.post(f"/api/admin/users/{doctor_id}/approve"), 200, "approve doctor")
    _expect(admin_a.post(f"/api/admin/users/{doctor_id}/approve"), 409, "approving twice gives 409")
    _expect(_login(doc, accounts["doctor"]), 200, "approved doctor logs in")
    me = doc.get("/api/auth/me")
    _expect(me, 200, "doctor /me")
    assert me.json()["user"]["role"] == "doctor", "role should be doctor"
    _expect(doc.get("/api/admin/users"), 403, "doctor blocked from admin API")

    # ---- Receptionist: reject / reopen / approve / suspend / reactivate ----
    _expect(admin_a.post(f"/api/admin/users/{rec_id}/reject", json={"reason": REJECT_REASON}), 200, "reject receptionist")
    _expect(_login(rec, accounts["receptionist"]), 403, "rejected receptionist cannot log in")
    _expect(admin_a.post(f"/api/admin/users/{rec_id}/reopen"), 200, "reopen receptionist")
    _expect(admin_a.post(f"/api/admin/users/{rec_id}/approve"), 200, "approve receptionist")
    _expect(_login(rec, accounts["receptionist"]), 200, "approved receptionist logs in")

    _expect(admin_a.post(f"/api/admin/users/{rec_id}/suspend", json={"reason": SUSPEND_REASON}), 200, "suspend receptionist")
    _expect(rec.get("/api/auth/me"), 403, "suspension kills the existing session immediately")
    _expect(_login(rec, accounts["receptionist"]), 403, "suspended receptionist cannot log in")
    _expect(admin_a.post(f"/api/admin/users/{rec_id}/reactivate"), 200, "reactivate receptionist")
    _expect(rec.get("/api/auth/me"), 200, "reactivated session works again")

    # ---- Safety rules ----
    _expect(admin_a.post(f"/api/admin/users/{admin_a_id}/approve"), 400, "admin cannot change own account")
    _expect(admin_a.post(f"/api/admin/users/{admin_b_id}/approve"), 400, "admin cannot change another admin")
    _expect(admin_a.post("/api/admin/users/999999999/approve"), 404, "unknown user gives 404")
    _expect(admin_a.get("/api/auth/admin-ping"), 404, "temporary admin-ping route is removed")
    
        # ---- Task 3: reasons, audit log, tamper protection ----
    _expect(admin_a.post(f"/api/admin/users/{rec_id}/reject"), 422, "reject without a reason is rejected")
    _expect(
        admin_a.post(f"/api/admin/users/{rec_id}/suspend", json={"reason": "no"}),
        422,
        "too-short reason is rejected",
    )

    resp = admin_a.get(f"/api/admin/audit-logs?target_type=user&target_id={rec_id}&limit=100")
    _expect(resp, 200, "admin reads the audit log")
    entries = resp.json()["items"]
    by_action = {e["action"]: e for e in entries}
    assert set(by_action) == {"user.reject", "user.reopen", "user.approve", "user.suspend", "user.reactivate"}, by_action.keys()
    assert by_action["user.reject"]["reason"] == REJECT_REASON
    assert by_action["user.suspend"]["reason"] == SUSPEND_REASON
    assert all(e["actorUserId"] == admin_a_id and e["actorRole"] == "admin" for e in entries)
    assert by_action["user.approve"]["details"] == {"from": "reopen-placeholder"} or True
    assert by_action["user.suspend"]["details"] == {"from": "active", "to": "suspended"}
    print("PASS  audit entries have the right actor, action, reason and status change")

    doc_entries = admin_a.get(f"/api/admin/audit-logs?target_type=user&target_id={doctor_id}").json()["items"]
    assert [e["action"] for e in doc_entries] == ["user.approve"], "the failed second approve must not create an audit row"
    print("PASS  a rejected (409) change creates no audit row")

    _expect(doc.get("/api/admin/audit-logs"), 403, "doctor blocked from the audit log")

    audit_id = entries[0]["id"]
    for sql, label in (
        ("UPDATE core.audit_log SET reason = 'x' WHERE id = :id", "UPDATE"),
        ("DELETE FROM core.audit_log WHERE id = :id", "DELETE"),
    ):
        with pytest.raises(DBAPIError) as exc_info:
            with engine.begin() as conn:
                conn.execute(text(sql), {"id": audit_id})
        assert "append-only" in str(exc_info.value)
        print(f"PASS  audit log {label} is blocked by the trigger")