import logging
from typing import Optional, Dict
from datetime import datetime
from app.models.patient import PatientInfo
from app.models.prediction import PredictionResult
from app.models.report import RespiratoryReport, PatientReportInfo, AnalysisSummary, ProbabilityAnalysis

logger = logging.getLogger(__name__)

class ReportService:
    """
    Provides validation and formatting helpers for respiratory report processing.
    """
    @staticmethod
    def create_patient_report_info(patient: PatientInfo, analysis_datetime: Optional[str] = None) -> PatientReportInfo:
        """Constructs standardized PatientReportInfo."""
        now_str = analysis_datetime or datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        return PatientReportInfo(
            patient_id=patient.patient_id,
            name=patient.name,
            age=patient.age,
            gender=patient.gender,
            analysis_datetime=now_str
        )

    @staticmethod
    def create_analysis_summary(prediction: PredictionResult) -> AnalysisSummary:
        """Constructs standardized AnalysisSummary from prediction result."""
        interpretation_text = (
            f"The AI-assisted respiratory sound analysis indicates {prediction.predicted_class} "
            f"as the highest-probability category with {prediction.confidence * 100:.1f}% confidence."
        )
        return AnalysisSummary(
            predicted_category=prediction.predicted_class,
            confidence=prediction.confidence,
            overall_interpretation=interpretation_text
        )

report_service = ReportService()
