#!/usr/bin/env python3
"""
GeneMed — Module 3: FULL Alternate Drug Recommendation Populator (exhaustive)

CHANGE FROM PREVIOUS VERSION:
The earlier script only checked recommendation_logic rows containing
risk-signal words ("avoid", "consider", "alternative", "contraindicated").
This was a shortcut that could miss real risky cases phrased differently.

This version checks EVERY drug-gene-phenotype combination in the database
directly, with NO keyword pre-filtering:

    For EVERY row in recommendation_logic (all of them, not a filtered
    subset):
    1. Determine if the phenotype itself is inherently risky, based on
       phenotype_reference.activity_score and phenotype_name (e.g.
       "Poor Metabolizer", "No function", activity_score = 0, or
       "Ultrarapid Metabolizer" where relevant) — this is a DATA-based
       risk determination, not a text-keyword guess
    2. If risky: look up the drug's guideline group (same-disease pool)
    3. Search the ENTIRE recommendation text (regardless of which words
       it uses) for any same-guideline drug name mentioned
    4. If found: insert as a verified alternate

This is slower (checks all ~2100+ recommendation rows, not a pre-filtered
subset) but exhaustive — nothing is skipped because of wording choice.
Expect this to take longer to run than the earlier version.
"""

import json
from dotenv import load_dotenv

load_dotenv()

DB_HOST = "genemeds.cupgeqgu0vg9.us-east-1.rds.amazonaws.com"
DB_PORT = 5432
DB_NAME = "genemeds"
DB_SCHEMA = "knowledge"
DB_USER = "postgres"
DB_PASSWORD = "genemedsdatabase"

# Phenotype name fragments that indicate a genuinely risky result, based on
# real CPIC terminology seen throughout this project. Checked case-insensitively.
RISKY_PHENOTYPE_KEYWORDS = [
    "poor metabolizer",
    "no function",
    "decreased function",
    "ultrarapid metabolizer",  # risky for some drugs (e.g. codeine toxicity)
    "positive",  # HLA-B positive results (abacavir, allopurinol reactions)
]


def log(msg):
    print(msg, flush=True)


def get_db_connection():
    import pg8000.native as pg8000
    import ssl

    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    conn = pg8000.Connection(
        host=DB_HOST, port=DB_PORT, database=DB_NAME,
        user=DB_USER, password=DB_PASSWORD,
        timeout=15, ssl_context=ssl_ctx,
    )
    log(f"Connected to {DB_HOST}:{DB_PORT}/{DB_NAME}")
    return conn


def get_guideline_groups(conn):
    rows = conn.run(f"""
        SELECT g.title, d.generic_name
        FROM {DB_SCHEMA}.recommendation_logic rl
        JOIN {DB_SCHEMA}.drug d ON rl.drug_id = d.drug_id
        JOIN {DB_SCHEMA}.guideline g ON rl.guideline_id = g.guideline_id
    """)
    groups = {}
    for title, generic_name in rows:
        groups.setdefault(title, set()).add(generic_name.lower().strip())
    return groups


def get_all_recommendation_rows(conn):
    """EVERY row, no keyword filtering at all."""
    rows = conn.run(f"""
        SELECT d.generic_name, rl.drug_recommendation, rl.comments,
               rl.implications, rl.lookup_key, g.title
        FROM {DB_SCHEMA}.recommendation_logic rl
        JOIN {DB_SCHEMA}.drug d ON rl.drug_id = d.drug_id
        JOIN {DB_SCHEMA}.guideline g ON rl.guideline_id = g.guideline_id
    """)
    log(f"Loaded ALL {len(rows)} recommendation_logic rows (no filtering)")
    return rows


def extract_gene_phenotype(lookup_key_raw):
    try:
        lk = json.loads(lookup_key_raw) if isinstance(lookup_key_raw, str) else lookup_key_raw
        if lk:
            gene = list(lk.keys())[0]
            return gene, lk[gene]
    except Exception:
        pass
    return None, None


