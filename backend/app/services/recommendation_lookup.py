from __future__ import annotations

import json
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import engine
from app.services.drug_lookup import lookup_drug_genes


def _format_activity_score(score: Decimal | None) -> str | None:
    if score is None:
        return None
    normalized = score.normalize()
    if "." not in str(normalized):
        return str(normalized) + ".0"
    return str(normalized)


def get_phenotype_for_diplotype(gene_symbol: str, diplotype_name: str) -> dict[str, Any] | None:
    query = text(
        """
        SELECT
            pr.phenotype_name,
            pr.activity_score,
            pr.description
        FROM knowledge.diplotype d
        JOIN knowledge.gene g ON g.gene_id = d.gene_id
        JOIN knowledge.phenotype_reference pr ON pr.phenotype_id = d.phenotype_id
        WHERE lower(btrim(g.gene_symbol)) = lower(btrim(:gene_symbol))
          AND lower(btrim(d.diplotype_name)) = lower(btrim(:diplotype_name))
        LIMIT 1
        """
    )

    try:
        with engine.connect() as connection:
            row = connection.execute(
                query,
                {"gene_symbol": gene_symbol, "diplotype_name": diplotype_name},
            ).mappings().first()
    except SQLAlchemyError:
        return None

    if row is None:
        return None

    return {
        "phenotypeName": row["phenotype_name"],
        "activityScore": _format_activity_score(row["activity_score"]),
        "description": row["description"],
    }


def get_recommendation(generic_name: str, phenotype_map: dict[str, str]) -> dict[str, Any] | None:
    """
    phenotype_map maps gene_symbol -> activity_score string (e.g. {"CYP2D6": "0.0"}).
    Uses JSONB @> containment to match lookup_key in recommendation_logic.
    """
    if not phenotype_map:
        return None

    lookup_json = json.dumps(phenotype_map)

    query = text(
        """
        SELECT
            rl.recommendation_id,
            rl.drug_recommendation,
            rl.implications,
            rl.comments,
            g.title AS guideline_title
        FROM knowledge.recommendation_logic rl
        JOIN knowledge.drug d ON d.drug_id = rl.drug_id
        JOIN knowledge.guideline g ON g.guideline_id = rl.guideline_id
        WHERE lower(btrim(d.generic_name)) = lower(btrim(:generic_name))
          AND rl.lookup_key @> CAST(:lookup_json AS jsonb)
        LIMIT 1
        """
    )

    try:
        with engine.connect() as connection:
            row = connection.execute(
                query,
                {"generic_name": generic_name, "lookup_json": lookup_json},
            ).mappings().first()
    except SQLAlchemyError:
        return None

    if row is None:
        return None

    return {
        "recommendationId": row["recommendation_id"],
        "drugRecommendation": row["drug_recommendation"],
        "implications": row["implications"],
        "comments": row["comments"],
        "guidelineTitle": row["guideline_title"],
    }


def save_gene_test_result(
    patient_id: int,
    gene_symbol: str,
    diplotype_name: str,
    entered_by_doctor_id: int,
    test_date: date | None = None,
    lab_name: str | None = None,
) -> int | None:
    lookup = text(
        """
        SELECT g.gene_id, d.diplotype_id, d.phenotype_id
        FROM knowledge.gene g
        JOIN knowledge.diplotype d ON d.gene_id = g.gene_id
        WHERE lower(btrim(g.gene_symbol)) = lower(btrim(:gene_symbol))
          AND lower(btrim(d.diplotype_name)) = lower(btrim(:diplotype_name))
        LIMIT 1
        """
    )

    insert = text(
        """
        INSERT INTO core.patient_gene_test_result
            (patient_id, gene_id, diplotype_id, phenotype_id, entered_by_doctor_id, test_date, lab_name)
        VALUES
            (:patient_id, :gene_id, :diplotype_id, :phenotype_id, :entered_by_doctor_id, :test_date, :lab_name)
        RETURNING result_id
        """
    )

    try:
        with engine.begin() as conn:
            row = conn.execute(
                lookup,
                {"gene_symbol": gene_symbol, "diplotype_name": diplotype_name},
            ).mappings().first()

            if row is None:
                return None

            result = conn.execute(
                insert,
                {
                    "patient_id": patient_id,
                    "gene_id": row["gene_id"],
                    "diplotype_id": row["diplotype_id"],
                    "phenotype_id": row["phenotype_id"],
                    "entered_by_doctor_id": entered_by_doctor_id,
                    "test_date": test_date,
                    "lab_name": lab_name,
                },
            ).mappings().first()

            return result["result_id"] if result else None
    except SQLAlchemyError:
        return None


def save_risk_assessment(
    patient_id: int,
    gene_test_result_id: int,
    recommendation_id: int,
    decision_notes: str | None = None,
) -> int | None:
    insert = text(
        """
        INSERT INTO history.patient_risk_assessment
            (patient_id, gene_test_result_id, recommendation_id, decision_notes)
        VALUES
            (:patient_id, :gene_test_result_id, :recommendation_id, :decision_notes)
        RETURNING assessment_id
        """
    )

    try:
        with engine.begin() as conn:
            result = conn.execute(
                insert,
                {
                    "patient_id": patient_id,
                    "gene_test_result_id": gene_test_result_id,
                    "recommendation_id": recommendation_id,
                    "decision_notes": decision_notes,
                },
            ).mappings().first()
            return result["assessment_id"] if result else None
    except SQLAlchemyError:
        return None


