"""Reception API check against the real DB. Run from backend/:  python -m pytest tests/test_reception_flow.py -s -v"""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.auth.security import hash_password
from app.database import engine
from app.main import app

PW = "Test@12345"


def _user(role: str, email: str, name: str) -> int:
    with engine.begin() as conn:
        return conn.execute(
            text("INSERT INTO core.user_account (role,email,full_name,password_hash,status,approved_at) "
                 "VALUES (:r,:e,:n,:p,'active',now()) RETURNING id"),
            {"r": role, "e": email, "n": name, "p": hash_password(PW)},
        ).scalar_one()


def _login(client: TestClient, email: str):
    r = client.post("/api/auth/login", json={"identifier": email, "password": PW})
    assert r.status_code == 200, r.text


def _expect(resp, code, label):
    assert resp.status_code == code, f"{label}: expected {code}, got {resp.status_code} -> {resp.text}"
    print(f"PASS  {label}")
    return resp


@pytest.fixture(scope="module")
def ids():
    tag = uuid.uuid4().hex[:8]
    d = {"tag": tag, "rec_email": f"zz.{tag}.rec@example.com", "doc_email": f"zz.{tag}.doc@example.com"}
    d["rec_id"] = _user("receptionist", d["rec_email"], "Test Receptionist")
    d["doc_id"] = _user("doctor", d["doc_email"], "Test Doctor")
    yield d
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM core.visit WHERE created_by = :r"), {"r": d["rec_id"]})
        conn.execute(text("DELETE FROM core.patient WHERE created_by = :r"), {"r": d["rec_id"]})
        conn.execute(text("DELETE FROM core.user_account WHERE id = ANY(:ids)"), {"ids": [d["rec_id"], d["doc_id"]]})


def test_reception_flow(ids):
    anon, rec, doc = TestClient(app), TestClient(app), TestClient(app)
    _login(rec, ids["rec_email"])
    _login(doc, ids["doc_email"])
    name = f"Zz Patient {ids['tag']}"
    body = {"fullName": name, "dob": "1990-05-17", "sex": "female", "phone": "+91 98765 43210", "email": ""}

    _expect(anon.get("/api/reception/patients"), 401, "anonymous is blocked")
    _expect(doc.get("/api/reception/patients"), 403, "doctor is blocked")

    p = _expect(rec.post("/api/reception/patients", json=body), 201, "register patient").json()
    assert p["patientCode"].startswith("GM-"), p
    _expect(rec.post("/api/reception/patients", json=body), 409, "duplicate patient rejected")
    _expect(rec.post("/api/reception/patients", json={**body, "dob": "2999-01-01"}), 422, "future date of birth rejected")
    _expect(rec.post("/api/reception/patients", json={**body, "phone": "abc"}), 422, "bad phone rejected")

    found = _expect(rec.get(f"/api/reception/patients?q={ids['tag']}"), 200, "search by name").json()
    assert found["total"] == 1 and found["items"][0]["patientCode"] == p["patientCode"]
    assert rec.get(f"/api/reception/patients?q={p['patientCode']}").json()["total"] == 1
    print("PASS  search by patient code")

    docs = _expect(rec.get("/api/reception/doctors"), 200, "list doctors").json()["items"]
    assert ids["doc_id"] in [d["id"] for d in docs]

    v = _expect(rec.post("/api/reception/visits", json={"patientId": p["patientId"], "doctorId": ids["doc_id"], "reason": "Fever"}),
                201, "create visit").json()
    _expect(rec.post("/api/reception/visits", json={"patientId": p["patientId"], "doctorId": ids["doc_id"]}), 409, "second open visit rejected")
    _expect(rec.post("/api/reception/visits", json={"patientId": p["patientId"], "doctorId": ids["rec_id"]}), 400, "non-doctor rejected")
    _expect(rec.post("/api/reception/visits", json={"patientId": 999999999, "doctorId": ids["doc_id"]}), 404, "unknown patient rejected")

    today = rec.get("/api/reception/visits").json()["items"]
    assert v["visitId"] in [x["visitId"] for x in today]
    print("PASS  visit appears in today's list")

    _expect(rec.post(f"/api/reception/visits/{v['visitId']}/cancel"), 200, "cancel waiting visit")
    _expect(rec.post(f"/api/reception/visits/{v['visitId']}/cancel"), 409, "cancel twice rejected")
    _expect(rec.post("/api/reception/visits", json={"patientId": p["patientId"], "doctorId": ids["doc_id"]}), 201, "new visit allowed after cancel")