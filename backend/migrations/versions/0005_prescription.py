"""prescription items get a generic name; one prescription per visit

Revision ID: 0005_prescription
Revises: 0004_one_open_visit
"""
from alembic import op

revision = "0005_prescription"
down_revision = "0004_one_open_visit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF (SELECT count(*) FROM information_schema.columns
                WHERE table_schema='core'
                  AND ((table_name='patient_prescription' AND column_name='prescription_id')
                    OR (table_name='prescription_item' AND column_name='prescription_item_id'))
                  AND (column_default IS NOT NULL OR is_identity = 'YES')) < 2 THEN
                RAISE EXCEPTION 'prescription id columns have no default/identity; tell Claude';
            END IF;
        END $$
        """
    )
    op.execute("ALTER TABLE core.prescription_item ADD COLUMN generic_name text")
    op.execute("CREATE UNIQUE INDEX uq_prescription_visit ON core.patient_prescription (visit_id)")


def downgrade() -> None:
    op.execute("DROP INDEX core.uq_prescription_visit")
    op.execute("ALTER TABLE core.prescription_item DROP COLUMN generic_name")