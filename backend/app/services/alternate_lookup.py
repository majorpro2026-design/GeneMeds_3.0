from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import engine


def get_alternate_drug(
    gene_symbol: str,
    phenotype_name: str,
    risky_drug_generic: str,
) -> dict[str, Any]:
    """
    Look up alternate drug status for a gene/phenotype/drug combination.

    phenotype_name should be the activity score string (e.g. "0.0") when
    available, falling back to the phenotype name string (e.g. "Poor Metabolizer").
    Both are stored in recommendation_alternate.phenotype_name.
    """
    query = text(
        """
        SELECT alternative_drug_generic, rationale, confidence_level, guideline_title
        FROM knowledge.recommendation_alternate
        WHERE lower(btrim(gene_symbol))       = lower(btrim(:gene))
          AND lower(btrim(phenotype_name))    = lower(btrim(:phenotype))
          AND lower(btrim(risky_drug_generic))= lower(btrim(:drug))
        LIMIT 1
        """
    )

    try:
        with engine.connect() as connection:
            row = connection.execute(
                query,
                {"gene": gene_symbol, "phenotype": phenotype_name, "drug": risky_drug_generic},
            ).mappings().first()
    except SQLAlchemyError:
        row = None

    if row is None:
        return {
            "status": "unknown",
            "alternativeDrugGeneric": None,
            "rationale": "No data available for this combination.",
            "confidenceLevel": None,
            "guidelineTitle": None,
            "requiresClinicianReview": False,
        }

    cl = row["confidence_level"]

    if cl == "cpic_guideline":
        return {
            "status": "alternate_found",
            "alternativeDrugGeneric": row["alternative_drug_generic"],
            "rationale": row["rationale"],
            "confidenceLevel": "cpic_guideline",
            "guidelineTitle": row["guideline_title"],
            "requiresClinicianReview": False,
        }

    if cl == "no_alternative_documented":
        return {
            "status": "no_alternative_documented",
            "alternativeDrugGeneric": None,
            "rationale": row["rationale"],
            "confidenceLevel": "no_alternative_documented",
            "guidelineTitle": row["guideline_title"],
            "requiresClinicianReview": False,
        }

    # not_risky
    return {
        "status": "not_risky",
        "alternativeDrugGeneric": None,
        "rationale": None,
        "confidenceLevel": "not_risky",
        "guidelineTitle": row["guideline_title"],
        "requiresClinicianReview": False,
    }
