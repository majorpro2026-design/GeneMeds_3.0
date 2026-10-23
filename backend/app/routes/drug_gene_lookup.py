from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.auth.user_dependencies import require_roles
from app.auth.user_schemas import UserResponse
from app.services.drug_lookup import DrugLookupRequest, lookup_drug_genes


router = APIRouter(prefix="/api")


@router.post("/drug-gene-lookup")
def drug_gene_lookup(
	payload: DrugLookupRequest,
	user: UserResponse = Depends(require_roles("doctor")),
) -> dict[str, list[dict[str, Any]]]:
	return {"results": lookup_drug_genes(payload.drug_names)}