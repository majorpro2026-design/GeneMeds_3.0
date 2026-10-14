import pytest
from sqlalchemy import text

class TestCyp2d6Performance:
    """Performance evaluation and query execution plan analysis for CYP2D6 *4/*4 lookup."""

    def test_verify_diplotype_row_counts_and_cyp2d6_cardinality(self, db_engine):
        with db_engine.connect() as conn:
            gene_id = conn.execute(text("SELECT gene_id FROM knowledge.gene WHERE gene_symbol = 'CYP2D6'")).scalar()
            assert gene_id is not None

            cyp2d6_count = conn.execute(
                text("SELECT count(*) FROM knowledge.diplotype WHERE gene_id = :gid"),
                {"gid": gene_id}
            ).scalar()
            total_count = conn.execute(text("SELECT count(*) FROM knowledge.diplotype")).scalar()

            # Confirm 14,402 rows for CYP2D6 out of 97,000 total diplotypes
            assert cyp2d6_count == 14402
            assert total_count == 97000

    def test_original_query_scans_14402_rows_due_to_function_wrapping(self, db_engine):
        """
        Confirms that lower(btrim(d.diplotype_name)) prevents using the compound index
        (gene_id, diplotype_name), falling back to idx_diplotype_gene and filtering 14,401 rows.
        """
        explain_sql = text("""
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
        with db_engine.connect() as conn:
            plan_json = conn.execute(explain_sql).scalar()
            plan_str = str(plan_json)

            # Check that 14401 rows are removed by filter
            assert "14401" in plan_str, "Expected 14,401 rows removed by filter during CYP2D6 scan"
            assert "idx_diplotype_gene" in plan_str

    def test_semantic_equivalence_of_optimized_query(self, db_engine):
        orig_sql = text("""
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
        opt_sql = text("""
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
        with db_engine.connect() as conn:
            orig_res = conn.execute(orig_sql).mappings().first()
            opt_res = conn.execute(opt_sql).mappings().first()
            assert orig_res is not None
            assert opt_res is not None
            assert orig_res["phenotype_name"] == opt_res["phenotype_name"]
            assert orig_res["activity_score"] == opt_res["activity_score"]

    def test_optimized_query_uses_unique_compound_index(self, db_engine):
        """
        Direct indexed lookup uses uq_diplotype on (gene_id, diplotype_name) directly,
        evaluating 1 row with 0 rows removed by filter.
        """
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
        with db_engine.connect() as conn:
            plan_json = conn.execute(explain_opt_sql).scalar()
            plan_str = str(plan_json)
            assert "uq_diplotype" in plan_str
            assert "Rows Removed by Index Recheck': 0" in plan_str or "Rows Removed by Filter" not in plan_str
