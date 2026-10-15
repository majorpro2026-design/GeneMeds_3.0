import pytest
from app.services.drug_lookup import (
    lookup_drug_genes,
    lookup_catalog,
    lookup_gene_test_recommendations,
)
from app.routes.prescription_upload import _match_drugs

class TestDrugLookup:
    """Integration tests for drug normalization, brand-generic resolution, and gene-drug lookup."""

    def test_known_brand_lookup_resolves_to_generic(self):
        # Brand: Reyataz -> Generic: atazanavir -> Gene: UGT1A1
        results = lookup_drug_genes(["Reyataz"])
        assert len(results) > 0
        match = results[0]
        assert match["matched_as"] == "brand"
        assert match["brand_name"].lower() == "reyataz"
        assert match["generic_name"].lower() == "atazanavir"
        assert "UGT1A1" in match["gene_symbols"]

    def test_known_generic_lookup(self):
        # Generic: clopidogrel -> Gene: CYP2C19
        results = lookup_drug_genes(["clopidogrel"])
        assert len(results) > 0
        match = results[0]
        assert match["matched_as"] == "generic"
        assert match["generic_name"].lower() == "clopidogrel"
        assert "CYP2C19" in match["gene_symbols"]

    def test_case_and_whitespace_insensitivity(self):
        variations = ["   CLOPIDOGREL  ", "clopidogrel", "ClOpIdOgReL", "\tclopidogrel\n"]
        for var in variations:
            res = lookup_drug_genes([var])
            assert len(res) > 0
            assert res[0]["generic_name"].lower() == "clopidogrel"
            assert "CYP2C19" in res[0]["gene_symbols"]

    def test_unknown_drug_name(self):
        results = lookup_drug_genes(["NonExistentDrug9999XYZ"])
        assert results == []

    def test_empty_and_whitespace_inputs(self):
        assert lookup_drug_genes([]) == []
        assert lookup_drug_genes(["", "   ", "\t"]) == []

    def test_duplicate_names_deduplicated(self):
        results = lookup_drug_genes(["clopidogrel", "CLOPIDOGREL", "  clopidogrel  "])
        # Should only evaluate unique normalized term once
        assert len(results) == 1

    def test_multiple_distinct_drugs_lookup(self):
        results = lookup_drug_genes(["Reyataz", "clopidogrel", "atomoxetine"])
        input_names = {r["input_name"].lower() for r in results}
        assert "reyataz" in input_names
        assert "clopidogrel" in input_names
        assert "atomoxetine" in input_names

    def test_lookup_catalog_search(self):
        all_catalog = lookup_catalog()
        assert len(all_catalog) > 0

        # Query for 'Plavix'
        plavix_hits = lookup_catalog("Plavix")
        assert len(plavix_hits) > 0
        assert any("plavix" in hit["brandName"].lower() for hit in plavix_hits)

        # Query for non-existent drug
        fake_hits = lookup_catalog("ZZZZNonExistent12345")
        assert len(fake_hits) == 0

    def test_lookup_gene_test_recommendations_for_single_gene(self):
        recs = lookup_gene_test_recommendations(["CYP2D6"], generic_names=["codeine"])
        assert len(recs) > 0
        assert recs[0]["geneSymbol"] == "CYP2D6"
        assert recs[0]["drugName"].lower() == "codeine"

    def test_lookup_gene_test_recommendations_empty(self):
        assert lookup_gene_test_recommendations([]) == []
        assert lookup_gene_test_recommendations(["NonExistentGeneXYZ"]) == []

    def test_match_drugs_from_ocr_lines(self):
        synthetic_ocr_lines = [
            {"text": "Rx: Dr. John Doe Clinic", "confidence": 1.0},
            {"text": "Take Tab Plavix 75 mg daily", "confidence": 1.0},
            {"text": "Take Tab Atorvastatin 20 mg at bedtime", "confidence": 1.0},
            {"text": "Drink plenty of water", "confidence": 1.0},
        ]
        matched = _match_drugs(synthetic_ocr_lines)
        generic_names = [m["genericName"].lower() for m in matched]
        assert "clopidogrel" in generic_names or "atorvastatin" in generic_names
