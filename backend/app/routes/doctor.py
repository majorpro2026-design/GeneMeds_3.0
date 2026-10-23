from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.auth.user_dependencies import require_roles
from app.auth.user_schemas import UserResponse
from app.database import engine
from app.services.common import CLINIC_TZ, MAX_BIGINT, iso, like_pattern, log_audit
from pydantic import BaseModel, ConfigDict, Field



logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/doctor", tags=["Doctor"])
doctor_only = require_roles("doctor")


def _code(visit_id: int) -> str:
    return f"V-{visit_id:06d}"


@router.get("/queue")
def my_queue(
    scope: Literal["open", "done"] = Query("open"),
    doc: UserResponse = Depends(doctor_only),
) -> dict[str, Any]:
    if scope == "open":
        where = "v.status IN ('waiting','in_consultation')"
        order = "(v.status = 'in_consultation') DESC, v.created_at ASC"
    else:
        where = ("v.status = 'completed' AND (v.updated_at AT TIME ZONE CAST(:tz AS text))::date "
                 "= (now() AT TIME ZONE CAST(:tz AS text))::date")
        order = "v.updated_at DESC"
    query = text(
        f"""
        SELECT v.visit_id, v.status, v.reason, v.created_at,
               p.patient_id, p.patient_code, p.full_name, p.dob, p.sex, p.phone
        FROM core.visit v JOIN core.patient p ON p.patient_id = v.patient_id
        WHERE v.doctor_id = :me AND {where}
        ORDER BY {order}
        LIMIT 100
        """
    )  # where/order are constant strings chosen above, never user input
    params: dict[str, Any] = {"me": doc.id}
    if scope == "done":
        params["tz"] = CLINIC_TZ
    try:
        with engine.connect() as conn:
            rows = conn.execute(query, params).mappings().all()
    except SQLAlchemyError:
        logger.exception("Doctor queue failed")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not load your queue.")
    return {"items": [
        {"visitId": r["visit_id"], "visitCode": _code(r["visit_id"]), "status": r["status"], "reason": r["reason"],
         "createdAt": iso(r["created_at"]),
         "patient": {"patientId": r["patient_id"], "patientCode": r["patient_code"], "fullName": r["full_name"],
                     "dob": iso(r["dob"]), "sex": r["sex"], "phone": r["phone"]}}
        for r in rows
    ]}


def _transition(visit_id: int, doc: UserResponse, frm: str, to: str, verb: str, action: str) -> dict[str, Any]:
    try:
        with engine.begin() as conn:
            row = conn.execute(
                text("SELECT status FROM core.visit WHERE visit_id = :id AND doctor_id = :me FOR UPDATE"),
                {"id": visit_id, "me": doc.id},
            ).mappings().first()
            if row is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Visit not found.")
            if row["status"] != frm:
                raise HTTPException(status.HTTP_409_CONFLICT, f"Cannot {verb}: the visit is '{row['status']}'.")
            conn.execute(text("UPDATE core.visit SET status = :to, updated_at = now() WHERE visit_id = :id"),
                         {"to": to, "id": visit_id})
            log_audit(conn, doc, action, "visit", visit_id, {"from": frm, "to": to})
    except HTTPException:
        raise
    except SQLAlchemyError:
        logger.exception("Visit transition failed (%s)", action)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not update the visit.")
    return {"visitId": visit_id, "status": to}


@router.post("/visits/{visit_id}/start")
def start_visit(visit_id: int = Path(..., ge=1, le=MAX_BIGINT), doc: UserResponse = Depends(doctor_only)) -> dict[str, Any]:
    return _transition(visit_id, doc, "waiting", "in_consultation", "start", "visit.start")


@router.post("/visits/{visit_id}/complete")
def complete_visit(visit_id: int = Path(..., ge=1, le=MAX_BIGINT), doc: UserResponse = Depends(doctor_only)) -> dict[str, Any]:
    return _transition(visit_id, doc, "in_consultation", "completed", "complete", "visit.complete")


