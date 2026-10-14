import pytest
from datetime import datetime
from unittest.mock import patch
from app.auth.dependencies import SESSION_COOKIE_NAME

class TestApiEndpointsAndWorkflow:
    """API endpoint testing: auth boundaries, validation, OCR upload, chat, and end-to-end flow."""

    def test_health_check(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

    def test_unauthorized_access_rejected(self, client):
        # Accessing protected endpoints without cookie must yield 401
        protected_endpoints = [
            ("GET", "/api/auth/hcp/me"),
            ("GET", "/api/patients/search?q=test"),
            ("POST", "/api/patients"),
            ("POST", "/api/drug-gene-lookup"),
            ("POST", "/api/gene-recommendation"),
            ("POST", "/api/prescriptions"),
            ("POST", "/api/prescriptions/upload-extract"),
        ]
        for method, endpoint in protected_endpoints:
            if method == "GET":
                resp = client.get(endpoint)
            else:
                resp = client.post(endpoint, json={})
            assert resp.status_code == 401, f"{method} {endpoint} allowed unauthenticated access"

    def test_auth_registration_and_login_flow(self, client):
        unique_suffix = int(datetime.now().timestamp() * 1000)
        email = f"doc_{unique_suffix}@hospital.org"
        reg_num = f"MCI-{unique_suffix}"
        password = "DoctorPassword123!"

        # Register (requires fullName, registrationNumber, email, password, confirmPassword)
        reg_payload = {
            "fullName": "Dr. Sarah Connor",
            "registrationNumber": reg_num,
            "email": email,
            "password": password,
            "confirmPassword": password
        }
        reg_resp = client.post("/api/auth/hcp/register", json=reg_payload)
        assert reg_resp.status_code == 201
        assert SESSION_COOKIE_NAME in reg_resp.cookies
        cookie_val = reg_resp.cookies[SESSION_COOKIE_NAME]

        # Verify /me with session cookie
        me_resp = client.get("/api/auth/hcp/me", cookies={SESSION_COOKIE_NAME: cookie_val})
        assert me_resp.status_code == 200
        assert me_resp.json()["hcp"]["email"] == email

        # Duplicate registration should return 409
        dup_resp = client.post("/api/auth/hcp/register", json=reg_payload)
        assert dup_resp.status_code == 409

        # Login with correct password
        login_resp = client.post("/api/auth/hcp/login", json={"email": email, "password": password})
        assert login_resp.status_code == 200
        assert SESSION_COOKIE_NAME in login_resp.cookies

        # Login with wrong password
        bad_login = client.post("/api/auth/hcp/login", json={"email": email, "password": "WrongPassword!"})
        assert bad_login.status_code == 401

        # Logout
        logout_resp = client.post("/api/auth/hcp/logout")
        assert logout_resp.status_code == 200

    def test_patient_validation_future_dob_rejected(self, client, auth_headers_and_cookies):
        cookies = auth_headers_and_cookies["cookies"]
        payload = {
            "full_name": "Future Baby",
            "dob": "2099-01-01",  # Future date
            "sex": "Female"
        }
        resp = client.post("/api/patients", json=payload, cookies=cookies)
        assert resp.status_code == 422

    def test_prescription_validation_empty_items_rejected(self, client, auth_headers_and_cookies):
        cookies = auth_headers_and_cookies["cookies"]
        payload = {
            "patientId": 1,
            "items": []  # empty
        }
        resp = client.post("/api/prescriptions", json=payload, cookies=cookies)
        assert resp.status_code == 422

    def test_upload_extract_unsupported_file_type(self, client, auth_headers_and_cookies):
        cookies = auth_headers_and_cookies["cookies"]
        files = {"file": ("test.pdf", b"%PDF-1.4...", "application/pdf")}
        resp = client.post("/api/prescriptions/upload-extract", files=files, cookies=cookies)
        assert resp.status_code == 400
        assert "Unsupported file type" in resp.json()["detail"]

    def test_upload_extract_file_size_limit(self, client, auth_headers_and_cookies):
        cookies = auth_headers_and_cookies["cookies"]
        # Exceed 5 MB
        large_bytes = b"0" * (5 * 1024 * 1024 + 100)
        files = {"file": ("large.jpg", large_bytes, "image/jpeg")}
        resp = client.post("/api/prescriptions/upload-extract", files=files, cookies=cookies)
        assert resp.status_code == 400
        assert "exceeds 5 MB limit" in resp.json()["detail"]

    @patch("app.routes.prescription_upload.invoke_vision_text")
    def test_upload_extract_success_with_mocked_ocr(self, mock_ocr, client, auth_headers_and_cookies):
        cookies = auth_headers_and_cookies["cookies"]
        mock_ocr.return_value = "Rx:\nTab Plavix 75mg once daily\nTab Lipitor 20mg at bedtime"

        small_image = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb"
        files = {"file": ("rx.jpg", small_image, "image/jpeg")}
        resp = client.post("/api/prescriptions/upload-extract", files=files, cookies=cookies)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["rawText"]) >= 2
        assert len(data["matchedDrugs"]) > 0

    @patch("app.routes.chat.invoke_chat")
    def test_chat_endpoint_with_mocked_llm(self, mock_chat, client):
        mock_chat.return_value = "A diplotype represents the pair of alleles for a specific gene."
        payload = {
            "messages": [
                {"role": "user", "content": "What is a diplotype?"}
            ]
        }
        resp = client.post("/api/chat", json=payload)
        assert resp.status_code == 200
        assert "diplotype" in resp.json()["reply"].lower()

    def test_complete_clinical_workflow(self, client, auth_headers_and_cookies):
        """End-to-end test of the complete supported workflow."""
        cookies = auth_headers_and_cookies["cookies"]
        hcp_id = auth_headers_and_cookies["hcp_id"]

        # Step 1: Create patient
        p_name = f"E2E Patient {int(datetime.now().timestamp())}"
        p_resp = client.post("/api/patients", json={
            "full_name": p_name,
            "dob": "1990-01-15",
            "sex": "Female"
        }, cookies=cookies)
        assert p_resp.status_code == 201
        patient_id = p_resp.json()["patient_id"]

        # Step 2: Post draft prescription for PGx test recommendation
        rx_payload = {
            "patientId": patient_id,
            "persist": False,
            "items": [
                {"drugName": "atomoxetine", "dosage": "40 mg", "frequency": "Once daily", "durationDays": 30}
            ]
        }
        draft_rx = client.post("/api/prescriptions", json=rx_payload, cookies=cookies)
        assert draft_rx.status_code == 200
        assert draft_rx.json()["success"] is True
        assert "CYP2D6" in draft_rx.json()["geneSymbols"]

        # Step 3: Clinician inputs genetic test results & requests full recommendation with persist=True
        rec_payload = {
            "drugName": "atomoxetine",
            "patientId": patient_id,
            "enteredByDoctorId": hcp_id,
            "persist": True,
            "diplotypes": [
                {"geneSymbol": "CYP2D6", "diplotypeName": "*4/*4"}
            ]
        }
        rec_resp = client.post("/api/gene-recommendation", json=rec_payload, cookies=cookies)
        assert rec_resp.status_code == 200
        rec_data = rec_resp.json()
        assert rec_data["found"] is True
        assert rec_data["phenotypes"]["CYP2D6"]["phenotypeName"] == "Poor Metabolizer"
        assert rec_data["recommendation"] is not None
        assert "savedRecordIds" in rec_data
        assert rec_data["savedRecordIds"]["assessmentId"] is not None
