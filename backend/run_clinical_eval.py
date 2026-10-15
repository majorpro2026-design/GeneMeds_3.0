import json
from app.services.recommendation_lookup import get_full_recommendation, get_phenotype_for_diplotype

test_cases = [
    {
        "case_id": "CASE-01",
        "drug": "atomoxetine",
        "diplotypes": [{"geneSymbol": "CYP2D6", "diplotypeName": "*4/*4"}],
        "expected_gene": "CYP2D6",
        "expected_phenotype": "Poor Metabolizer",
        "expected_activity_score": "0.0",
    },
    {
        "case_id": "CASE-02",
        "drug": "codeine",
        "diplotypes": [{"geneSymbol": "CYP2D6", "diplotypeName": "*4/*4"}],
        "expected_gene": "CYP2D6",
        "expected_phenotype": "Poor Metabolizer",
        "expected_activity_score": "0.0",
    },
    {
        "case_id": "CASE-03",
        "drug": "clopidogrel",
        "diplotypes": [{"geneSymbol": "CYP2C19", "diplotypeName": "*2/*2"}],
        "expected_gene": "CYP2C19",
        "expected_phenotype": "Poor Metabolizer",
    },
    {
        "case_id": "CASE-04",
        "drug": "abacavir",
        "diplotypes": [{"geneSymbol": "HLA-B", "diplotypeName": "*57:01 positive"}],
        "expected_gene": "HLA-B",
        "expected_phenotype": "*57:01 positive",
    },
    {
        "case_id": "CASE-05",
        "drug": "allopurinol",
        "diplotypes": [{"geneSymbol": "HLA-B", "diplotypeName": "*58:01 positive"}],
        "expected_gene": "HLA-B",
        "expected_phenotype": "*58:01 positive",
    },
    {
        "case_id": "CASE-06",
        "drug": "capecitabine",
        "diplotypes": [{"geneSymbol": "DPYD", "diplotypeName": "*2A/*2A"}],
        "expected_gene": "DPYD",
        "expected_phenotype": "Poor Metabolizer",
    },
    {
        "case_id": "CASE-07",
        "drug": "mercaptopurine",
        "diplotypes": [{"geneSymbol": "TPMT", "diplotypeName": "*3A/*3A"}],
        "expected_gene": "TPMT",
        "expected_phenotype": "Poor Metabolizer",
    },
    {
        "case_id": "CASE-08",
        "drug": "atorvastatin",
        "diplotypes": [{"geneSymbol": "SLCO1B1", "diplotypeName": "*5/*5"}],
        "expected_gene": "SLCO1B1",
        "expected_phenotype": "Poor Function",
    },
    {
        "case_id": "CASE-09",
        "drug": "atazanavir",
        "diplotypes": [{"geneSymbol": "UGT1A1", "diplotypeName": "*28/*28"}],
        "expected_gene": "UGT1A1",
        "expected_phenotype": "Poor Metabolizer",
    },
    {
        "case_id": "CASE-10",
        "drug": "warfarin",
        "diplotypes": [
            {"geneSymbol": "CYP2C9", "diplotypeName": "*3/*3"},
            {"geneSymbol": "VKORC1", "diplotypeName": "-1639G>A"}
        ],
    },
    {
        "case_id": "CASE-11-UNKNOWN-DRUG",
        "drug": "nonexistentmedication999",
        "diplotypes": [{"geneSymbol": "CYP2D6", "diplotypeName": "*4/*4"}],
    },
    {
        "case_id": "CASE-12-UNKNOWN-DIPLOTYPE",
        "drug": "codeine",
        "diplotypes": [{"geneSymbol": "CYP2D6", "diplotypeName": "*999/*999"}],
    },
    {
        "case_id": "CASE-13-MISSING-GENETIC-DATA",
        "drug": "codeine",
        "diplotypes": [],
    },
    {
        "case_id": "CASE-14-DRUG-NO-PGX-PAIR",
        "drug": "paracetamol",
        "diplotypes": [{"geneSymbol": "CYP2D6", "diplotypeName": "*1/*1"}],
    }
]

def run_cases():
    results = []
    for tc in test_cases:
        case_id = tc["case_id"]
        drug = tc["drug"]
        dips = tc["diplotypes"]
        try:
            res = get_full_recommendation(drug, dips)
            rec = res.get("recommendation")
            results.append({
                "case_id": case_id,
                "drug": drug,
                "input_dips": dips,
                "found": res.get("found"),
                "reason": res.get("reason"),
                "genericName": res.get("genericName"),
                "relevantGenes": res.get("relevantGenes"),
                "phenotypes": res.get("phenotypes"),
                "missingGeneData": res.get("missingGeneData"),
                "has_recommendation": rec is not None,
                "recommendation_preview": rec.get("drugRecommendation")[:100] if rec else None,
                "guidelineTitle": rec.get("guidelineTitle") if rec else None,
                "drugSafetyStatus": res.get("drugSafetyStatus"),
            })
        except Exception as e:
            results.append({
                "case_id": case_id,
                "drug": drug,
                "error": str(e)
            })

    with open("clinical_eval_results.json", "w") as f:
        json.dump(results, f, indent=2, default=str)
    print("Clinical evaluation finished. Evaluated", len(results), "cases.")

if __name__ == "__main__":
    run_cases()
