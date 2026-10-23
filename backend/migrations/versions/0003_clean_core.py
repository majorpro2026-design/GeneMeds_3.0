"""clean core schema: doctors = user_account, patient extended, visit table

Revision ID: 0003_clean_core
Revises: 0002_audit_log
"""
from alembic import op

revision = "0003_clean_core"
down_revision = "0002_audit_log"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Safety: patient_id must auto-generate.
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='core' AND table_name='patient' AND column_name='patient_id'
                  AND (column_default IS NOT NULL OR is_identity = 'YES')
            ) THEN
                RAISE EXCEPTION 'core.patient.patient_id has no default/identity; tell Claude';
            END IF;
        END $$
        """
    )

    # 1. Wipe test data (knowledge schema is not touched; no CASCADE on purpose).
    op.execute(
        "TRUNCATE history.patient_risk_assessment, core.patient_gene_test_result, "
        "core.patient_drug_event, core.prescription_item, core.patient_prescription, "
        "core.patient RESTART IDENTITY"
    )

    # 2. Doctors become user_account rows.
    op.execute("ALTER TABLE core.patient_prescription DROP CONSTRAINT IF EXISTS fk_prescription_doctor")
    op.execute("ALTER TABLE core.patient_prescription DROP CONSTRAINT IF EXISTS fk_patient_prescription_patient")  # duplicate of fk_prescription_patient
    op.execute("ALTER TABLE core.patient_gene_test_result DROP CONSTRAINT IF EXISTS fk_gene_test_doctor")
    op.execute("ALTER TABLE core.patient_drug_event DROP CONSTRAINT IF EXISTS fk_event_doctor")
    op.execute("DROP TABLE core.doctor")
    op.execute("ALTER TABLE core.patient_prescription ADD CONSTRAINT fk_prescription_doctor FOREIGN KEY (doctor_id) REFERENCES core.user_account(id)")
    op.execute("ALTER TABLE core.patient_gene_test_result ADD CONSTRAINT fk_gene_test_doctor FOREIGN KEY (entered_by_doctor_id) REFERENCES core.user_account(id)")
    op.execute("ALTER TABLE core.patient_drug_event ADD CONSTRAINT fk_event_doctor FOREIGN KEY (reported_by_doctor_id) REFERENCES core.user_account(id)")

    # 3. Patient table extended (table is empty, so NOT NULL is safe).
    op.execute(
        """
        ALTER TABLE core.patient
            ALTER COLUMN dob SET NOT NULL,
            ALTER COLUMN sex SET NOT NULL,
            ADD CONSTRAINT ck_patient_sex CHECK (sex IN ('male','female','other')),
            ADD COLUMN patient_code text GENERATED ALWAYS AS ('GM-' || lpad(patient_id::text, 6, '0')) STORED,
            ADD COLUMN phone text NOT NULL,
            ADD COLUMN email text,
            ADD COLUMN created_by bigint NOT NULL REFERENCES core.user_account(id),
            ADD CONSTRAINT uq_patient_code UNIQUE (patient_code)
        """
    )

    # 4. One visit table (replaces visit_serial and the text visit_id).
    op.execute(
        """
        CREATE TABLE core.visit (
            visit_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            patient_id bigint NOT NULL REFERENCES core.patient(patient_id),
            doctor_id  bigint NOT NULL REFERENCES core.user_account(id),
            created_by bigint NOT NULL REFERENCES core.user_account(id),
            reason     text,
            status     text NOT NULL DEFAULT 'waiting'
                       CHECK (status IN ('waiting','in_consultation','completed','cancelled')),
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX ix_visit_doctor_queue ON core.visit (doctor_id, status, created_at)")
    op.execute("CREATE INDEX ix_visit_patient ON core.visit (patient_id)")

    op.execute("ALTER TABLE core.patient_prescription DROP COLUMN visit_id")
    op.execute("ALTER TABLE core.patient_prescription ADD COLUMN visit_id bigint NOT NULL REFERENCES core.visit(visit_id)")
    op.execute("DROP TABLE core.visit_serial")


def downgrade() -> None:
    raise RuntimeError("0003_clean_core wipes test data and drops core.doctor; it cannot be reversed.")