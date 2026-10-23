from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.auth.user_dependencies import require_roles
from app.auth.user_schemas import UserResponse
from app.services.drug_lookup import PrescriptionCreateRequest, build_prescription_response


router = APIRouter(prefix="/api")


@router.post("/prescriptions")
def create_prescription(
	payload: PrescriptionCreateRequest,
	user: UserResponse = Depends(require_roles("doctor")),
) -> dict[str, Any]:
	return build_prescription_response(payload)