@router.get("/visits/{visit_id}")
def visit_detail(visit_id: int = Path(..., ge=1, le=MAX_BIGINT), doc: UserResponse = Depends(doctor_only)) -> dict[str, Any]:
    try:
        with engine.connect() as conn:
            r = conn.execute(
                text(
                    """
                    SELECT v.visit_id, v.status, v.reason, v.created_at,
                           p.patient_id, p.patient_code, p.full_name, p.dob, p.sex, p.phone, p.email
                    FROM core.visit v JOIN core.patient p ON p.patient_id = v.patient_id
                    WHERE v.visit_id = :id AND v.doctor_id = :me
                    """
                ),
                {"id": visit_id, "me": doc.id},
            ).mappings().first()
            if r is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Visit not found.")
            prev = conn.execute(
                text(
                    """
                    SELECT visit_id, status, reason, created_at FROM core.visit
                    WHERE patient_id = :p AND doctor_id = :me AND visit_id <> :id
                    ORDER BY created_at DESC LIMIT 20
                    """
                ),
                {"p": r["patient_id"], "me": doc.id, "id": visit_id},
            ).mappings().all()
    except HTTPException:
        raise
    except SQLAlchemyError:
        logger.exception("Visit detail failed")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not load the visit.")
    return {
        "visit": {"visitId": r["visit_id"], "visitCode": _code(r["visit_id"]), "status": r["status"],
                  "reason": r["reason"], "createdAt": iso(r["created_at"])},
        "patient": {"patientId": r["patient_id"], "patientCode": r["patient_code"], "fullName": r["full_name"],
                    "dob": iso(r["dob"]), "sex": r["sex"], "phone": r["phone"], "email": r["email"]},
        "previousVisits": [
            {"visitId": x["visit_id"], "visitCode": _code(x["visit_id"]), "status": x["status"],
             "reason": x["reason"], "createdAt": iso(x["created_at"])}
            for x in prev
        ],
    }


@router.get("/patients")
def my_patients(
    q: str = Query("", max_length=100),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    doc: UserResponse = Depends(doctor_only),
) -> dict[str, Any]:
    q = q.strip()
    query = text(
        """
        SELECT p.patient_id, p.patient_code, p.full_name, p.dob, p.sex, p.phone,
               COUNT(v.visit_id) AS visits, MAX(v.created_at) AS last_visit, COUNT(*) OVER() AS total
        FROM core.patient p
        JOIN core.visit v ON v.patient_id = p.patient_id AND v.doctor_id = :me
        WHERE :q = '' OR p.full_name ILIKE :like ESCAPE '!' OR p.phone ILIKE :like ESCAPE '!'
              OR p.patient_code ILIKE :like ESCAPE '!'
        GROUP BY p.patient_id
        ORDER BY last_visit DESC, p.patient_id DESC
        LIMIT :limit OFFSET :offset
        """
    )
    try:
        with engine.connect() as conn:
            rows = conn.execute(query, {"me": doc.id, "q": q, "like": like_pattern(q), "limit": limit, "offset": offset}).mappings().all()
    except SQLAlchemyError:
        logger.exception("Doctor patient search failed")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not search patients.")
    return {
        "total": rows[0]["total"] if rows else 0, "limit": limit, "offset": offset,
        "items": [
            {"patientId": r["patient_id"], "patientCode": r["patient_code"], "fullName": r["full_name"],
             "dob": iso(r["dob"]), "sex": r["sex"], "phone": r["phone"],
             "visits": r["visits"], "lastVisit": iso(r["last_visit"])}
            for r in rows
        ],
    }
    
class RxItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    drug_name: str = Field(..., alias="drugName", min_length=1, max_length=200)
    generic_name: str | None = Field(default=None, alias="genericName", max_length=200)
    dosage: str = Field(..., min_length=1, max_length=100)
    frequency: str = Field(..., min_length=1, max_length=60)
    duration_days: int = Field(..., alias="durationDays", ge=1, le=3650)


