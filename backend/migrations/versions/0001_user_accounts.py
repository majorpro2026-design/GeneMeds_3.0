"""user accounts with roles

Revision ID: 0001_user_accounts
"""
import sqlalchemy as sa
from alembic import op

revision = "0001_user_accounts"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS core")

    op.create_table(
        "user_account",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("full_name", sa.Text(), nullable=False),
        sa.Column("phone", sa.Text(), nullable=True),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("approved_by", sa.BigInteger(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "role IN ('admin','doctor','receptionist','patient')", name="ck_user_account_role"
        ),
        sa.CheckConstraint(
            "status IN ('pending','active','suspended','rejected')", name="ck_user_account_status"
        ),
        schema="core",
    )
    op.create_foreign_key(
        "fk_user_account_approved_by",
        "user_account", "user_account",
        ["approved_by"], ["id"],
        source_schema="core", referent_schema="core",
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_user_account_email_lower ON core.user_account (lower(email))"
    )

    op.create_table(
        "doctor_profile",
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("core.user_account.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("registration_number", sa.Text(), nullable=False),
        sa.Column("degrees", sa.Text(), nullable=False),
        sa.Column("hospital_name", sa.Text(), nullable=False),
        sa.Column("hospital_address", sa.Text(), nullable=False),
        # Optional uploads: filled by the file-upload task later.
        sa.Column("certificate_file_key", sa.Text(), nullable=True),
        sa.Column("degree_file_key", sa.Text(), nullable=True),
        schema="core",
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_doctor_registration_number "
        "ON core.doctor_profile (lower(btrim(registration_number)))"
    )

    op.create_table(
        "receptionist_profile",
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("core.user_account.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("degree", sa.Text(), nullable=False),
        sa.Column("hospital_name", sa.Text(), nullable=False),
        sa.Column("hospital_address", sa.Text(), nullable=False),
        schema="core",
    )


def downgrade() -> None:
    # The core schema itself is kept: legacy core.hcp_account lives there.
    op.drop_table("receptionist_profile", schema="core")
    op.drop_table("doctor_profile", schema="core")
    op.drop_table("user_account", schema="core")