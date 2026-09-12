#!/usr/bin/env python3
"""
GeneMed — Module 3 FINAL: Complete Alternate Drug Recommendation Table Builder
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

RISKY_PHENOTYPE_KEYWORDS = [
    "poor metabolizer",
    "no function",
    "decreased function",
    "ultrarapid metabolizer",
    "positive",
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
        timeout=60, ssl_context=ssl_ctx,
    )
    log(f"Connected to {DB_HOST}:{DB_PORT}/{DB_NAME}")
    return conn


def apply_schema_fixes(conn):
    conn.run(f"""
        ALTER TABLE {DB_SCHEMA}.recommendation_alternate
        DROP CONSTRAINT IF EXISTS recommendation_alternate_confidence_level_check
    """)
    conn.run(f"""
        ALTER TABLE {DB_SCHEMA}.recommendation_alternate
        ADD CONSTRAINT recommendation_alternate_confidence_level_check
        CHECK (confidence_level IN ('cpic_guideline', 'clinical_common',
                                     'no_alternative_documented', 'not_risky'))
    """)
    conn.run(f"""
        ALTER TABLE {DB_SCHEMA}.recommendation_alternate
        ALTER COLUMN alternative_drug_generic DROP NOT NULL
    """)
    conn.run(f"""
        ALTER TABLE {DB_SCHEMA}.recommendation_alternate
        ALTER COLUMN gene_symbol DROP NOT NULL
    """)
    conn.run(f"""
        ALTER TABLE {DB_SCHEMA}.recommendation_alternate
        ALTER COLUMN phenotype_name DROP NOT NULL
    """)
    conn.run(f"""
        ALTER TABLE {DB_SCHEMA}.recommendation_alternate
        ADD COLUMN IF NOT EXISTS guideline_title VARCHAR(300)
    """)
    conn.run("COMMIT")
    log("Schema fixes applied")


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
    rows = conn.run(f"""
        SELECT d.generic_name, rl.drug_recommendation, rl.comments,
               rl.implications, rl.lookup_key, g.title
        FROM {DB_SCHEMA}.recommendation_logic rl
        JOIN {DB_SCHEMA}.drug d ON rl.drug_id = d.drug_id
        JOIN {DB_SCHEMA}.guideline g ON rl.guideline_id = g.guideline_id
    """)
    log(f"Loaded ALL {len(rows)} recommendation_logic rows")
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


def insert_row(conn, gene_symbol, phenotype_name, risky_drug, alternative_drug,
                rationale, confidence_level, source_note, guideline_title):
    conn.run(f"""
        INSERT INTO {DB_SCHEMA}.recommendation_alternate
            (gene_symbol, phenotype_name, risky_drug_generic, alternative_drug_generic,
             rationale, confidence_level, source_note, guideline_title)
        VALUES (:gene, :phenotype, :risky, :alt, :rationale, :conf, :source, :guideline)
        ON CONFLICT (gene_symbol, phenotype_name, risky_drug_generic) DO NOTHING
    """,
        gene=gene_symbol, phenotype=phenotype_name, risky=risky_drug, alt=alternative_drug,
        rationale=rationale, conf=confidence_level, source=source_note, guideline=guideline_title,
    )


def run():
    conn = get_db_connection()
    apply_schema_fixes(conn)

    guideline_groups = get_guideline_groups(conn)
    log(f"Loaded {len(guideline_groups)} guideline groups")

    all_rows = get_all_recommendation_rows(conn)

    counts = {"not_risky": 0, "alternate_found": 0, "no_alternative": 0}

    for i, (drug_name, drug_recommendation, comments, implications, lookup_key, guideline_title) in enumerate(all_rows, 1):
        gene_symbol, phenotype_name = extract_gene_phenotype(lookup_key)

        if not is_phenotype_risky(phenotype_name):
            insert_row(
                conn, gene_symbol, phenotype_name, drug_name, None,
                "This phenotype is not considered high-risk for this drug per CPIC data.",
                "not_risky",
                "Module 3 FINAL - full drug coverage, zero AI",
                guideline_title,
            )
            counts["not_risky"] += 1
            continue

        candidate_pool = guideline_groups.get(guideline_title, set())
        combined_text = f"{drug_recommendation or ''} {comments or ''} {implications or ''}"
        found = find_candidate_mentioned(combined_text, drug_name, candidate_pool)

        if found:
            for alt_drug in found:
                insert_row(
                    conn, gene_symbol, phenotype_name, drug_name, alt_drug,
                    f"Same-guideline ({guideline_title}) match, confirmed in CPIC text: \"{combined_text[:200]}\"",
                    "cpic_guideline",
                    "Module 3 FINAL - full drug coverage, zero AI",
                    guideline_title,
                )
            counts["alternate_found"] += 1
        else:
            insert_row(
                conn, gene_symbol, phenotype_name, drug_name, None,
                "Confirmed risky per CPIC phenotype data, but CPIC does not name a specific alternate drug for this combination.",
                "no_alternative_documented",
                "Module 3 FINAL - full drug coverage, zero AI",
                guideline_title,
            )
            counts["no_alternative"] += 1

        if i % 50 == 0:
            conn.run("COMMIT")
            log(f"  ...progress: {i}/{len(all_rows)} rows processed")

    conn.run("COMMIT")

    log(f"\n=== MODULE 3 FINAL COMPLETE ===")
    log(f"  Total rows processed: {len(all_rows)}")
    log(f"  Not risky (safe): {counts['not_risky']}")
    log(f"  Risky, alternate found: {counts['alternate_found']}")
    log(f"  Risky, no alternate documented: {counts['no_alternative']}")

    conn.close()


if __name__ == "__main__":
    run()