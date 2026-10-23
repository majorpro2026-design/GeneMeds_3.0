from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.auth.user_dependencies import require_roles
from app.auth.user_schemas import UserResponse
from app.database import engine
from app.services.recommendation_lookup import get_full_recommendation


router = APIRouter(prefix="/api")


class DiplotypeItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    gene_symbol: str = Field(..., alias="geneSymbol")
    diplotype_name: str = Field(..., alias="diplotypeName")


class GeneRecommendationRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    drug_name: str = Field(..., alias="drugName")
    diplotypes: list[DiplotypeItem]
    patient_id: int | None = Field(None, alias="patientId")
    entered_by_doctor_id: int | None = Field(None, alias="enteredByDoctorId")  # ignored: the signed-in doctor is used
    persist: bool = False


def _doctor_may_save_for(patient_id: int, doctor_id: int) -> bool:
    try:
        with engine.connect() as conn:
            return conn.execute(
                text("SELECT 1 FROM core.visit WHERE patient_id = :p AND doctor_id = :d AND status = 'in_consultation' LIMIT 1"),
                {"p": patient_id, "d": doctor_id},
            ).first() is not None
    except SQLAlchemyError:
        return False


@router.post("/gene-recommendation")
def gene_recommendation(
    payload: GeneRecommendationRequest,
    doc: UserResponse = Depends(require_roles("doctor")),
) -> dict[str, Any]:
    if payload.persist:
        if payload.patient_id is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "patientId is required to save a result.")
        if not _doctor_may_save_for(payload.patient_id, doc.id):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only save results for a patient you are currently consulting.")

    diplotypes = [
        {"geneSymbol": item.gene_symbol, "diplotypeName": item.diplotype_name}
        for item in payload.diplotypes
    ]
    return get_full_recommendation(
        payload.drug_name,
        diplotypes,
        patient_id=payload.patient_id,
        entered_by_doctor_id=doc.id,
        persist=payload.persist,
    )