from __future__ import annotations

from datetime import datetime
from functools import lru_cache
from typing import Any, Iterable

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import engine


class DrugLookupRequest(BaseModel):
	drug_names: list[str] = Field(..., min_length=1, description="List of brand or generic drug names")


class PrescriptionDrugItem(BaseModel):
	model_config = ConfigDict(populate_by_name=True)

	drug_id: str | int | None = Field(default=None, alias="drugId")
	drug_name: str | None = Field(default=None, alias="drugName")
	brand_name: str | None = Field(default=None, alias="brandName")
	strength: str | None = None
	generics: list[str] = Field(default_factory=list)
	generic_name: str | None = Field(default=None, alias="genericName")
	generic_names: list[str] = Field(default_factory=list, alias="genericNames")
	selected_generic: str | None = Field(default=None, alias="selectedGeneric")
	dosage: str | None = None
	frequency: str | None = None
	duration_days: int | None = Field(default=None, alias="durationDays", ge=0)
	note: str | None = None


class PrescriptionCreateRequest(BaseModel):
	model_config = ConfigDict(populate_by_name=True)

	prescription_id: str = Field(..., alias="prescriptionId")
	prescribed_at: datetime = Field(..., alias="prescribedAt")
	prescribed_drugs: list[PrescriptionDrugItem] = Field(..., min_length=1, alias="prescribedDrugs")


def _clean_strings(values: Iterable[str | None]) -> list[str]:
	cleaned: list[str] = []
	seen: set[str] = set()

	for value in values:
		if value is None:
			continue

		normalized = value.strip()
		if not normalized:
			continue

		key = normalized.casefold()
		if key in seen:
			continue

		seen.add(key)
		cleaned.append(normalized)

	return cleaned


def _extract_drug_terms(item: PrescriptionDrugItem | dict[str, Any]) -> list[str]:
	if isinstance(item, PrescriptionDrugItem):
		return _clean_strings(
			[
				item.drug_name,
				item.brand_name,
				item.selected_generic,
				item.generic_name,
				*item.generics,
				*item.generic_names,
			]
		)

	return _clean_strings(
		[
			item.get("drugName"),
			item.get("brandName"),
			item.get("selectedGeneric"),
			item.get("genericName"),
			*(item.get("generics") or []),
			*(item.get("genericNames") or []),
		]
	)


def _make_lookup_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
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


