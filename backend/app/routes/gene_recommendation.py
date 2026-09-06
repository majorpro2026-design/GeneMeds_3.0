from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

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
    entered_by_doctor_id: int | None = Field(None, alias="enteredByDoctorId")
    persist: bool = False


@router.post("/gene-recommendation")
def gene_recommendation(payload: GeneRecommendationRequest) -> dict[str, Any]:
    diplotypes = [
        {"geneSymbol": item.gene_symbol, "diplotypeName": item.diplotype_name}
        for item in payload.diplotypes
    ]
    return get_full_recommendation(
        payload.drug_name,
        diplotypes,
        patient_id=payload.patient_id,
        entered_by_doctor_id=payload.entered_by_doctor_id,
        persist=payload.persist,
    )