def _genes_with_diplotype_data(gene_symbols: list[str]) -> set[str]:
    if not gene_symbols:
        return set()
    query = text(
        """
        SELECT DISTINCT lower(btrim(g.gene_symbol)) AS gene_symbol
        FROM knowledge.gene g
        JOIN knowledge.diplotype d ON d.gene_id = g.gene_id
        WHERE lower(btrim(g.gene_symbol)) = ANY(CAST(:symbols AS text[]))
        """
    )
    try:
        with engine.connect() as connection:
            rows = connection.execute(
                query, {"symbols": [s.casefold() for s in gene_symbols]}
            ).mappings().all()
        return {row["gene_symbol"] for row in rows}
    except SQLAlchemyError:
        return set()


def get_full_recommendation(
    drug_name: str,
    diplotypes: list[dict[str, str]],
    patient_id: int | None = None,
    entered_by_doctor_id: int | None = None,
    persist: bool = False,
) -> dict[str, Any]:
    """
    Orchestrator for Module 2.

    diplotypes: list of {"geneSymbol": str, "diplotypeName": str}

    When persist=True and patient_id + entered_by_doctor_id are provided,
    saves gene test results and risk assessment to the database.
    """
    gene_rows = lookup_drug_genes([drug_name])

    if not gene_rows:
        return {"found": False, "reason": f"Unknown drug: {drug_name}"}

    generic_name: str = gene_rows[0]["generic_name"] or drug_name

    all_genes: list[str] = []
    for row in gene_rows:
        for symbol in row["gene_symbols"]:
            if symbol not in all_genes:
                all_genes.append(symbol)

    if not all_genes:
        return {
            "found": False,
            "reason": f"No CPIC gene-drug pair found for {generic_name}",
            "genericName": generic_name,
        }

    # Only keep genes that have diplotype rows — genes without diplotype data
    # can never be resolved and should not block the recommendation.
    genes_with_data = _genes_with_diplotype_data(all_genes)
    relevant_genes = [g for g in all_genes if g.casefold() in genes_with_data]

    if not relevant_genes:
        return {
            "found": False,
            "reason": f"No diplotype data available for any gene associated with {generic_name}",
            "genericName": generic_name,
        }

    relevant_set = {s.casefold() for s in relevant_genes}

    # Index provided diplotypes by gene symbol (casefold) for O(1) lookup
    provided: dict[str, str] = {}
    for item in diplotypes:
        gs = item.get("geneSymbol", "")
        if gs.casefold() in relevant_set:
            provided[gs.casefold()] = item.get("diplotypeName", "")

    phenotype_details: dict[str, Any] = {}
    phenotype_map: dict[str, str] = {}
    missing_gene_data: list[str] = []

    # Track canonical symbol for each casefold key
    casefold_to_symbol: dict[str, str] = {}
    for item in diplotypes:
        gs = item.get("geneSymbol", "")
        casefold_to_symbol[gs.casefold()] = gs

    for gene_symbol in relevant_genes:
        key = gene_symbol.casefold()

        if key not in provided:
            # No diplotype provided for this relevant gene
            missing_gene_data.append(gene_symbol)
            continue

        diplotype_name = provided[key]
        result = get_phenotype_for_diplotype(gene_symbol, diplotype_name)

        if result is None:
            # Diplotype provided but not found in DB
            missing_gene_data.append(gene_symbol)
            continue

        phenotype_details[gene_symbol] = result

        if result["activityScore"] is not None:
            phenotype_map[gene_symbol] = result["activityScore"]
        elif result["phenotypeName"] is not None:
            phenotype_map[gene_symbol] = result["phenotypeName"]
        else:
            missing_gene_data.append(gene_symbol)

    recommendation = get_recommendation(generic_name, phenotype_map) if phenotype_map else None

    saved_record_ids: dict[str, Any] = {}

    should_persist = (
        persist
        and patient_id is not None
        and entered_by_doctor_id is not None
        and recommendation is not None
    )

    if should_persist:
        recommendation_id: int = recommendation["recommendationId"]  # type: ignore[index]
        result_ids: list[int] = []

        for gene_symbol, diplotype_name in (
            (casefold_to_symbol.get(k, k), provided[k]) for k in provided
        ):
            rid = save_gene_test_result(
                patient_id=patient_id,
                gene_symbol=gene_symbol,
                diplotype_name=diplotype_name,
                entered_by_doctor_id=entered_by_doctor_id,
            )
            if rid is not None:
                result_ids.append(rid)

        if result_ids:
            assessment_id = save_risk_assessment(
                patient_id=patient_id,
                gene_test_result_id=result_ids[0],
                recommendation_id=recommendation_id,
            )
            saved_record_ids = {
                "resultIds": result_ids,
                "assessmentId": assessment_id,
            }

    response: dict[str, Any] = {
        "found": True,
        "genericName": generic_name,
        "relevantGenes": relevant_genes,
        "phenotypes": phenotype_details,
        "missingGeneData": missing_gene_data,
        "recommendation": recommendation,
    }

    if should_persist:
        response["savedRecordIds"] = saved_record_ids

    return response


if __name__ == "__main__":
    import pprint

    result = get_full_recommendation(
        "codeine",
        [{"geneSymbol": "CYP2D6", "diplotypeName": "*4/*4"}],
        patient_id=1,
        entered_by_doctor_id=1,
        persist=True,
    )
    pprint.pprint(result)
