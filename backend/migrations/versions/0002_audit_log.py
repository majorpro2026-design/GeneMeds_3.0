"""audit log (append-only)

Revision ID: 0002_audit_log
Revises: 0001_user_accounts
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002_audit_log"
down_revision = "0001_user_accounts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        # No foreign keys on purpose: audit rows must outlive the accounts they describe.
        sa.Column("actor_user_id", sa.BigInteger(), nullable=True),
        sa.Column("actor_role", sa.Text(), nullable=True),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("target_type", sa.Text(), nullable=True),
        sa.Column("target_id", sa.BigInteger(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("details", postgresql.JSONB(), nullable=True),
        schema="core",
    )
    op.execute("CREATE INDEX ix_audit_log_occurred_at ON core.audit_log (occurred_at DESC)")
    op.execute("CREATE INDEX ix_audit_log_target ON core.audit_log (target_type, target_id)")

    op.execute(
        """
        CREATE FUNCTION core.audit_log_block_changes() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'core.audit_log is append-only';
        END;
        $$ LANGUAGE plpgsql
        """
    )
    op.execute(
        """
        CREATE TRIGGER audit_log_no_update_delete
        BEFORE UPDATE OR DELETE ON core.audit_log
        FOR EACH ROW EXECUTE FUNCTION core.audit_log_block_changes()
        """
    )
    op.execute(
        """
        CREATE TRIGGER audit_log_no_truncate
        BEFORE TRUNCATE ON core.audit_log
        FOR EACH STATEMENT EXECUTE FUNCTION core.audit_log_block_changes()
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE core.audit_log")
    op.execute("DROP FUNCTION core.audit_log_block_changes()")