from __future__ import annotations

import json
import logging
import os
import re
from datetime import date
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.auth.user_dependencies import require_roles
from app.auth.user_schemas import UserResponse
from app.database import engine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reception", tags=["Reception"])

CLINIC_TZ = os.getenv("CLINIC_TIMEZONE", "Asia/Kolkata")
MAX_BIGINT = 9_223_372_036_854_775_807
_PHONE_RE = re.compile(r"^\+?[0-9][0-9 ()-]{6,19}$")
receptionist_only = require_roles("receptionist")


class PatientCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    full_name: str = Field(..., alias="fullName", min_length=2, max_length=120)
    dob: date
    sex: Literal["male", "female", "other"]
    phone: str
    email: EmailStr | None = None

    @field_validator("dob")
    @classmethod
    def _dob(cls, v: date) -> date:
        if v > date.today() or v.year < 1900:
            raise ValueError("Enter a valid date of birth.")
        return v

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        if not _PHONE_RE.match(v):
            raise ValueError("Enter a valid phone number.")
        return v

    @field_validator("email", mode="before")
    @classmethod
    def _blank_email(cls, v: Any) -> Any:
        return v or None


class VisitCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    patient_id: int = Field(..., alias="patientId", ge=1, le=MAX_BIGINT)
    doctor_id: int = Field(..., alias="doctorId", ge=1, le=MAX_BIGINT)
    reason: str | None = Field(default=None, max_length=300)


def _audit(conn: Any, actor: UserResponse, action: str, target_type: str, target_id: int, details: dict | None = None) -> None:
    conn.execute(
        text(
            """
            INSERT INTO core.audit_log (actor_user_id, actor_role, action, target_type, target_id, details)
            VALUES (:actor, :role, :action, :tt, :tid, CAST(:details AS jsonb))
            """
        ),
        {"actor": actor.id, "role": actor.role, "action": action, "tt": target_type, "tid": target_id,
         "details": json.dumps(details or {})},
    )


def _iso(v: Any) -> str | None:
    return v.isoformat() if v is not None else None


def _like(q: str) -> str:
    return "%" + q.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%"


@router.get("/doctors")
def list_doctors(rec: UserResponse = Depends(receptionist_only)) -> dict[str, Any]:
    query = text(
        """
        SELECT ua.id, ua.full_name, dp.hospital_name,
               (SELECT COUNT(*) FROM core.visit v
                 WHERE v.doctor_id = ua.id AND v.status IN ('waiting','in_consultation')) AS open_visits
        FROM core.user_account ua
        LEFT JOIN core.doctor_profile dp ON dp.user_id = ua.id
        WHERE ua.role = 'doctor' AND ua.status = 'active'
        ORDER BY ua.full_name
        """
    )
    try:
        with engine.connect() as conn:
            rows = conn.execute(query).mappings().all()
    except SQLAlchemyError:
        logger.exception("Doctor list failed")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not load doctors.")
    return {"items": [
        {"id": r["id"], "fullName": r["full_name"], "hospitalName": r["hospital_name"], "openVisits": r["open_visits"]}
        for r in rows
    ]}


@router.post("/patients", status_code=status.HTTP_201_CREATED)
def register_patient(payload: PatientCreate, rec: UserResponse = Depends(receptionist_only)) -> dict[str, Any]:
    email = str(payload.email).lower() if payload.email else None
    try:
        with engine.begin() as conn:
            dup = conn.execute(
                text(
                    """
                    SELECT patient_code FROM core.patient
                    WHERE lower(btrim(full_name)) = lower(:name) AND dob = :dob AND phone = :phone LIMIT 1
                    """
                ),
                {"name": payload.full_name, "dob": payload.dob, "phone": payload.phone},
            ).mappings().first()
            if dup:
                raise HTTPException(status.HTTP_409_CONFLICT, f"This patient is already registered as {dup['patient_code']}.")

            row = conn.execute(
                text(
                    """
                    INSERT INTO core.patient (full_name, dob, sex, phone, email, created_by)
                    VALUES (:name, :dob, :sex, :phone, :email, :by)
                    RETURNING patient_id, patient_code, created_at
                    """
                ),
                {"name": payload.full_name, "dob": payload.dob, "sex": payload.sex, "phone": payload.phone,
                 "email": email, "by": rec.id},
            ).mappings().one()
            _audit(conn, rec, "patient.create", "patient", row["patient_id"])
    except HTTPException:
        raise
    except SQLAlchemyError:
        logger.exception("Patient registration failed")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not register the patient.")

    return {"patientId": row["patient_id"], "patientCode": row["patient_code"], "createdAt": _iso(row["created_at"])}


@router.get("/patients")
def search_patients(
    q: str = Query("", max_length=100),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    rec: UserResponse = Depends(receptionist_only),
) -> dict[str, Any]:
    q = q.strip()
    query = text(
        """
        SELECT patient_id, patient_code, full_name, dob, sex, phone, email, created_at, COUNT(*) OVER() AS total
        FROM core.patient
        WHERE :q = '' OR full_name ILIKE :like ESCAPE '!' OR phone ILIKE :like ESCAPE '!'
              OR patient_code ILIKE :like ESCAPE '!'
        ORDER BY created_at DESC, patient_id DESC
        LIMIT :limit OFFSET :offset
        """
    )
    try:
        with engine.connect() as conn:
            rows = conn.execute(query, {"q": q, "like": _like(q), "limit": limit, "offset": offset}).mappings().all()
    except SQLAlchemyError:
        logger.exception("Patient search failed")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not search patients.")
    return {
        "total": rows[0]["total"] if rows else 0, "limit": limit, "offset": offset,
        "items": [
            {"patientId": r["patient_id"], "patientCode": r["patient_code"], "fullName": r["full_name"],
             "dob": _iso(r["dob"]), "sex": r["sex"], "phone": r["phone"], "email": r["email"],
             "createdAt": _iso(r["created_at"])}
            for r in rows
        ],
    }


