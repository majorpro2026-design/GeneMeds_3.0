from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import AliasChoices, BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.auth.dependencies import get_current_hcp
from app.auth.models import Base
from app.auth.schemas import HCPResponse
from app.database import engine
from app.services.drug_lookup import (
    PrescriptionCreateRequest,
    PrescriptionDrugItem,
    build_prescription_response,
)

router = APIRouter(prefix="/api", tags=["Prescriptions"])


def ensure_prescription_tables_exist() -> None:
    """
    Ensure core.patient_prescription and core.prescription_item tables exist in PostgreSQL.
    Safely adds missing columns and migrates legacy medicine data if present.
    """
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS core;"))

            # 1. Ensure core.patient_prescription header table exists
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS core.patient_prescription (
                    prescription_id BIGSERIAL PRIMARY KEY,
                    patient_id BIGINT NULL REFERENCES core.patient(patient_id) ON DELETE CASCADE,
                    doctor_id BIGINT NULL REFERENCES core.hcp_account(id) ON DELETE CASCADE,
                    visit_id BIGINT NULL,
                    prescribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    notes TEXT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            """))

            # 2. Ensure all columns exist in case table pre-existed with a partial schema
            conn.execute(text("ALTER TABLE core.patient_prescription ADD COLUMN IF NOT EXISTS patient_id BIGINT REFERENCES core.patient(patient_id) ON DELETE CASCADE;"))
            conn.execute(text("ALTER TABLE core.patient_prescription ADD COLUMN IF NOT EXISTS doctor_id BIGINT REFERENCES core.hcp_account(id) ON DELETE CASCADE;"))
            conn.execute(text("ALTER TABLE core.patient_prescription ADD COLUMN IF NOT EXISTS visit_id BIGINT;"))
            conn.execute(text("ALTER TABLE core.patient_prescription ALTER COLUMN visit_id DROP NOT NULL;"))
            conn.execute(text("ALTER TABLE core.patient_prescription ADD COLUMN IF NOT EXISTS prescribed_at TIMESTAMPTZ DEFAULT NOW();"))
            conn.execute(text("ALTER TABLE core.patient_prescription ADD COLUMN IF NOT EXISTS notes TEXT;"))
            conn.execute(text("ALTER TABLE core.patient_prescription ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();"))
            conn.execute(text("ALTER TABLE core.patient_prescription ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();"))

            # 3. Ensure core.prescription_item child table exists
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS core.prescription_item (
                    prescription_item_id BIGSERIAL PRIMARY KEY,
                    prescription_id BIGINT NOT NULL REFERENCES core.patient_prescription(prescription_id) ON DELETE CASCADE,
                    drug_id BIGINT NULL,
                    drug_name TEXT NOT NULL,
                    dosage TEXT NULL,
                    frequency TEXT NULL,
                    duration_value NUMERIC NULL,
                    duration_unit TEXT NULL DEFAULT 'days',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            """))

            # 4. Migrate legacy medicine columns if present on patient_prescription
            cols = conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_schema='core' AND table_name='patient_prescription'"
            )).fetchall()
            col_names = {c[0] for c in cols}

            if "drug_name" in col_names:
                conn.execute(text("""
                    INSERT INTO core.prescription_item (
                        prescription_id, drug_id, drug_name, dosage, frequency, duration_value, duration_unit, created_at, updated_at
                    )
                    SELECT prescription_id,
                           CASE WHEN CAST(drug_id AS text) ~ '^[0-9]+$' THEN CAST(drug_id AS BIGINT) ELSE NULL END,
                           COALESCE(drug_name, 'Unknown Drug'),
                           dosage, frequency,
                           CASE WHEN CAST(duration_value AS text) ~ '^[0-9.]+$' THEN CAST(duration_value AS NUMERIC) ELSE NULL END,
                           COALESCE(duration_unit, 'days'),
                           COALESCE(created_at, NOW()),
                           COALESCE(updated_at, NOW())
                    FROM core.patient_prescription
                    WHERE drug_name IS NOT NULL AND TRIM(drug_name) <> '';
                """))

                for col in ["drug_id", "drug_name", "dosage", "frequency", "duration_value", "duration_unit"]:
                    if col in col_names:
                        conn.execute(text(f"ALTER TABLE core.patient_prescription DROP COLUMN IF EXISTS {col};"))

    except Exception as exc:
        print(f"[Prescriptions Init] Note: Schema initialization status: {exc}", flush=True)


