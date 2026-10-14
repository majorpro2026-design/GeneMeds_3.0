import pytest
from datetime import date, datetime
from sqlalchemy import text
from fastapi import HTTPException
from app.routes.prescriptions import save_prescription_tx, PrescriptionItemPayload
from app.routes.patients import create_patient, PatientCreateRequest, search_patients
from app.services.recommendation_lookup import save_gene_test_result, save_risk_assessment
from app.auth.schemas import HCPResponse

class TestPersistenceAndTransactions:
    """Integration tests for PostgreSQL persistence, foreign-key integrity, and transactions."""

    def test_patient_creation_and_search(self, db_engine, auth_headers_and_cookies):
        hcp_id = auth_headers_and_cookies["hcp_id"]
        dummy_hcp = HCPResponse(
            id=hcp_id,
            fullName="Dr. Test QA",
            registrationNumber="REGQA999",
            email="drqa@test.com",
            isActive=True,
            lastLoginAt=datetime.now()
        )
        unique_name = f"TestPatient QA {int(datetime.now().timestamp())}"
        req = PatientCreateRequest(
            full_name=unique_name,
            dob=date(1985, 5, 20),
            sex="Male"
        )
        created = create_patient(req, current_hcp=dummy_hcp)
        assert created["patient_id"] is not None
        assert created["full_name"] == unique_name

        # Search patient
        search_res = search_patients(q=unique_name, current_hcp=dummy_hcp)
        assert len(search_res) > 0
        assert search_res[0]["patient_id"] == created["patient_id"]

    def test_prescription_transaction_with_multiple_items(self, db_engine, auth_headers_and_cookies):
        hcp_id = auth_headers_and_cookies["hcp_id"]
        with db_engine.connect() as conn:
            p_id = conn.execute(text("SELECT patient_id FROM core.patient ORDER BY patient_id LIMIT 1")).scalar()

        assert p_id is not None, "At least one patient must exist in core.patient"

        items = [
            PrescriptionItemPayload(drugName="Clopidogrel", dosage="75 mg", frequency="Once daily", durationDays=30),
            PrescriptionItemPayload(drugName="Atorvastatin", dosage="20 mg", frequency="Once daily", durationDays=30),
            PrescriptionItemPayload(drugName="Aspirin", dosage="81 mg", frequency="Once daily", durationDays=30)
        ]

        rx_id = save_prescription_tx(
            patient_id=p_id,
            doctor_id=hcp_id,
            items_raw=items,
            notes="Automated QA integration test prescription"
        )
        assert rx_id is not None

        # Read-after-write verification
        with db_engine.connect() as conn:
            rx_row = conn.execute(
                text("SELECT patient_id, doctor_id, notes FROM core.patient_prescription WHERE prescription_id = :rx_id"),
                {"rx_id": rx_id}
            ).mappings().first()
            assert rx_row is not None
            assert rx_row["patient_id"] == p_id
            assert rx_row["doctor_id"] == hcp_id

            saved_items = conn.execute(
                text("SELECT drug_name, dosage, frequency FROM core.prescription_item WHERE prescription_id = :rx_id"),
                {"rx_id": rx_id}
            ).mappings().all()
            assert len(saved_items) == 3
            item_names = {i["drug_name"] for i in saved_items}
            assert "Clopidogrel" in item_names
            assert "Atorvastatin" in item_names
            assert "Aspirin" in item_names

    def test_prescription_transaction_rollback_on_invalid_patient(self, db_engine, auth_headers_and_cookies):
        hcp_id = auth_headers_and_cookies["hcp_id"]
        invalid_patient_id = 99999999  # Non-existent patient

        items = [
            PrescriptionItemPayload(drugName="Clopidogrel", dosage="75 mg", frequency="Once daily", durationDays=30)
        ]

        with pytest.raises(HTTPException) as excinfo:
            save_prescription_tx(
                patient_id=invalid_patient_id,
                doctor_id=hcp_id,
                items_raw=items,
            )
        assert excinfo.value.status_code == 404

        # Verify nothing was orphaned in core.patient_prescription
        with db_engine.connect() as conn:
            orphans = conn.execute(
                text("SELECT count(*) FROM core.patient_prescription WHERE patient_id = :p_id"),
                {"p_id": invalid_patient_id}
            ).scalar()
            assert orphans == 0

    def test_gene_test_result_and_risk_assessment_persistence(self, db_engine, auth_headers_and_cookies):
        hcp_id = auth_headers_and_cookies["hcp_id"]
        with db_engine.connect() as conn:
            p_id = conn.execute(text("SELECT patient_id FROM core.patient ORDER BY patient_id LIMIT 1")).scalar()
            rec_id = conn.execute(text("SELECT recommendation_id FROM knowledge.recommendation_logic LIMIT 1")).scalar()

        result_id = save_gene_test_result(
            patient_id=p_id,
            gene_symbol="CYP2D6",
            diplotype_name="*4/*4",
            entered_by_doctor_id=hcp_id,
            lab_name="QA Test Genomics Lab"
        )
        assert result_id is not None

        # Verify persisted gene result
        with db_engine.connect() as conn:
            res_row = conn.execute(
                text("SELECT patient_id, lab_name FROM core.patient_gene_test_result WHERE result_id = :rid"),
                {"rid": result_id}
            ).mappings().first()
            assert res_row is not None
            assert res_row["patient_id"] == p_id
            assert res_row["lab_name"] == "QA Test Genomics Lab"

        # Save risk assessment
        assessment_id = save_risk_assessment(
            patient_id=p_id,
            gene_test_result_id=result_id,
            recommendation_id=rec_id,
            decision_notes="Test decision note"
        )
        assert assessment_id is not None

        with db_engine.connect() as conn:
            ass_row = conn.execute(
                text("SELECT patient_id, recommendation_id FROM history.patient_risk_assessment WHERE assessment_id = :aid"),
                {"aid": assessment_id}
            ).mappings().first()
            assert ass_row is not None
            assert ass_row["patient_id"] == p_id
            assert ass_row["recommendation_id"] == rec_id
