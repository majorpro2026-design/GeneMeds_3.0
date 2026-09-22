"""Unit tests for HCP Authentication System."""

from __future__ import annotations

import sys
import unittest
from datetime import datetime, timezone
from pydantic import ValidationError

from app.auth.schemas import HCPLoginRequest, HCPRegisterRequest, HCPResponse
from app.auth.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


class TestSecurity(unittest.TestCase):
    def test_password_hashing(self) -> None:
        raw_pw = "DoctorSecret123!"
        hashed = hash_password(raw_pw)

        self.assertNotEqual(raw_pw, hashed)
        self.assertTrue(verify_password(raw_pw, hashed))
        self.assertFalse(verify_password("WrongPassword!", hashed))

    def test_jwt_token_flow(self) -> None:
        hcp_id = 42
        token = create_access_token(hcp_id)
        self.assertIsInstance(token, str)

        payload = decode_access_token(token)
        self.assertEqual(payload["sub"], "42")
        self.assertEqual(payload["type"], "hcp")
        self.assertIn("exp", payload)


class TestSchemas(unittest.TestCase):
    def test_register_schema_success(self) -> None:
        req = HCPRegisterRequest(
            fullName="  Dr. Jane Doe  ",
            registrationNumber=" REG-994812 ",
            email=" JANE.DOE@Hospital.Org ",
            password="SecurePassword123",
            confirmPassword="SecurePassword123",
        )
        self.assertEqual(req.full_name, "Dr. Jane Doe")
        self.assertEqual(req.registration_number, "REG-994812")
        self.assertEqual(req.email, "jane.doe@hospital.org")

    def test_register_schema_password_mismatch(self) -> None:
        with self.assertRaises(ValidationError):
            HCPRegisterRequest(
                fullName="Dr. Jane Doe",
                registrationNumber="REG-994812",
                email="jane.doe@hospital.org",
                password="SecurePassword123",
                confirmPassword="DifferentPassword123",
            )

    def test_register_schema_short_password(self) -> None:
        with self.assertRaises(ValidationError):
            HCPRegisterRequest(
                fullName="Dr. Jane Doe",
                registrationNumber="REG-994812",
                email="jane.doe@hospital.org",
                password="short",
                confirmPassword="short",
            )

    def test_login_schema_normalization(self) -> None:
        req = HCPLoginRequest(email=" DOCTOR@HOSPITAL.ORG ", password="any_password")
        self.assertEqual(req.email, "doctor@hospital.org")


if __name__ == "__main__":
    unittest.main()
