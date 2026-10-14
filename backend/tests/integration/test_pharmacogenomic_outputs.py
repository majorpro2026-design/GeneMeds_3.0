import pytest
from app.services.recommendation_lookup import (
    get_phenotype_for_diplotype,
    get_recommendation,
    get_full_recommendation,
)
from app.services.alternate_lookup import get_alternate_drug

class TestPharmacogenomicOutputs:
    """Clinical output verification against CPIC reference guidelines and database rules."""

    def test_phenotype_resolution_cyp2d6_star4_star4(self):
        # CPIC standard: CYP2D6 *4 is no function (0.0). *4/*4 activity score = 0.0 -> Poor Metabolizer
        res = get_phenotype_for_diplotype("CYP2D6", "*4/*4")
        assert res is not None
        assert res["phenotypeName"] == "Poor Metabolizer"
        assert res["activityScore"] == "0.0"

    def test_phenotype_resolution_cyp2c19_star2_star2(self):
        # CPIC standard: CYP2C19 *2 is no function. *2/*2 -> Poor Metabolizer
        res = get_phenotype_for_diplotype("CYP2C19", "*2/*2")
        assert res is not None
        assert res["phenotypeName"] == "Poor Metabolizer"

    def test_phenotype_resolution_slco1b1_star5_star5(self):
        # CPIC standard: SLCO1B1 *5/*5 -> Poor Function
        res = get_phenotype_for_diplotype("SLCO1B1", "*5/*5")
        assert res is not None
        assert res["phenotypeName"] == "Poor Function"

    def test_phenotype_resolution_tpmt_star3a_star3a(self):
        # CPIC standard: TPMT *3A/*3A -> Poor Metabolizer
        res = get_phenotype_for_diplotype("TPMT", "*3A/*3A")
        assert res is not None
        assert res["phenotypeName"] == "Poor Metabolizer"

    def test_phenotype_resolution_unknown_diplotype(self):
        res = get_phenotype_for_diplotype("CYP2D6", "*999/*999")
        assert res is None

    def test_atomoxetine_cyp2d6_full_recommendation(self):
        res = get_full_recommendation("atomoxetine", [{"geneSymbol": "CYP2D6", "diplotypeName": "*4/*4"}])
        assert res["found"] is True
        assert res["genericName"] == "atomoxetine"
        assert "CYP2D6" in res["relevantGenes"]
        assert res["phenotypes"]["CYP2D6"]["phenotypeName"] == "Poor Metabolizer"
        assert res["phenotypes"]["CYP2D6"]["activityScore"] == "0.0"
        assert res["recommendation"] is not None
        assert "40 mg/day" in res["recommendation"]["drugRecommendation"]
        assert res["recommendation"]["guidelineTitle"] == "CYP2D6 and Atomoxetine"

    def test_codeine_cyp2d6_full_recommendation(self):
        res = get_full_recommendation("codeine", [{"geneSymbol": "CYP2D6", "diplotypeName": "*4/*4"}])
        assert res["found"] is True
        assert res["genericName"] == "codeine"
        assert res["recommendation"] is not None
        assert "Avoid codeine use" in res["recommendation"]["drugRecommendation"]

    def test_clopidogrel_cyp2c19_full_recommendation(self):
        res = get_full_recommendation("clopidogrel", [{"geneSymbol": "CYP2C19", "diplotypeName": "*2/*2"}])
        assert res["found"] is True
        assert res["genericName"] == "clopidogrel"
        assert res["recommendation"] is not None
        assert "Avoid clopidogrel" in res["recommendation"]["drugRecommendation"]

    def test_atazanavir_ugt1a1_full_recommendation(self):
        res = get_full_recommendation("atazanavir", [{"geneSymbol": "UGT1A1", "diplotypeName": "*28/*28"}])
        assert res["found"] is True
        assert res["genericName"] == "atazanavir"
        assert res["recommendation"] is not None
        assert "alternative agent" in res["recommendation"]["drugRecommendation"].lower()

    def test_unknown_drug_returns_not_found(self):
        res = get_full_recommendation("FakeMeds123", [{"geneSymbol": "CYP2D6", "diplotypeName": "*4/*4"}])
        assert res["found"] is False
        assert "Unknown drug" in res["reason"]

    def test_missing_genetic_data_reported_correctly(self):
        res = get_full_recommendation("codeine", [])
        assert res["found"] is True
        assert res["missingGeneData"] == ["CYP2D6"]
        assert res["recommendation"] is None

    def test_unsupported_diplotype_reported_as_missing(self):
        res = get_full_recommendation("codeine", [{"geneSymbol": "CYP2D6", "diplotypeName": "*999/*999"}])
        assert res["found"] is True
        assert "CYP2D6" in res["missingGeneData"]
        assert res["recommendation"] is None

    def test_defect_hlab_missing_diplotype_records_in_db(self):
        """
        Documented Defect: HLA-B alleles (*57:01, *58:01) exist in recommendation_logic
        but knowledge.diplotype has 0 rows for HLA-B. Consequently, _genes_with_diplotype_data
        filters out HLA-B and abacavir fails with 'No diplotype data available'.
        """
        res = get_full_recommendation("abacavir", [{"geneSymbol": "HLA-B", "diplotypeName": "*57:01 positive"}])
        assert res["found"] is False
        assert "No diplotype data available for any gene associated with abacavir" in res["reason"]

    def test_defect_codeine_safety_status_marked_not_risky_in_db(self):
        """
        Documented Defect: In recommendation_alternate table, CYP2D6 score 0.0 with codeine
        was populated with confidence_level = 'not_risky', contradicting the CPIC recommendation
        to 'Avoid codeine use'.
        """
        safety = get_alternate_drug("CYP2D6", "0.0", "codeine")
        # GeneMeds currently returns not_risky due to the database seed row
        assert safety["status"] == "not_risky"