@router.post("/visits", status_code=status.HTTP_201_CREATED)
def create_visit(payload: VisitCreate, rec: UserResponse = Depends(receptionist_only)) -> dict[str, Any]:
    try:
        with engine.begin() as conn:
            if not conn.execute(text("SELECT 1 FROM core.patient WHERE patient_id = :id"), {"id": payload.patient_id}).first():
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found.")
            if not conn.execute(
                text("SELECT 1 FROM core.user_account WHERE id = :id AND role = 'doctor' AND status = 'active'"),
                {"id": payload.doctor_id},
            ).first():
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose an active doctor.")
            open_visit = conn.execute(
                text("SELECT visit_id FROM core.visit WHERE patient_id = :p AND status IN ('waiting','in_consultation') LIMIT 1"),
                {"p": payload.patient_id},
            ).mappings().first()
            if open_visit:
                raise HTTPException(status.HTTP_409_CONFLICT, f"This patient already has an open visit (V-{open_visit['visit_id']:06d}).")

            row = conn.execute(
                text(
                    """
                    INSERT INTO core.visit (patient_id, doctor_id, created_by, reason)
                    VALUES (:p, :d, :by, :reason)
                    RETURNING visit_id, status, created_at
                    """
                ),
                {"p": payload.patient_id, "d": payload.doctor_id, "by": rec.id, "reason": payload.reason or None},
            ).mappings().one()
            _audit(conn, rec, "visit.create", "visit", row["visit_id"],
                   {"patientId": payload.patient_id, "doctorId": payload.doctor_id})
    except HTTPException:
        raise
    except IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT, "This patient already has an open visit.")
    except SQLAlchemyError:
        logger.exception("Visit creation failed")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not create the visit.")

    return {"visitId": row["visit_id"], "visitCode": f"V-{row['visit_id']:06d}", "status": row["status"],
            "createdAt": _iso(row["created_at"])}


@router.get("/visits")
def list_today_visits(
    status_filter: Literal["waiting", "in_consultation", "completed", "cancelled"] | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    rec: UserResponse = Depends(receptionist_only),
) -> dict[str, Any]:
    query = text(
        """
        SELECT v.visit_id, v.status, v.reason, v.created_at,
               p.patient_id, p.patient_code, p.full_name AS patient_name,
               d.id AS doctor_id, d.full_name AS doctor_name,
               COUNT(*) OVER() AS total
        FROM core.visit v
        JOIN core.patient p ON p.patient_id = v.patient_id
        JOIN core.user_account d ON d.id = v.doctor_id
        WHERE (v.created_at AT TIME ZONE CAST(:tz AS text))::date = (now() AT TIME ZONE CAST(:tz AS text))::date
          AND (CAST(:status AS text) IS NULL OR v.status = CAST(:status AS text))
        ORDER BY v.created_at DESC, v.visit_id DESC
        LIMIT :limit OFFSET :offset
        """
    )
    try:
        with engine.connect() as conn:
            rows = conn.execute(query, {"tz": CLINIC_TZ, "status": status_filter, "limit": limit, "offset": offset}).mappings().all()
    except SQLAlchemyError:
        logger.exception("Visit list failed")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not load visits.")
    return {
        "total": rows[0]["total"] if rows else 0, "limit": limit, "offset": offset,
        "items": [
            {"visitId": r["visit_id"], "visitCode": f"V-{r['visit_id']:06d}", "status": r["status"], "reason": r["reason"],
             "createdAt": _iso(r["created_at"]),
             "patient": {"patientId": r["patient_id"], "patientCode": r["patient_code"], "fullName": r["patient_name"]},
             "doctor": {"id": r["doctor_id"], "fullName": r["doctor_name"]}}
            for r in rows
        ],
    }


@router.post("/visits/{visit_id}/cancel")
def cancel_visit(visit_id: int = Path(..., ge=1, le=MAX_BIGINT), rec: UserResponse = Depends(receptionist_only)) -> dict[str, Any]:
    try:
        with engine.begin() as conn:
            row = conn.execute(
                text("SELECT status FROM core.visit WHERE visit_id = :id FOR UPDATE"), {"id": visit_id}
            ).mappings().first()
            if row is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Visit not found.")
            if row["status"] != "waiting":
                raise HTTPException(status.HTTP_409_CONFLICT, f"Only waiting visits can be cancelled (this one is '{row['status']}').")
            conn.execute(text("UPDATE core.visit SET status = 'cancelled', updated_at = now() WHERE visit_id = :id"), {"id": visit_id})
            _audit(conn, rec, "visit.cancel", "visit", visit_id, {"from": "waiting", "to": "cancelled"})
    except HTTPException:
        raise
    except SQLAlchemyError:
        logger.exception("Visit cancel failed")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not cancel the visit.")
    return {"visitId": visit_id, "status": "cancelled"}