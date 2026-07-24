from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query

from app.services.drug_lookup import lookup_catalog


router = APIRouter(prefix="/api")


@router.get("/drugs")
def get_drugs(q: str | None = Query(default=None, description="Optional search term")) -> dict[str, list[dict[str, Any]]]:
	return {"data": lookup_catalog(q)}
