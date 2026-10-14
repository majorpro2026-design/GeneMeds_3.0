import pytest
from decimal import Decimal
from app.services.drug_lookup import _clean_strings, _extract_drug_terms, PrescriptionDrugItem
from app.services.recommendation_lookup import _format_activity_score
from app.services.bedrock_client import _image_format_for, _extract_text
from app.auth.security import hash_password, verify_password, create_access_token, decode_access_token

class TestDeterministicRules:
    """Unit tests for isolated pure functions and deterministic utilities."""

    def test_clean_strings_normalizes_and_deduplicates(self):
        inputs = ["  aspirin ", "ASPIRIN", "  ", None, "Clopidogrel", "clopidogrel", ""]
        cleaned = _clean_strings(inputs)
        assert cleaned == ["aspirin", "Clopidogrel"]

    def test_clean_strings_empty(self):
        assert _clean_strings([]) == []
        assert _clean_strings([None, "", "   "]) == []

    def test_extract_drug_terms_from_pydantic_item(self):
        item = PrescriptionDrugItem(
            drugName="Plavix",
            brandName="Plavix",
            genericName="clopidogrel",
            generics=["clopidogrel", "clopidogrel bisulfate"],
        )
        terms = _extract_drug_terms(item)
        assert "Plavix" in terms
        assert "clopidogrel" in terms
        assert "clopidogrel bisulfate" in terms
        # Deduplication case-insensitively
        assert len([t for t in terms if t.lower() == "clopidogrel"]) == 1

    def test_extract_drug_terms_from_dict(self):
        item = {
            "drugName": "Lipitor",
            "brandName": "Lipitor",
            "genericName": "atorvastatin",
            "generics": ["atorvastatin calcium"],
        }
        terms = _extract_drug_terms(item)
        assert "Lipitor" in terms
        assert "atorvastatin" in terms
        assert "atorvastatin calcium" in terms

    def test_format_activity_score(self):
        assert _format_activity_score(None) is None
        assert _format_activity_score(Decimal("0.0")) == "0.0"
        assert _format_activity_score(Decimal("0")) == "0.0"
        assert _format_activity_score(Decimal("1.25")) == "1.25"
        assert _format_activity_score(Decimal("2.0")) == "2.0"
        assert _format_activity_score(Decimal("2")) == "2.0"

    def test_image_format_mapping(self):
        assert _image_format_for("image/jpeg") == "jpeg"
        assert _image_format_for("image/png") == "png"
        assert _image_format_for("image/webp") == "webp"
        assert _image_format_for("image/tiff") == "jpeg"
        assert _image_format_for("application/pdf") == "jpeg"  # default fallback

    def test_extract_text_from_bedrock_response(self):
        resp_valid = {
            "output": {
                "message": {
                    "content": [
                        {"text": "Line 1: Rx"},
                        {"text": "Line 2: Tab Clopidogrel 75mg"}
                    ]
                }
            }
        }
        text = _extract_text(resp_valid)
        assert text == "Line 1: Rx\nLine 2: Tab Clopidogrel 75mg"

        resp_empty = {"output": {"message": {"content": []}}}
        assert _extract_text(resp_empty) == ""

        resp_malformed = {"invalid": {}}
        assert _extract_text(resp_malformed) == ""

    def test_password_hashing_and_verification(self):
        password = "SecurePassword123!"
        hashed = hash_password(password)
        assert hashed != password
        assert verify_password(password, hashed) is True
        assert verify_password("WrongPassword", hashed) is False

    def test_jwt_token_creation_and_decoding(self):
        hcp_id = 42
        token = create_access_token(hcp_id)
        assert isinstance(token, str)
        payload = decode_access_token(token)
        assert payload["sub"] == str(hcp_id)
        assert payload["type"] == "hcp"
        assert "exp" in payload
