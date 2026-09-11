from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from app.models.patient import PatientInfo
from app.models.prediction import PredictionResult

class PatientReportInfo(BaseModel):
    patient_id: str
    name: str
    age: int
    gender: str
    analysis_datetime: str
    visit_date: Optional[str] = None
    mobile_number: Optional[str] = None
    dob: Optional[str] = None

class AnalysisSummary(BaseModel):
    predicted_category: str
    confidence: float
    overall_interpretation: str

class ProbabilityAnalysis(BaseModel):
    Bronchiectasis: float
    Bronchiolitis: float
    COPD: float
    Healthy: float
    Pneumonia: float
    URTI: float

class PreviousVisitSummary(BaseModel):
    visit_date: str
    diagnosed_disease: str
    status: Optional[str] = "Diagnosed"

class LongitudinalProgression(BaseModel):
    is_returning_patient: bool = False
    total_previous_visits: int = 0
    previous_visits: List[PreviousVisitSummary] = []
    progression_narrative: Optional[str] = Field(
        None,
        description="Clinical narrative comparing past diagnoses with current auscultation findings to explain recovery, cure, improvement, or deterioration."
    )
    health_status_trend: Optional[str] = Field(
        None,
        description="e.g., 'Recovered / Healthy', 'Significantly Improved', 'Stable', 'Deteriorated', 'Initial Assessment'"
    )

class RespiratoryReport(BaseModel):
    report_title: str = Field(default="AI-Assisted Respiratory Sound Analysis Report")
    patient_information: PatientReportInfo
    analysis_summary: AnalysisSummary
    probability_analysis: ProbabilityAnalysis
    interpretation: str = Field(..., description="Explanation of the predicted category and screening findings")
    detection_rationale: str = Field(
        ...,
        description="Comprehensive acoustic rationale explaining why the AST transformer and 1D-CNN neural model detected this specific disease from the audio recording (e.g. adventitious breath sounds, wheezing harmonics, coarse/fine crackles, frequency power distribution, prolonged expiratory phase, or normal vesicular breath acoustics)."
    )
    longitudinal_progression: Optional[LongitudinalProgression] = Field(
        default=None,
        description="Longitudinal disease comparison and progression tracking over time for returning patients"
    )
    respiratory_sound_context: str = Field(..., description="General acoustic characteristics associated with the category")
    general_clinical_context: str = Field(..., description="Educational clinical information without invented patient findings")
    recommended_next_steps: List[str] = Field(..., description="Actionable professional next steps and clinical evaluation guidance")
    limitations: Optional[str] = Field(default=None, description="Optional limitations field")
    disclaimer: str = Field(
        default=(
            "This report provides an AI-assisted respiratory sound classification/screening result "
            "and is not a confirmed medical diagnosis. Clinical evaluation and confirmation by a "
            "qualified healthcare professional are recommended."
        )
    )

class GenerateReportRequest(BaseModel):
    patient: PatientInfo
    prediction: PredictionResult

class GenerateReportResponse(BaseModel):
    success: bool = True
    report: RespiratoryReport

class AnalyzeAndReportResponse(BaseModel):
    success: bool = True
    prediction: PredictionResult
    report: RespiratoryReport
