from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.auth.dependencies import get_current_hcp
from app.auth.models import Base
from app.auth.schemas import HCPResponse
from app.database import engine

router = APIRouter(prefix="/api/patients", tags=["Patient Management"])


def ensure_patient_table_exists() -> None:
    """Ensure that core schema and core.patient table exist in PostgreSQL."""
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS core;"))
            Base.metadata.create_all(bind=conn)
    except Exception as exc:
        print(f"[Patient Init] Note: Could not auto-create core.patient table: {exc}", flush=True)


# Auto-create core.patient table if needed on import
ensure_patient_table_exists()


class PatientResponse(BaseModel):
    patient_id: int
    full_name: str
    dob: str
    sex: str


class PatientCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=120)
    dob: date
    sex: str = Field(..., min_length=1, max_length=20)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        clean = value.strip()
        if not clean:
            raise ValueError("Full name cannot be empty or whitespace only.")
        return clean

    @field_validator("sex")
    @classmethod
    def validate_sex(cls, value: str) -> str:
        clean = value.strip()
        if not clean:
            raise ValueError("Sex cannot be empty or whitespace only.")
        return clean

    @field_validator("dob")
    @classmethod
    def validate_dob(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Date of birth cannot be in the future.")
        return value


@router.get("/search", response_model=list[PatientResponse])
def search_patients(
    q: str | None = Query(default=None, description="Search term for patient name or patient ID"),
    current_hcp: HCPResponse = Depends(get_current_hcp),
) -> list[dict[str, Any]]:
    query_str = (q or "").strip()
    if not query_str:
        return []

    # Strip optional "P" or "P00" prefix for ID searches like P00124 or P124
    clean_id_query = query_str
    if clean_id_query.upper().startswith("P"):
        clean_id_query = clean_id_query[1:].lstrip("0")
        if not clean_id_query:
            clean_id_query = "0"

    sql = text(
        """
        SELECT patient_id, full_name, dob, sex
        FROM core.patient
        WHERE LOWER(TRIM(full_name)) ILIKE :name_term
           OR CAST(patient_id AS text) ILIKE :id_term
        ORDER BY patient_id DESC
        LIMIT 20
        """
    )

    name_term = f"%{query_str.lower()}%"
    id_term = f"%{clean_id_query}%"

    try:
        with engine.connect() as conn:
            rows = conn.execute(sql, {"name_term": name_term, "id_term": id_term}).mappings().all()
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error searching patients: {exc}",
        )

    return [
        {
            "patient_id": row["patient_id"],
            "full_name": row["full_name"],
            "dob": row["dob"].isoformat() if isinstance(row["dob"], date) else str(row["dob"]),
            "sex": row["sex"],
        }
        for row in rows
    ]


@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
def create_patient(
    payload: PatientCreateRequest,
    current_hcp: HCPResponse = Depends(get_current_hcp),
) -> dict[str, Any]:
    insert_sql = text(
        """
        INSERT INTO core.patient (full_name, dob, sex, created_at, updated_at)
        VALUES (:full_name, :dob, :sex, NOW(), NOW())
        RETURNING patient_id, full_name, dob, sex
        """
    )

    try:
        with engine.begin() as conn:
            row = conn.execute(
                insert_sql,
                {
                    "full_name": payload.full_name,
                    "dob": payload.dob,
                    "sex": payload.sex,
                },
            ).mappings().first()
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create patient: {exc}",
        )

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve created patient record.",
        )

    return {
        "patient_id": row["patient_id"],
        "full_name": row["full_name"],
        "dob": row["dob"].isoformat() if isinstance(row["dob"], date) else str(row["dob"]),
        "sex": row["sex"],
    }
