from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

_PHONE_RE = re.compile(r"^\+?[0-9][0-9 ()-]{6,19}$")


def validate_password_strength(value: str) -> str:
    """Min 8 chars, at least one letter, one digit and one symbol."""
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if len(value) > 128:
        raise ValueError("Password must be at most 128 characters long.")
    if not re.search(r"[A-Za-z]", value):
        raise ValueError("Password must contain at least one letter.")
    if not re.search(r"[0-9]", value):
        raise ValueError("Password must contain at least one digit.")
    if not re.search(r"[^A-Za-z0-9\s]", value):
        raise ValueError("Password must contain at least one symbol.")
    return value


class _RegisterBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    full_name: str = Field(..., alias="fullName", min_length=2, max_length=120)
    email: EmailStr
    phone: str
    password: str
    confirm_password: str = Field(..., alias="confirmPassword")

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, value: str) -> str:
        return str(value).strip().lower()

    @field_validator("phone")
    @classmethod
    def _check_phone(cls, value: str) -> str:
        if not _PHONE_RE.match(value):
            raise ValueError("Enter a valid phone number.")
        return value

    @field_validator("password")
    @classmethod
    def _check_password(cls, value: str) -> str:
        return validate_password_strength(value)

    @model_validator(mode="after")
    def _passwords_match(self) -> "_RegisterBase":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self


class DoctorRegisterRequest(_RegisterBase):
    registration_number: str = Field(..., alias="registrationNumber", min_length=3, max_length=60)
    degrees: str = Field(..., min_length=2, max_length=200)
    hospital_name: str = Field(..., alias="hospitalName", min_length=2, max_length=200)
    hospital_address: str = Field(..., alias="hospitalAddress", min_length=5, max_length=500)


class ReceptionistRegisterRequest(_RegisterBase):
    degree: str = Field(..., min_length=2, max_length=200)
    hospital_name: str = Field(..., alias="hospitalName", min_length=2, max_length=200)
    hospital_address: str = Field(..., alias="hospitalAddress", min_length=5, max_length=500)


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    # Email for now; Patient ID login is added with the patient task.
    identifier: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("identifier")
    @classmethod
    def _lower(cls, value: str) -> str:
        return value.lower()


class UserResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    full_name: str = Field(..., alias="fullName")
    email: str
    phone: str | None = None
    role: str
    status: str