# Run schema setup on import
ensure_prescription_tables_exist()


class PrescriptionItemPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    drug_id: int | str | None = Field(default=None, alias="drugId")
    drug_name: str | None = Field(default=None, alias="drugName")
    brand_name: str | None = Field(default=None, alias="brandName")
    dosage: str | None = None
    frequency: str | None = None
    duration_value: float | int | None = Field(default=None, alias="durationValue")
    duration_days: float | int | None = Field(default=None, alias="durationDays")
    duration_unit: str | None = Field(default="days", alias="durationUnit")
    note: str | None = None


class PrescriptionCreatePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    patient_id: int | None = Field(default=None, alias="patientId")
    doctor_id: int | None = Field(default=None, alias="doctorId")
    visit_id: int | None = Field(default=None, alias="visitId")
    notes: str | None = None
    prescribed_at: datetime | None = Field(default=None, alias="prescribedAt")
    prescription_id: str | int | None = Field(default=None, alias="prescriptionId")
    persist: bool = False

    items: list[PrescriptionItemPayload] = Field(
        ...,
        validation_alias=AliasChoices("items", "prescribedDrugs", "prescribed_drugs"),
        min_length=1,
    )


def save_prescription_tx(
    patient_id: int,
    doctor_id: int,
    items_raw: list[PrescriptionItemPayload],
    notes: str | None = None,
    visit_id: int | None = None,
    prescribed_at: datetime | None = None,
) -> int:
    """
    Saves a complete prescription header + items as a SINGLE database transaction.
    Rolls back automatically if any step fails.
    """
    print(f"[PRESCRIPTION DB] host = {engine.url.host}, database = {engine.url.database}, port = {engine.url.port}, user = {engine.url.username}", flush=True)
    print(f"[PRESCRIPTION DB] inserting header for patient_id = {patient_id}, doctor_id = {doctor_id}", flush=True)

    check_patient_sql = text("SELECT patient_id FROM core.patient WHERE patient_id = :patient_id LIMIT 1;")
    insert_header_sql = text("""
        INSERT INTO core.patient_prescription
            (patient_id, doctor_id, visit_id, prescribed_at, notes, created_at, updated_at)
        VALUES
            (:patient_id, :doctor_id, :visit_id, COALESCE(:prescribed_at, NOW()), :notes, NOW(), NOW())
        RETURNING prescription_id;
    """)
    insert_item_sql = text("""
        INSERT INTO core.prescription_item
            (prescription_id, drug_id, drug_name, dosage, frequency, duration_value, duration_unit, created_at, updated_at)
        VALUES
            (:prescription_id, :drug_id, :drug_name, :dosage, :frequency, :duration_value, :duration_unit, NOW(), NOW());
    """)

    try:
        with engine.begin() as conn:
            # 1. Validate patient existence
            p_row = conn.execute(check_patient_sql, {"patient_id": patient_id}).fetchone()
            if not p_row:
                print(f"[PRESCRIPTION DB] ERROR: Patient {patient_id} does not exist!", flush=True)
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Patient with ID {patient_id} does not exist.",
                )

            # 2. Insert header row & get generated prescription_id
            header_row = conn.execute(
                insert_header_sql,
                {
                    "patient_id": patient_id,
                    "doctor_id": doctor_id,
                    "visit_id": visit_id,
                    "prescribed_at": prescribed_at,
                    "notes": notes,
                },
            ).mappings().first()

            if not header_row:
                print("[PRESCRIPTION DB] ERROR: Header row returned None", flush=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create prescription header record.",
                )

            db_prescription_id = header_row["prescription_id"]
            print(f"[PRESCRIPTION DB] generated prescription_id = {db_prescription_id}", flush=True)

            # 3. Insert child items
            print(f"[PRESCRIPTION DB] item_count = {len(items_raw)}", flush=True)
            for item in items_raw:
                drug_name_clean = (item.drug_name or item.brand_name or "").strip()
                if not drug_name_clean:
                    continue

                parsed_drug_id = None
                if item.drug_id is not None:
                    try:
                        parsed_drug_id = int(item.drug_id)
                    except (ValueError, TypeError):
                        parsed_drug_id = None

                dur_val = item.duration_value if item.duration_value is not None else item.duration_days
                parsed_dur_val = None
                if dur_val is not None:
                    try:
                        parsed_dur_val = float(dur_val)
                    except (ValueError, TypeError):
                        parsed_dur_val = None

                dur_unit = (item.duration_unit or "days").strip()

                print(
                    f"[PRESCRIPTION DB] inserting item: drug_name='{drug_name_clean}', drug_id={parsed_drug_id}, "
                    f"dosage='{item.dosage}', frequency='{item.frequency}', duration_value={parsed_dur_val}, duration_unit='{dur_unit}'",
                    flush=True,
                )

                conn.execute(
                    insert_item_sql,
                    {
                        "prescription_id": db_prescription_id,
                        "drug_id": parsed_drug_id,
                        "drug_name": drug_name_clean,
                        "dosage": item.dosage,
                        "frequency": item.frequency,
                        "duration_value": parsed_dur_val,
                        "duration_unit": dur_unit,
                    },
                )

            print(f"[PRESCRIPTION DB] committing transaction for prescription_id = {db_prescription_id}", flush=True)
            # Transaction automatically commits on exiting `with engine.begin()`
            print(f"[PRESCRIPTION DB] commit successful for prescription_id = {db_prescription_id}", flush=True)
            return db_prescription_id

    except HTTPException:
        raise
    except Exception as exc:
        print(f"[PRESCRIPTION DB] EXCEPTION: {type(exc).__name__}: {exc}", flush=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while saving prescription: {exc}",
        )


