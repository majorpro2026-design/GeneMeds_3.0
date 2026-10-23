from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query

from app.auth.user_dependencies import require_roles
from app.auth.user_schemas import UserResponse
from app.services.drug_lookup import lookup_catalog


router = APIRouter(prefix="/api")


@router.get("/drugs")
def get_drugs(
	q: str | None = Query(default=None, max_length=100, description="Optional search term"),
	limit: int = Query(default=15, ge=1, le=50),
	user: UserResponse = Depends(require_roles("doctor")),
) -> dict[str, list[dict[str, Any]]]:
	return {"data": lookup_catalog(q)[:limit]}