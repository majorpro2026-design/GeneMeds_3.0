"""Prescription + guard checks against the real DB. Run from backend/:  python -m pytest tests/test_prescription_flow.py -s -v"""
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
            {"n": f"Zz Rx Patient {tag}", "c": out["rec"]},
        ).scalar_one()
        out["visit"] = conn.execute(
            text("INSERT INTO core.visit (patient_id,doctor_id,created_by) VALUES (:p,:d,:c) RETURNING visit_id"),
            {"p": out["patient"], "d": out["doca"], "c": out["rec"]},
        ).scalar_one()
    yield out
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM core.prescription_item WHERE prescription_id IN (SELECT prescription_id FROM core.patient_prescription WHERE patient_id = :p)"), {"p": out["patient"]})
        conn.execute(text("DELETE FROM core.patient_prescription WHERE patient_id = :p"), {"p": out["patient"]})
        conn.execute(text("DELETE FROM core.visit WHERE created_by = :c"), {"c": out["rec"]})
        conn.execute(text("DELETE FROM core.patient WHERE created_by = :c"), {"c": out["rec"]})
        conn.execute(text("DELETE FROM core.user_account WHERE id = ANY(:i)"), {"i": [out["rec"], out["doca"], out["docb"]]})


def test_prescription_flow(d):
    anon, a, b, rec = (TestClient(app) for _ in range(4))
    _login(a, d["doca_email"]); _login(b, d["docb_email"]); _login(rec, d["rec_email"])
    vid = d["visit"]
    url = f"/api/doctor/visits/{vid}/prescription"

    _expect(a.put(url, json={"items": [ITEM]}), 409, "cannot save while the visit is waiting")
    _expect(a.post(f"/api/doctor/visits/{vid}/start"), 200, "start consultation")
    assert _expect(a.get(url), 200, "no prescription yet").json()["prescription"] is None
    _expect(a.put(url, json={"items": []}), 422, "empty prescription rejected")
    _expect(a.put(url, json={"items": [{**ITEM, "durationDays": 0}]}), 422, "zero days rejected")
    _expect(b.put(url, json={"items": [ITEM]}), 404, "other doctor cannot save")
    _expect(b.get(url), 404, "other doctor cannot read")
    _expect(rec.put(url, json={"items": [ITEM]}), 403, "receptionist blocked")

    _expect(a.put(url, json={"items": [ITEM], "notes": "After food"}), 200, "save prescription")
    rx = a.get(url).json()["prescription"]
    assert len(rx["items"]) == 1 and rx["notes"] == "After food" and rx["items"][0]["durationDays"] == 5
    print("PASS  saved prescription reads back correctly")

    two = [ITEM, {**ITEM, "drugName": "Zz Second", "genericName": None}]
    _expect(a.put(url, json={"items": two}), 200, "saving again replaces the items")
    rx2 = a.get(url).json()["prescription"]
    assert len(rx2["items"]) == 2 and rx2["prescriptionId"] == rx["prescriptionId"]
    with engine.connect() as conn:
        n = conn.execute(text("SELECT count(*) FROM core.patient_prescription WHERE visit_id = :v"), {"v": vid}).scalar_one()
    assert n == 1
    print("PASS  still exactly one prescription per visit")

    _expect(anon.get("/api/drugs?q=co"), 401, "drug catalog needs login")
    _expect(rec.get("/api/drugs?q=co"), 403, "drug catalog blocked for receptionist")
    cat = _expect(a.get("/api/drugs?q=co&limit=3"), 200, "doctor searches the catalog").json()["data"]
    assert len(cat) <= 3
    body = {"drugName": "codeine", "diplotypes": [], "persist": True, "patientId": d["patient"]}
    _expect(b.post("/api/gene-recommendation", json=body), 403, "other doctor cannot save results for this patient")
    _expect(a.post("/api/gene-recommendation", json={**body, "persist": False}), 200, "recommendation lookup works")
    chat = {"messages": [{"role": "user", "content": "hi"}]}
    _expect(anon.post("/api/chat", json=chat), 401, "chat needs login")
    _expect(rec.post("/api/chat", json=chat), 403, "chat blocked for receptionist")

    _expect(a.post(f"/api/doctor/visits/{vid}/complete"), 200, "complete visit")
    _expect(a.put(url, json={"items": [ITEM]}), 409, "completed visit is locked")
    assert a.get(url).json()["prescription"] is not None
    print("PASS  completed prescription is still readable")