def lookup_drug_genes(drug_names: list[str]) -> list[dict[str, Any]]:
	cleaned_names = _clean_strings(drug_names)
	if not cleaned_names:
		return []

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
				ON lower(btrim(dbg.brand_name)) = lower(btrim(i.input_name))
		), generic_matches AS (
			SELECT
				i.input_name,
				'generic' AS matched_as,
				dbg.brand_name,
				dbg.generic_name
			FROM input_drugs i
			JOIN knowledge.drug_brand_generic dbg
				ON lower(btrim(dbg.generic_name)) = lower(btrim(i.input_name))
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
			ON lower(btrim(gdp.drug_name)) = lower(btrim(resolved_drugs.generic_name))
		GROUP BY input_name, matched_as, brand_name, generic_name
		ORDER BY input_name, matched_as, brand_name, generic_name
		"""
	)

	try:
		with engine.connect() as connection:
			rows = connection.execute(query, {"drug_names": cleaned_names}).mappings().all()
	except SQLAlchemyError:
		return []

	return _make_lookup_rows([dict(row) for row in rows])


def _resolve_terms_from_prescription(payload: PrescriptionCreateRequest) -> list[str]:
	return _clean_strings(
		term
		for drug in payload.prescribed_drugs
		for term in _extract_drug_terms(drug)
	)


def _attach_gene_matches(
	prescribed_drug: PrescriptionDrugItem,
	lookup_rows: list[dict[str, Any]],
) -> dict[str, Any]:
	terms = _extract_drug_terms(prescribed_drug)
	matches = [row for row in lookup_rows if row["input_name"] in terms]

	gene_symbols: list[str] = []
	for match in matches:
		for symbol in match["gene_symbols"]:
			if symbol not in gene_symbols:
				gene_symbols.append(symbol)

	return {
		**prescribed_drug.model_dump(by_alias=True),
		"lookupTerms": terms,
		"matchedDrugs": matches,
		"geneSymbols": gene_symbols,
	}


def _collect_gene_symbols(resolved_drugs: list[dict[str, Any]]) -> list[str]:
	gene_symbols: list[str] = []
	for drug in resolved_drugs:
		for symbol in drug.get("geneSymbols", []):
			if symbol not in gene_symbols:
				gene_symbols.append(symbol)
	return gene_symbols


def lookup_gene_test_recommendations(
	gene_symbols: list[str],
	generic_names: list[str] | None = None,
) -> list[dict[str, Any]]:
	cleaned_symbols = _clean_strings(gene_symbols)
	if not cleaned_symbols:
		return []

	cleaned_generics = _clean_strings(generic_names or [])

	# When we know which drugs were prescribed, filter gene_drug_pair rows to only
	# those whose drug_name matches a prescribed generic — this prevents a gene shared
	# by many drugs (e.g. CYP2D6) from returning an arbitrary unrelated drug's row.
	if cleaned_generics:
		query = text(
			"""
			SELECT DISTINCT ON (lower(btrim(gene_symbol)), lower(btrim(drug_name)))
				gene_symbol,
				drug_name,
				guideline_name,
				guideline_url,
				cpic_level,
				clinpgx_level,
				provisional
			FROM knowledge.gene_drug_pair
			WHERE gene_symbol = ANY(CAST(:gene_symbols AS text[]))
			  AND lower(btrim(drug_name)) = ANY(
			        SELECT lower(btrim(unnest(CAST(:generic_names AS text[]))))
			      )
			ORDER BY
				lower(btrim(gene_symbol)),
				lower(btrim(drug_name)),
				CASE
					WHEN guideline_name IS NOT NULL AND btrim(guideline_name) <> '' THEN 0
					ELSE 1
				END,
				lower(btrim(COALESCE(guideline_name, drug_name)))
			"""
		)
		params: dict[str, Any] = {
			"gene_symbols": cleaned_symbols,
			"generic_names": cleaned_generics,
		}
	else:
		query = text(
			"""
			SELECT DISTINCT ON (lower(btrim(gene_symbol)))
				gene_symbol,
				drug_name,
				guideline_name,
				guideline_url,
				cpic_level,
				clinpgx_level,
				provisional
			FROM knowledge.gene_drug_pair
			WHERE gene_symbol = ANY(CAST(:gene_symbols AS text[]))
			ORDER BY
				lower(btrim(gene_symbol)),
				CASE
					WHEN guideline_name IS NOT NULL AND btrim(guideline_name) <> '' THEN 0
					ELSE 1
				END,
				lower(btrim(COALESCE(guideline_name, drug_name)))
			"""
		)
		params = {"gene_symbols": cleaned_symbols}

	try:
		with engine.connect() as connection:
			rows = connection.execute(query, params).mappings().all()
	except SQLAlchemyError:
		return []

	recommendations: list[dict[str, Any]] = []
	for row in rows:
		gene_symbol = (row["gene_symbol"] or "").strip()
		guideline_name = (row["guideline_name"] or "").strip()
		drug_name = (row["drug_name"] or "").strip()

		title = guideline_name or (f"{gene_symbol} testing" if gene_symbol else "Gene testing")
		details = drug_name or gene_symbol or "Selected gene"
		description = f"Recommended gene test for {details}."

		recommendations.append(
			{
				"title": title,
				"description": description,
				"geneSymbol": gene_symbol,
				"drugName": drug_name,
				"guidelineName": guideline_name or None,
				"guidelineUrl": row["guideline_url"],
				"cpicLevel": row["cpic_level"],
				"clinpgxLevel": row["clinpgx_level"],
				"provisional": bool(row["provisional"]),
			}
		)

	return recommendations


def lookup_catalog(query: str | None = None) -> list[dict[str, Any]]:
	search = (query or "").strip().casefold()
	catalog = list(_load_catalog())
	if not search:
		return catalog

	matches: list[tuple[int, str, str, dict[str, Any]]] = []
	for row in catalog:
		names = [
			str(row["drugName"]),
			str(row["brandName"]),
			str(row["genericName"]),
			*(str(value) for value in row["generics"]),
		]
		lowered = [value.casefold() for value in names if value]
		if not any(search in value for value in lowered):
			continue

		rank = 0 if any(value.startswith(search) for value in lowered) else 1
		matches.append((rank, str(row["drugName"]).casefold(), str(row["genericName"]).casefold(), row))

	matches.sort(key=lambda entry: (entry[0], entry[1], entry[2]))
	return [row for _, _, _, row in matches]


@lru_cache(maxsize=1)
def _load_catalog() -> tuple[dict[str, Any], ...]:
	sql = text(
		"""
		SELECT
			md5(lower(btrim(brand_name))) AS drug_id,
			brand_name AS drug_name,
			brand_name AS brand_name,
			array_agg(generic_name ORDER BY generic_name) AS generics
		FROM knowledge.drug_brand_generic
		WHERE brand_name IS NOT NULL
		  AND generic_name IS NOT NULL
		GROUP BY brand_name
		ORDER BY lower(brand_name)
		"""
	)

	try:
		with engine.connect() as connection:
			rows = connection.execute(sql).mappings().all()
	except SQLAlchemyError:
		return tuple()

	return tuple(
		{
			"drugId": row["drug_id"],
			"drugName": row["drug_name"],
			"brandName": row["brand_name"],
			"genericName": row["generics"][0] if row["generics"] else None,
			"generics": row["generics"] or [],
			"strength": None,
			"sourceName": "knowledge.drug_brand_generic",
		}
		for row in rows
	)


def build_prescription_response(payload: PrescriptionCreateRequest) -> dict[str, Any]:
	search_terms = _resolve_terms_from_prescription(payload)
	lookup_rows = lookup_drug_genes(search_terms)
	resolved_drugs = [
		_attach_gene_matches(drug, lookup_rows)
		for drug in payload.prescribed_drugs
	]
	gene_symbols = _collect_gene_symbols(resolved_drugs)
	generic_names = _clean_strings(
		row["generic_name"] for row in lookup_rows if row.get("generic_name")
	)
	suggested_tests = lookup_gene_test_recommendations(gene_symbols, generic_names)

	return {
		"id": payload.prescription_id,
		"status": "saved",
		"message": "Prescription payload accepted",
		"prescriptionId": payload.prescription_id,
		"prescribedAt": payload.prescribed_at.isoformat(),
		"geneSymbols": gene_symbols,
		"suggestedTests": suggested_tests,
		"resolvedDrugs": resolved_drugs,
	}