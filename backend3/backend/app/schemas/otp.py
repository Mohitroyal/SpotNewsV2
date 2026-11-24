from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator
import re


class SendOTPRequest(BaseModel):
    phone: Optional[str] = Field(None, description="10-digit Indian phone number (with or without +91/91/0)")
    mobile: Optional[str] = Field(None, description="Alternative field for phone")
    identifier: Optional[str] = Field(None, description="Alternative field for phone")
    purpose: Optional[str] = Field("login", description="Purpose: login or register")

    @field_validator("phone", mode="before")
    def clean_phone(cls, v: Any) -> Optional[str]:
        if not v:
            return v
        cleaned = re.sub(r"[\s\-\(\)\.]+", "", str(v).strip())
        return cleaned or None

    def get_effective_phone(self) -> str:
        raw = self.phone or self.mobile or self.identifier or ""
        cleaned = re.sub(r"[\s\-\(\)\.]+", "", str(raw).strip())
        return cleaned


class SendOTPResponse(BaseModel):
    success: bool = True
    message: str = "OTP sent successfully"
    request_id: Optional[str] = None


class VerifyOTPRequest(BaseModel):
    phone: Optional[str] = Field(None, description="10-digit Indian phone number")
    mobile: Optional[str] = Field(None, description="Alternative field for phone")
    otp: str = Field(..., description="6-digit verification code")
    purpose: Optional[str] = Field("login", description="Purpose: login or register")
    full_name: Optional[str] = None
    reqId: Optional[str] = None

    @field_validator("otp")
    def validate_otp(cls, v: str) -> str:
        if not v or not isinstance(v, str):
            raise ValueError("OTP is required")
        cleaned = v.strip()
        if not re.match(r"^\d{6}$", cleaned):
            raise ValueError("OTP must be exactly 6 digits")
        return cleaned

    def get_effective_phone(self) -> str:
        raw = self.phone or self.mobile or ""
        cleaned = re.sub(r"[\s\-\(\)\.]+", "", str(raw).strip())
        return cleaned


class UserResponseData(BaseModel):
    id: str
    phone_number: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    plan: str = "free"
    is_active: bool = True


class VerifyOTPResponse(BaseModel):
    success: bool = True
    message: str = "OTP verified successfully"
    token: Optional[str] = None
    token_type: Optional[str] = "bearer"
    user: Optional[UserResponseData] = None
