from typing import Optional
from pydantic import BaseModel, Field, field_validator
import re

class PatientInfo(BaseModel):
    patient_id: str = Field(..., min_length=1, max_length=50, description="Unique patient identifier", examples=["P001"])
    name: str = Field(..., min_length=1, max_length=100, description="Patient full name", examples=["John Doe"])
    age: int = Field(..., ge=0, le=125, description="Patient age in years", examples=[45])
    gender: str = Field(..., description="Patient gender (Male, Female, Other, Unknown)", examples=["Male"])
    mobile_number: Optional[str] = Field(None, min_length=5, max_length=25, description="Patient contact/WhatsApp mobile number", examples=["+91 9876543210"])
    dob: Optional[str] = Field(None, description="Patient date of birth (YYYY-MM-DD)", examples=["1979-05-15"])
    visit_date: Optional[str] = Field(None, description="Date of clinical consultation/visit (YYYY-MM-DD)", examples=["2026-09-10"])

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: str) -> str:
        v_clean = v.strip().capitalize()
        valid = {"Male", "Female", "Other", "Unknown"}
        if v_clean not in valid:
            raise ValueError(f"Gender must be one of {valid}")
        return v_clean
