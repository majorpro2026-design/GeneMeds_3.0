"""Admin overview + search check against the real DB. Run from backend/:  python -m pytest tests/test_admin_stats.py -s -v"""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.auth.security import hash_password
from app.database import engine
from app.main import app

PW = "Test@12345"


def _user(role: str, email: str, name: str, status: str) -> int:
    with engine.begin() as conn:
        return conn.execute(
            text("INSERT INTO core.user_account (role,email,full_name,password_hash,status) VALUES (:r,:e,:n,:p,:s) RETURNING id"),
            {"r": role, "e": email, "n": name, "p": hash_password(PW), "s": status},
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
    out = {"tag": tag, "adm_email": f"zz.{tag}.adm@example.com", "doc_email": f"zz.{tag}.doc@example.com", "pend_email": f"zz.{tag}.pend@example.com"}
    out["adm"] = _user("admin", out["adm_email"], "Zz Admin", "active")
    out["doc"] = _user("doctor", out["doc_email"], "Zz Active Doctor", "active")
    out["pend"] = _user("doctor", out["pend_email"], f"Zz Searchable {tag}", "pending")
    yield out
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM core.user_account WHERE id = ANY(:i)"), {"i": [out["adm"], out["doc"], out["pend"]]})


def test_admin_stats_and_search(d):
    adm, doc, anon = TestClient(app), TestClient(app), TestClient(app)
    _login(adm, d["adm_email"]); _login(doc, d["doc_email"])

    _expect(anon.get("/api/admin/stats"), 401, "stats need login")
    _expect(doc.get("/api/admin/stats"), 403, "doctor blocked from stats")
    s = _expect(adm.get("/api/admin/stats"), 200, "admin reads stats").json()
    for k in ("staffTotal", "staffActive", "pending", "doctors", "doctorsActive", "receptionists", "receptionistsActive", "admins", "patients", "visitsToday"):
        assert isinstance(s[k], int), k
    assert s["pending"] >= 1 and s["doctors"] >= 2 and s["admins"] >= 1 and s["staffTotal"] >= s["staffActive"]
    print("PASS  stats are consistent")

        # "Searchable <tag>" only appears in the pending doctor's name, not in any email
    r = _expect(adm.get("/api/admin/users", params={"q": f"Searchable {d['tag']}"}), 200, "search by name").json()
    assert r["total"] == 1 and r["items"][0]["id"] == d["pend"] and "lastLoginAt" in r["items"][0]

    both = adm.get("/api/admin/users", params={"q": d["tag"]}).json()
    assert {u["id"] for u in both["items"]} == {d["pend"], d["doc"]}
    print("PASS  search also matches emails")

    assert adm.get("/api/admin/users", params={"q": d["pend_email"]}).json()["total"] == 1
    print("PASS  search by full email")

    assert adm.get("/api/admin/users", params={"q": "%"}).json()["total"] == 0
    print("PASS  wildcard characters are escaped")