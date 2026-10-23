"""Earlier-visits + diagnosis check against the real DB. Run from backend/:  python -m pytest tests/test_history_flow.py -s -v"""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.auth.security import hash_password
from app.database import engine
from app.main import app

PW = "Test@12345"
ITEM = {"drugName": "Zz Brand", "genericName": "codeine", "dosage": "1 tablet", "frequency": "Twice daily", "durationDays": 5}


def _user(role: str, email: str, name: str) -> int:
    with engine.begin() as conn:
        return conn.execute(
            text("INSERT INTO core.user_account (role,email,full_name,password_hash,status,approved_at) "
                 "VALUES (:r,:e,:n,:p,'active',now()) RETURNING id"),
            {"r": role, "e": email, "n": name, "p": hash_password(PW)},
        ).scalar_one()


def _login(c: TestClient, email: str):
    assert c.post("/api/auth/login", json={"identifier": email, "password": PW}).status_code == 200


def _expect(resp, code, label):
    assert resp.status_code == code, f"{label}: expected {code}, got {resp.status_code} -> {resp.text}"
    print(f"PASS  {label}")
    return resp


@pytest.fixture(scope="module")
def d():
    tag = uuid.uuid4().hex[:8]
    out = {"tag": tag}
    for k in ("rec", "doca", "docb"):
        out[f"{k}_email"] = f"zz.{tag}.{k}@example.com"
        out[k] = _user("receptionist" if k == "rec" else "doctor", out[f"{k}_email"], f"Test {k}")
    with engine.begin() as conn:
        out["patient"] = conn.execute(
            text("INSERT INTO core.patient (full_name,dob,sex,phone,created_by) VALUES (:n,'1985-03-02','male','+91 90000 00000',:c) RETURNING patient_id"),
            {"n": f"Zz Hist Patient {tag}", "c": out["rec"]},
        ).scalar_one()
        out["v1"] = conn.execute(
            text("INSERT INTO core.visit (patient_id,doctor_id,created_by,reason) VALUES (:p,:d,:c,'Cough') RETURNING visit_id"),
            {"p": out["patient"], "d": out["doca"], "c": out["rec"]},
        ).scalar_one()
    yield out
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM core.prescription_item WHERE prescription_id IN (SELECT prescription_id FROM core.patient_prescription WHERE patient_id = :p)"), {"p": out["patient"]})
        conn.execute(text("DELETE FROM core.patient_prescription WHERE patient_id = :p"), {"p": out["patient"]})
        conn.execute(text("DELETE FROM core.visit WHERE created_by = :c"), {"c": out["rec"]})
        conn.execute(text("DELETE FROM core.patient WHERE created_by = :c"), {"c": out["rec"]})
        conn.execute(text("DELETE FROM core.user_account WHERE id = ANY(:i)"), {"i": [out["rec"], out["doca"], out["docb"]]})


def test_history_flow(d):
    a, b = TestClient(app), TestClient(app)
    _login(a, d["doca_email"]); _login(b, d["docb_email"])

    _expect(a.post(f"/api/doctor/visits/{d['v1']}/start"), 200, "start first visit")
    _expect(a.put(f"/api/doctor/visits/{d['v1']}/prescription", json={"items": [ITEM], "diagnosis": "Acute bronchitis", "notes": "Rest"}), 200, "save with diagnosis")
    rx = a.get(f"/api/doctor/visits/{d['v1']}/prescription").json()["prescription"]
    assert rx["diagnosis"] == "Acute bronchitis"
    print("PASS  diagnosis reads back")
    _expect(a.post(f"/api/doctor/visits/{d['v1']}/complete"), 200, "complete first visit")

    with engine.begin() as conn:
        v2 = conn.execute(
            text("INSERT INTO core.visit (patient_id,doctor_id,created_by) VALUES (:p,:d,:c) RETURNING visit_id"),
            {"p": d["patient"], "d": d["doca"], "c": d["rec"]},
        ).scalar_one()

    h = _expect(a.get(f"/api/doctor/visits/{v2}/history"), 200, "history of the second visit").json()["items"]
    assert [x["visitId"] for x in h] == [d["v1"]], "only the completed earlier visit is listed"
    assert h[0]["prescription"]["diagnosis"] == "Acute bronchitis" and len(h[0]["prescription"]["items"]) == 1
    print("PASS  history shows diagnosis and medicines")
    _expect(b.get(f"/api/doctor/visits/{v2}/history"), 404, "other doctor cannot read the history")