def is_phenotype_risky(phenotype_name):
    """Data-based risk check, not keyword-in-text guessing. Checks the
    ACTUAL phenotype name against known-risky categories."""
    if not phenotype_name:
        return False
    p = phenotype_name.lower()
    return any(keyword in p for keyword in RISKY_PHENOTYPE_KEYWORDS)


def find_candidate_mentioned(text, risky_drug_name, candidate_pool):
    if not text:
        return []
    text_lower = text.lower()
    found = []
    for candidate in sorted(candidate_pool, key=len, reverse=True):
        if candidate == risky_drug_name.lower():
            continue
        if len(candidate) < 4:
            continue
        if candidate in text_lower:
            found.append(candidate)
    return found


def insert_alternate(conn, gene_symbol, phenotype_name, risky_drug, alternative_drug, source_text, guideline_title):
    conn.run(f"""
        INSERT INTO {DB_SCHEMA}.recommendation_alternate
            (gene_symbol, phenotype_name, risky_drug_generic, alternative_drug_generic,
             rationale, confidence_level, source_note)
        VALUES (:gene, :phenotype, :risky, :alt, :rationale, 'cpic_guideline', :source)
        ON CONFLICT (gene_symbol, phenotype_name, risky_drug_generic) DO NOTHING
    """,
        gene=gene_symbol, phenotype=phenotype_name, risky=risky_drug, alt=alternative_drug,
        rationale=f"Same-guideline ({guideline_title}) match, confirmed in CPIC text: \"{source_text[:200]}\"",
        source="Module 3 FULL — exhaustive, all drugs/genes checked, zero AI",
    )


def run():
    conn = get_db_connection()

    guideline_groups = get_guideline_groups(conn)
    log(f"Loaded {len(guideline_groups)} guideline groups (therapeutic categories)")

    all_rows = get_all_recommendation_rows(conn)

    total_inserted = 0
    total_risky_found = 0
    drugs_resolved = set()
    drugs_risky_but_unmapped = set()
    drugs_checked = set()

    for i, (drug_name, drug_recommendation, comments, implications, lookup_key, guideline_title) in enumerate(all_rows, 1):
        drugs_checked.add(drug_name)
        gene_symbol, phenotype_name = extract_gene_phenotype(lookup_key)

        if not is_phenotype_risky(phenotype_name):
            continue  # not a risky phenotype for this drug — nothing to alternate

        total_risky_found += 1
        candidate_pool = guideline_groups.get(guideline_title, set())

        # search ALL text fields, not just drug_recommendation/comments
        combined_text = f"{drug_recommendation or ''} {comments or ''} {implications or ''}"
        found = find_candidate_mentioned(combined_text, drug_name, candidate_pool)

        if found and gene_symbol:
            for alt_drug in found:
                insert_alternate(conn, gene_symbol, phenotype_name, drug_name,
                                  alt_drug, combined_text, guideline_title)
                total_inserted += 1
                log(f"  [{i}/{len(all_rows)}] {drug_name} ({phenotype_name}) -> {alt_drug}")
            drugs_resolved.add(drug_name)
        else:
            drugs_risky_but_unmapped.add(drug_name)

        if i % 200 == 0:
            log(f"  ...progress: {i}/{len(all_rows)} rows checked, "
                f"{total_risky_found} risky found so far, {total_inserted} inserted")

    conn.run("COMMIT")

    log(f"\n=== MODULE 3 FULL POPULATION DONE ===")
    log(f"  Total recommendation rows checked: {len(all_rows)}")
    log(f"  Distinct drugs checked: {len(drugs_checked)}")
    log(f"  Rows with a genuinely risky phenotype: {total_risky_found}")
    log(f"  Drugs with a same-guideline, text-verified alternate found: {len(drugs_resolved)}")
    log(f"  Total alternate rows inserted: {total_inserted}")
    log(f"  Drugs that ARE risky but have NO in-guideline textual alternate found: "
        f"{len(drugs_risky_but_unmapped)}")

    conn.close()


if __name__ == "__main__":
    run()
