from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_hcp
from app.auth.schemas import HCPResponse
from app.services.drug_lookup import PrescriptionCreateRequest, build_prescription_response


router = APIRouter(prefix="/api")


@router.post("/prescriptions")
def create_prescription(
	payload: PrescriptionCreateRequest,
	current_hcp: HCPResponse = Depends(get_current_hcp),
) -> dict[str, Any]:
	return build_prescription_response(payload)

