from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_hcp
from app.auth.schemas import HCPResponse
from app.services.drug_lookup import DrugLookupRequest, lookup_drug_genes


router = APIRouter(prefix="/api")


@router.post("/drug-gene-lookup")
def drug_gene_lookup(
	payload: DrugLookupRequest,
	current_hcp: HCPResponse = Depends(get_current_hcp),
) -> dict[str, list[dict[str, Any]]]:

	return {"results": lookup_drug_genes(payload.drug_names)}


