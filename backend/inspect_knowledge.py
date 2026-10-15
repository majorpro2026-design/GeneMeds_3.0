from app.database import engine
from sqlalchemy import text
import json

def inspect_knowledge():
    with engine.connect() as conn:
        for table in ["guideline", "gene", "drug", "gene_drug_pair", "drug_brand_generic", 
                      "phenotype_reference", "diplotype", "recommendation", "recommendation_logic", "recommendation_alternate"]:
            cols = conn.execute(text(f"""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'knowledge' AND table_name = '{table}'
                ORDER BY ordinal_position
            """)).fetchall()
            print(f"\n=== knowledge.{table} columns ===")
            for c in cols:
                print(f"  {c[0]} ({c[1]})")

            rows = conn.execute(text(f"SELECT * FROM knowledge.{table} LIMIT 3")).mappings().all()
            print(f"  Sample row: {dict(rows[0]) if rows else 'EMPTY'}")

if __name__ == "__main__":
    inspect_knowledge()
