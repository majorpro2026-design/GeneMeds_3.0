"""FastAPI entrypoint for the backend."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.drugs import router as drugs_router
from app.routes.drug_gene_lookup import router as drug_gene_lookup_router
from app.routes.gene_recommendation import router as gene_recommendation_router
from app.routes.prescription_upload import router as prescription_upload_router
from app.routes.prescriptions import router as prescriptions_router


def _parse_cors_origins() -> list[str]:
	raw_origins = os.getenv(
		"CORS_ORIGINS",
		"http://localhost:5173,http://127.0.0.1:5173",
	)
	return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


app = FastAPI(title="Drug Gene Lookup API")

app.add_middleware(
	CORSMiddleware,
	allow_origins=_parse_cors_origins(),
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

app.include_router(drugs_router)
app.include_router(drug_gene_lookup_router)
app.include_router(gene_recommendation_router)
app.include_router(prescription_upload_router)
app.include_router(prescriptions_router)


@app.get("/health")
def health_check() -> dict[str, str]:
	return {"status": "ok"}




