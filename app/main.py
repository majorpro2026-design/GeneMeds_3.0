"""FastAPI entrypoint for the backend.

The lookup logic lives in app.routes.drug_lookup.
"""

from fastapi import FastAPI

from app.routes.drug_lookup import router as drug_lookup_router


app = FastAPI(title="Drug Gene Lookup API")

app.include_router(drug_lookup_router)


@app.get("/health")
def health_check() -> dict[str, str]:
	return {"status": "ok"}


