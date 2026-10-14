from app.database import engine
from sqlalchemy import text
import json

def inspect_recs():
    with engine.connect() as conn:
        recs = conn.execute(text("""
            SELECT d.generic_name, count(*) as count
            FROM knowledge.recommendation_logic rl
            JOIN knowledge.drug d ON d.drug_id = rl.drug_id
            GROUP BY d.generic_name
            ORDER BY d.generic_name
        """)).fetchall()
        print(f"Total drugs with recommendation logic: {len(recs)}")
        for r in recs[:30]:
            sample_keys = conn.execute(text("""
                SELECT rl.lookup_key 
                FROM knowledge.recommendation_logic rl
                JOIN knowledge.drug d ON d.drug_id = rl.drug_id
                WHERE d.generic_name = :drug
                LIMIT 3
            """), {"drug": r[0]}).fetchall()
            keys_preview = [sk[0] for sk in sample_keys]
            print(f"- {r[0]} ({r[1]} rules): e.g. {keys_preview}")

if __name__ == "__main__":
    inspect_recs()