@router.post("/prescriptions")
def create_prescription(
    payload: PrescriptionCreatePayload,
    current_hcp: HCPResponse = Depends(get_current_hcp),
) -> dict[str, Any]:
    print("[PRESCRIPTION API] endpoint called", flush=True)
    print(f"[PRESCRIPTION API] persist = {payload.persist}", flush=True)
    print(f"[PRESCRIPTION API] patient_id = {payload.patient_id}", flush=True)
    print(f"[PRESCRIPTION API] item_count = {len(payload.items)}", flush=True)

    if not payload.items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Prescription must contain at least one medicine item.",
        )

    db_prescription_id = None
    # Only store prescription in PostgreSQL at the final stage when persist=True and patient_id is present
    if payload.persist and payload.patient_id is not None:
        print("[PRESCRIPTION API] ENTERING PERSISTENCE BRANCH", flush=True)
        db_prescription_id = save_prescription_tx(
            patient_id=payload.patient_id,
            doctor_id=current_hcp.id,
            items_raw=payload.items,
            notes=payload.notes,
            visit_id=payload.visit_id,
            prescribed_at=payload.prescribed_at,
        )
    else:
        print("[PRESCRIPTION API] PERSISTENCE BRANCH SKIPPED (persist is False or patient_id is None)", flush=True)

    # Convert items to PrescriptionDrugItem for PGx drug-gene lookup & test recommendations
    drug_items = []
    for item in payload.items:
        name = item.drug_name or item.brand_name or ""
        drug_items.append(
            PrescriptionDrugItem(
                drugId=item.drug_id,
                drugName=name,
                brandName=item.brand_name or name,
                strength=None,
                generics=[name] if name else [],
                selectedGeneric=name,
                dosage=item.dosage,
                frequency=item.frequency,
                durationDays=int(item.duration_days) if item.duration_days is not None else (int(item.duration_value) if item.duration_value is not None else None),
                note=item.note,
            )
        )

    legacy_req = PrescriptionCreateRequest(
        prescriptionId=str(payload.prescription_id or db_prescription_id or f"draft-{int(datetime.now().timestamp())}"),
        prescribedAt=payload.prescribed_at or datetime.now(),
        patientId=payload.patient_id,
        prescribedDrugs=drug_items,
    )

    pgx_response = build_prescription_response(legacy_req)

    return {
        "success": True,
        "prescription_id": db_prescription_id or legacy_req.prescription_id,
        "patient_id": payload.patient_id,
        "item_count": len(payload.items),
        **pgx_response,
    }
