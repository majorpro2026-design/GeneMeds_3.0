import sys
from app.database import engine
from sqlalchemy import text

sys.stdout.reconfigure(encoding='utf-8')

def inspect_alt():
    with engine.connect() as conn:
        print("=== ALTERNATES FOR codeine ===")
        rows = conn.execute(text("""
            SELECT alternate_id, gene_symbol, phenotype_name, risky_drug_generic, alternative_drug_generic, confidence_level, rationale
            FROM knowledge.recommendation_alternate
            WHERE lower(risky_drug_generic) = 'codeine'
            ORDER BY phenotype_name
        """)).mappings().all()
        for r in rows:
            print(dict(r))

        print("\n=== DPYD DIPLOTYPES IN knowledge.diplotype ===")
        dpyd_dips = conn.execute(text("""
            SELECT d.diplotype_name, pr.phenotype_name, pr.activity_score
            FROM knowledge.diplotype d
            JOIN knowledge.gene g ON g.gene_id = d.gene_id
            JOIN knowledge.phenotype_reference pr ON pr.phenotype_id = d.phenotype_id
            WHERE g.gene_symbol = 'DPYD'
            LIMIT 15
        """)).fetchall()
        for dd in dpyd_dips:
            print(dd)

        print("\n=== HLA-B IN knowledge.gene / diplotype / recommendation_logic ===")
        hlab_gene = conn.execute(text("SELECT * FROM knowledge.gene WHERE gene_symbol = 'HLA-B'")).mappings().first()
        print("HLA-B gene:", dict(hlab_gene) if hlab_gene else "Not in gene table")
        hlab_dips = conn.execute(text("""
            SELECT count(*) FROM knowledge.diplotype d
            JOIN knowledge.gene g ON g.gene_id = d.gene_id
            WHERE g.gene_symbol = 'HLA-B'
        """)).scalar()
        print("HLA-B diplotype count in knowledge.diplotype:", hlab_dips)
        hlab_recs = conn.execute(text("""
            SELECT rl.recommendation_id, d.generic_name, rl.lookup_key, rl.drug_recommendation
            FROM knowledge.recommendation_logic rl
            JOIN knowledge.drug d ON d.drug_id = rl.drug_id
            WHERE rl.lookup_key ? 'HLA-B'
        """)).mappings().all()
        print(f"HLA-B recommendation logic rules ({len(hlab_recs)} rules):")
        for hr in hlab_recs:
            print(dict(hr))

        print("\n=== WARFARIN IN recommendation_logic ===")
        warfarin_recs = conn.execute(text("""
            SELECT rl.recommendation_id, d.generic_name, rl.lookup_key, rl.drug_recommendation
            FROM knowledge.recommendation_logic rl
            JOIN knowledge.drug d ON d.drug_id = rl.drug_id
            WHERE d.generic_name = 'warfarin'
        """)).mappings().all()
        print(f"Warfarin rules count: {len(warfarin_recs)}")
        for wr in warfarin_recs[:5]:
            print(dict(wr))

if __name__ == "__main__":
    inspect_alt()