class RxSave(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    items: list[RxItem] = Field(..., min_length=1, max_length=30)
    notes: str | None = Field(default=None, max_length=1000)
    diagnosis: str | None = Field(default=None, max_length=500)


@router.put("/visits/{visit_id}/prescription")
def save_prescription(
    payload: RxSave,
    visit_id: int = Path(..., ge=1, le=MAX_BIGINT),
    doc: UserResponse = Depends(doctor_only),
) -> dict[str, Any]:
    generics = sorted({i.generic_name.strip().lower() for i in payload.items if i.generic_name})
    try:
        with engine.begin() as conn:
            v = conn.execute(
                text("SELECT patient_id, status FROM core.visit WHERE visit_id = :id AND doctor_id = :me FOR UPDATE"),
                {"id": visit_id, "me": doc.id},
            ).mappings().first()
            if v is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Visit not found.")
            if v["status"] != "in_consultation":
                raise HTTPException(status.HTTP_409_CONFLICT,
                                    f"A prescription can only be saved during consultation (this visit is '{v['status']}').")

            drug_ids: dict[str, int] = {}
            if generics:
                rows = conn.execute(
                    text(
                        """
                        SELECT lower(btrim(generic_name)) AS g, MIN(drug_id) AS drug_id
                        FROM knowledge.drug
                        WHERE lower(btrim(generic_name)) = ANY(CAST(:g AS text[]))
                        GROUP BY 1
                        """
                    ),
                    {"g": generics},
                ).mappings().all()
                drug_ids = {r["g"]: r["drug_id"] for r in rows}

            pid = conn.execute(
                text("SELECT prescription_id FROM core.patient_prescription WHERE visit_id = :id"), {"id": visit_id}
            ).scalar()
            if pid:
                conn.execute(
                    text("UPDATE core.patient_prescription SET notes = :n, diagnosis = :dx, prescribed_at = now(), updated_at = now() WHERE prescription_id = :p"),
                    {"n": payload.notes or None, "dx": payload.diagnosis or None, "p": pid},
                )
                conn.execute(text("DELETE FROM core.prescription_item WHERE prescription_id = :p"), {"p": pid})
            else:
                pid = conn.execute(
                    text(
                        """
                        INSERT INTO core.patient_prescription
                            (patient_id, doctor_id, visit_id, notes, diagnosis, prescribed_at, created_at, updated_at)
                        VALUES (:pa, :d, :v, :n, :dx, now(), now(), now())
                        RETURNING prescription_id
                        """
                    ),
                    {"pa": v["patient_id"], "d": doc.id, "v": visit_id, "n": payload.notes or None, "dx": payload.diagnosis or None},
                ).scalar_one()

            for it in payload.items:
                conn.execute(
                    text(
                        """
                        INSERT INTO core.prescription_item
                            (prescription_id, drug_id, drug_name, generic_name, dosage, frequency,
                             duration_value, duration_unit, created_at, updated_at)
                        VALUES (:p, :drug, :name, :gen, :dose, :freq, :dur, 'days', now(), now())
                        """
                    ),
                    {"p": pid, "drug": drug_ids.get((it.generic_name or "").strip().lower()), "name": it.drug_name,
                     "gen": it.generic_name or None, "dose": it.dosage, "freq": it.frequency, "dur": it.duration_days},
                )
            log_audit(conn, doc, "prescription.save", "prescription", pid, {"visitId": visit_id, "items": len(payload.items)})
    except HTTPException:
        raise
    except SQLAlchemyError:
        logger.exception("Prescription save failed")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not save the prescription.")
    return {"prescriptionId": pid}


@router.get("/visits/{visit_id}/prescription")
def get_prescription(visit_id: int = Path(..., ge=1, le=MAX_BIGINT), doc: UserResponse = Depends(doctor_only)) -> dict[str, Any]:
    try:
        with engine.connect() as conn:
            if not conn.execute(text("SELECT 1 FROM core.visit WHERE visit_id = :id AND doctor_id = :me"),
                                {"id": visit_id, "me": doc.id}).first():
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Visit not found.")
            rx = conn.execute(
                text("SELECT prescription_id, notes, diagnosis, prescribed_at FROM core.patient_prescription WHERE visit_id = :id"),
                {"id": visit_id},
            ).mappings().first()
            if rx is None:
                return {"prescription": None}
            items = conn.execute(
                text(
                    """
                    SELECT drug_name, generic_name, dosage, frequency, duration_value
                    FROM core.prescription_item WHERE prescription_id = :p ORDER BY prescription_item_id
                    """
                ),
                {"p": rx["prescription_id"]},
            ).mappings().all()
    except HTTPException:
        raise
    except SQLAlchemyError:
        logger.exception("Prescription load failed")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not load the prescription.")
    return {"prescription": {
        "prescriptionId": rx["prescription_id"], "notes": rx["notes"], "diagnosis": rx["diagnosis"], "savedAt": iso(rx["prescribed_at"]),
        "items": [
            {"drugName": i["drug_name"], "genericName": i["generic_name"], "dosage": i["dosage"] or "",
             "frequency": i["frequency"] or "", "durationDays": int(i["duration_value"] or 0)}
            for i in items
        ],
    }}
@router.get("/visits/{visit_id}/history")
def visit_history(visit_id: int = Path(..., ge=1, le=MAX_BIGINT), doc: UserResponse = Depends(doctor_only)) -> dict[str, Any]:
    """This doctor's own completed visits with the same patient, newest first, each with its prescription."""
    try:
        with engine.connect() as conn:
            base = conn.execute(
                text("SELECT patient_id FROM core.visit WHERE visit_id = :id AND doctor_id = :me"),
                {"id": visit_id, "me": doc.id},
            ).mappings().first()
            if base is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Visit not found.")
            visits = conn.execute(
                text(
                    """
                    SELECT v.visit_id, v.status, v.reason, v.created_at,
                           rx.prescription_id, rx.notes, rx.diagnosis, rx.prescribed_at
                    FROM core.visit v
                    LEFT JOIN core.patient_prescription rx ON rx.visit_id = v.visit_id
                    WHERE v.patient_id = :p AND v.doctor_id = :me AND v.visit_id <> :id AND v.status = 'completed'
                    ORDER BY v.created_at DESC
                    LIMIT 10
                    """
                ),
                {"p": base["patient_id"], "me": doc.id, "id": visit_id},
            ).mappings().all()
            pids = [r["prescription_id"] for r in visits if r["prescription_id"]]
            items = conn.execute(
                text(
                    """
                    SELECT prescription_id, drug_name, generic_name, dosage, frequency, duration_value
                    FROM core.prescription_item
                    WHERE prescription_id = ANY(CAST(:ids AS bigint[]))
                    ORDER BY prescription_item_id
                    """
                ),
                {"ids": pids},
            ).mappings().all() if pids else []
    except HTTPException:
        raise
    except SQLAlchemyError:
        logger.exception("Visit history failed")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not load earlier visits.")

    by_rx: dict[int, list[dict[str, Any]]] = {}
    for i in items:
        by_rx.setdefault(i["prescription_id"], []).append({
            "drugName": i["drug_name"], "genericName": i["generic_name"], "dosage": i["dosage"] or "",
            "frequency": i["frequency"] or "", "durationDays": int(i["duration_value"] or 0),
        })
    return {"items": [
        {
            "visitId": r["visit_id"], "visitCode": _code(r["visit_id"]), "status": r["status"],
            "reason": r["reason"], "createdAt": iso(r["created_at"]),
            "prescription": None if r["prescription_id"] is None else {
                "diagnosis": r["diagnosis"], "notes": r["notes"], "savedAt": iso(r["prescribed_at"]),
                "items": by_rx.get(r["prescription_id"], []),
            },
        }
        for r in visits
    ]}