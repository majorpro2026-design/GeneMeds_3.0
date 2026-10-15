from app.database import engine
from sqlalchemy import text
import time
import statistics

def benchmark():
    with engine.connect() as conn:
        print("=== QUERY 1: ORIGINAL (with lower(btrim(...))) ===")
        explain_orig_sql = text("""
            EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT
                pr.phenotype_name,
                pr.activity_score,
                pr.description
            FROM knowledge.diplotype d
            JOIN knowledge.gene g ON g.gene_id = d.gene_id
            JOIN knowledge.phenotype_reference pr ON pr.phenotype_id = d.phenotype_id
            WHERE lower(btrim(g.gene_symbol)) = lower(btrim('CYP2D6'))
              AND lower(btrim(d.diplotype_name)) = lower(btrim('*4/*4'))
            LIMIT 1
        """)
        plan_orig = conn.execute(explain_orig_sql).scalar()
        import json
        print(json.dumps(plan_orig, indent=2))

        # Check total rows in diplotype for gene CYP2D6
        gene_id = conn.execute(text("SELECT gene_id FROM knowledge.gene WHERE gene_symbol = 'CYP2D6'")).scalar()
        cyp2d6_dip_count = conn.execute(text("SELECT count(*) FROM knowledge.diplotype WHERE gene_id = :gid"), {"gid": gene_id}).scalar()
        total_dip_count = conn.execute(text("SELECT count(*) FROM knowledge.diplotype")).scalar()
        print(f"\nGene ID for CYP2D6: {gene_id}")
        print(f"Diplotype rows for CYP2D6: {cyp2d6_dip_count}")
        print(f"Total diplotype rows: {total_dip_count}")

        # Measure 50 runs of original query
        orig_times = []
        for _ in range(50):
            t0 = time.perf_counter()
            conn.execute(text("""
                SELECT
                    pr.phenotype_name,
                    pr.activity_score,
                    pr.description
                FROM knowledge.diplotype d
                JOIN knowledge.gene g ON g.gene_id = d.gene_id
                JOIN knowledge.phenotype_reference pr ON pr.phenotype_id = d.phenotype_id
                WHERE lower(btrim(g.gene_symbol)) = lower(btrim('CYP2D6'))
                  AND lower(btrim(d.diplotype_name)) = lower(btrim('*4/*4'))
                LIMIT 1
            """)).fetchall()
            t1 = time.perf_counter()
            orig_times.append((t1 - t0) * 1000)

        print(f"\nOriginal Query Latency (50 runs):")
        print(f"  Min: {min(orig_times):.3f} ms")
        print(f"  Median: {statistics.median(orig_times):.3f} ms")
        print(f"  Mean: {statistics.mean(orig_times):.3f} ms")
        p95_orig = sorted(orig_times)[int(len(orig_times) * 0.95)]
        print(f"  p95: {p95_orig:.3f} ms")
        print(f"  Max: {max(orig_times):.3f} ms")

        print("\n=== QUERY 2: DIRECT MATCH (d.gene_id = :gid AND d.diplotype_name = :dip) ===")
        explain_opt_sql = text("""
            EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT
                pr.phenotype_name,
                pr.activity_score,
                pr.description
            FROM knowledge.diplotype d
            JOIN knowledge.gene g ON g.gene_id = d.gene_id
            JOIN knowledge.phenotype_reference pr ON pr.phenotype_id = d.phenotype_id
            WHERE g.gene_symbol = 'CYP2D6'
              AND d.diplotype_name = '*4/*4'
            LIMIT 1
        """)
        plan_opt = conn.execute(explain_opt_sql).scalar()
        print(json.dumps(plan_opt, indent=2))

        # Measure 50 runs of direct query
        opt_times = []
        for _ in range(50):
            t0 = time.perf_counter()
            conn.execute(text("""
                SELECT
                    pr.phenotype_name,
                    pr.activity_score,
                    pr.description
                FROM knowledge.diplotype d
                JOIN knowledge.gene g ON g.gene_id = d.gene_id
                JOIN knowledge.phenotype_reference pr ON pr.phenotype_id = d.phenotype_id
                WHERE g.gene_symbol = 'CYP2D6'
                  AND d.diplotype_name = '*4/*4'
                LIMIT 1
            """)).fetchall()
            t1 = time.perf_counter()
            opt_times.append((t1 - t0) * 1000)

        print(f"\nDirect Indexed Query Latency (50 runs):")
        print(f"  Min: {min(opt_times):.3f} ms")
        print(f"  Median: {statistics.median(opt_times):.3f} ms")
        print(f"  Mean: {statistics.mean(opt_times):.3f} ms")
        p95_opt = sorted(opt_times)[int(len(opt_times) * 0.95)]
        print(f"  p95: {p95_opt:.3f} ms")
        print(f"  Max: {max(opt_times):.3f} ms")

if __name__ == "__main__":
    benchmark()
