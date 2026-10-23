"""one open visit per patient

Revision ID: 0004_one_open_visit
Revises: 0003_clean_core
"""
from alembic import op

revision = "0004_one_open_visit"
down_revision = "0003_clean_core"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "CREATE UNIQUE INDEX uq_visit_one_open ON core.visit (patient_id) "
        "WHERE status IN ('waiting','in_consultation')"
    )


def downgrade() -> None:
    op.execute("DROP INDEX core.uq_visit_one_open")