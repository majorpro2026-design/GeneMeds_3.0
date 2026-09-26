from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class HCPRegisterRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    full_name: str = Field(..., alias="fullName", min_length=1, description="Full name of HCP")
    registration_number: str = Field(
        ..., alias="registrationNumber", min_length=1, description="Medical registration number"
    )
    email: EmailStr = Field(..., description="Valid email address")
    password: str = Field(..., min_length=8, description="Password (min 8 characters)")
    confirm_password: str = Field(
        ..., alias="confirmPassword", min_length=8, description="Must match password"
    )

    @field_validator("full_name")
    def validate_full_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Full name cannot be empty.")
        return trimmed

    @field_validator("registration_number")
    def validate_registration_number(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Registration number cannot be empty.")
        return trimmed

    @field_validator("email")
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("confirm_password")
    def validate_passwords_match(cls, confirm_password: str, info) -> str:
        password = info.data.get("password")
        if password and confirm_password != password:
            raise ValueError("Passwords do not match.")
        return confirm_password


class HCPLoginRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    email: EmailStr = Field(..., description="Email address")
    password: str = Field(..., min_length=1, description="Password")

    @field_validator("email")
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class HCPResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    full_name: str = Field(..., alias="fullName")
    registration_number: str = Field(..., alias="registrationNumber")
    email: str
    is_active: bool = Field(..., alias="isActive")
    last_login_at: Optional[datetime] = Field(None, alias="lastLoginAt")
