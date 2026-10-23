"""Doctor API check against the real DB. Run from backend/:  python -m pytest tests/test_doctor_flow.py -s -v"""
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
            {"n": f"Zz Doc Patient {tag}", "c": out["rec"]},
        ).scalar_one()
        out["patient2"] = conn.execute(
            text("INSERT INTO core.patient (full_name,dob,sex,phone,created_by) VALUES (:n,'1990-01-01','female','+91 90000 00001',:c) RETURNING patient_id"),
            {"n": f"Zz Other Patient {tag}", "c": out["rec"]},
        ).scalar_one()
        for key, pid, doc in (("va", "patient", "doca"), ("vb", "patient2", "docb")):
            out[key] = conn.execute(
                text("INSERT INTO core.visit (patient_id,doctor_id,created_by) VALUES (:p,:d,:c) RETURNING visit_id"),
                {"p": out[pid], "d": out[doc], "c": out["rec"]},
            ).scalar_one()
    yield out
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM core.visit WHERE created_by = :c"), {"c": out["rec"]})
        conn.execute(text("DELETE FROM core.patient WHERE created_by = :c"), {"c": out["rec"]})
        conn.execute(text("DELETE FROM core.user_account WHERE id = ANY(:i)"), {"i": [out["rec"], out["doca"], out["docb"]]})


def test_doctor_flow(d):
    anon, a, b, rec = (TestClient(app) for _ in range(4))
    _login(a, d["doca_email"]); _login(b, d["docb_email"]); _login(rec, d["rec_email"])

    _expect(anon.get("/api/doctor/queue"), 401, "anonymous blocked")
    _expect(rec.get("/api/doctor/queue"), 403, "receptionist blocked")

    q = _expect(a.get("/api/doctor/queue"), 200, "doctor A queue").json()["items"]
    assert [x["visitId"] for x in q] == [d["va"]], "doctor A must see only their own visit"
    print("PASS  queue shows only own visits")

    _expect(b.post(f"/api/doctor/visits/{d['va']}/start"), 404, "doctor B cannot start A's visit")
    _expect(b.get(f"/api/doctor/visits/{d['va']}"), 404, "doctor B cannot read A's visit")
    _expect(a.post(f"/api/doctor/visits/{d['va']}/complete"), 409, "cannot complete a waiting visit")
    _expect(a.post(f"/api/doctor/visits/{d['va']}/start"), 200, "start consultation")
    _expect(a.post(f"/api/doctor/visits/{d['va']}/start"), 409, "start twice rejected")

    det = _expect(a.get(f"/api/doctor/visits/{d['va']}"), 200, "visit detail").json()
    assert det["visit"]["status"] == "in_consultation" and det["patient"]["patientId"] == d["patient"]

    _expect(a.post(f"/api/doctor/visits/{d['va']}/complete"), 200, "complete visit")
    done = a.get("/api/doctor/queue?scope=done").json()["items"]
    assert [x["visitId"] for x in done] == [d["va"]]
    print("PASS  completed visit appears under 'done'")

    mine = _expect(a.get(f"/api/doctor/patients?q={d['tag']}"), 200, "doctor A patients").json()
    assert [p["patientId"] for p in mine["items"]] == [d["patient"]], "A must not see B's patient"
    assert mine["items"][0]["visits"] == 1
    print("PASS  patient list limited to own patients")

    with engine.connect() as conn:
        n = conn.execute(text("SELECT count(*) FROM core.audit_log WHERE actor_user_id=:a AND action IN ('visit.start','visit.complete')"),
                         {"a": d["doca"]}).scalar_one()
    assert n == 2, n
    print("PASS  start and complete are audit-logged")