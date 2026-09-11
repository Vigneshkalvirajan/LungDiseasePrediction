from typing import Dict
from pydantic import BaseModel, Field, field_validator

class PredictionProbabilities(BaseModel):
    Bronchiectasis: float = Field(..., ge=0.0, le=1.0)
    Bronchiolitis: float = Field(..., ge=0.0, le=1.0)
    COPD: float = Field(..., ge=0.0, le=1.0)
    Healthy: float = Field(..., ge=0.0, le=1.0)
    Pneumonia: float = Field(..., ge=0.0, le=1.0)
    URTI: float = Field(..., ge=0.0, le=1.0)

class PredictionResult(BaseModel):
    predicted_class: str = Field(..., description="Highest-probability respiratory category")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model confidence for predicted category")
    probabilities: Dict[str, float] = Field(..., description="Probabilities across all 6 diagnostic categories")

    @field_validator("predicted_class")
    @classmethod
    def validate_class(cls, v: str) -> str:
        valid_classes = {"Bronchiectasis", "Bronchiolitis", "COPD", "Healthy", "Pneumonia", "URTI"}
        if v not in valid_classes:
            raise ValueError(f"predicted_class must be one of {valid_classes}")
        return v

class AnalyzeResponse(BaseModel):
    success: bool = True
    prediction: PredictionResult
