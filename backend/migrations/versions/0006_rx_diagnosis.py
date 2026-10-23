"""optional diagnosis on a prescription

Revision ID: 0006_rx_diagnosis
Revises: 0005_prescription
"""
from alembic import op

revision = "0006_rx_diagnosis"
down_revision = "0005_prescription"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE core.patient_prescription ADD COLUMN diagnosis text")


def downgrade() -> None:
    op.execute("ALTER TABLE core.patient_prescription DROP COLUMN diagnosis")