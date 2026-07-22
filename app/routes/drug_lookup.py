from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.database import engine


router = APIRouter(prefix="")


class DrugLookupRequest(BaseModel):
	drug_names: list[str] = Field(..., min_length=1, description="List of brand or generic drug names")


def lookup_drug_genes(drug_names: list[str]) -> list[dict[str, object]]:
	query = text(
		"""
		WITH input_drugs AS (
			SELECT DISTINCT unnest(CAST(:drug_names AS text[])) AS input_name
		), brand_matches AS (
			SELECT
				i.input_name,
				'brand' AS matched_as,
				dbg.brand_name,
				dbg.generic_name
			FROM input_drugs i
			JOIN knowledge.drug_brand_generic dbg
				ON lower(dbg.brand_name) = lower(i.input_name)
		), generic_matches AS (
			SELECT
				i.input_name,
				'generic' AS matched_as,
				dbg.brand_name,
				dbg.generic_name
			FROM input_drugs i
			JOIN knowledge.drug_brand_generic dbg
				ON lower(dbg.generic_name) = lower(i.input_name)
		), resolved_drugs AS (
			SELECT * FROM brand_matches
			UNION
			SELECT * FROM generic_matches
		)
		SELECT
			input_name,
			matched_as,
			brand_name,
			generic_name,
			COALESCE(
				array_agg(DISTINCT gene_symbol ORDER BY gene_symbol) FILTER (WHERE gene_symbol IS NOT NULL),
				ARRAY[]::text[]
			) AS gene_symbols
		FROM resolved_drugs
		LEFT JOIN knowledge.gene_drug_pair gdp
			ON lower(gdp.drug_name) = lower(resolved_drugs.generic_name)
		GROUP BY input_name, matched_as, brand_name, generic_name
		ORDER BY input_name, matched_as, brand_name, generic_name
		"""
	)

	with engine.connect() as connection:
		rows = connection.execute(query, {"drug_names": drug_names}).mappings().all()

	return [
		{
			"input_name": row["input_name"],
			"matched_as": row["matched_as"],
			"brand_name": row["brand_name"],
			"generic_name": row["generic_name"],
			"gene_symbols": row["gene_symbols"] or [],
		}
		for row in rows
	]


@router.post("/drug-gene-lookup")
def drug_gene_lookup(payload: DrugLookupRequest) -> dict[str, list[dict[str, object]]]:
	return {"results": lookup_drug_genes(payload.drug_names)}