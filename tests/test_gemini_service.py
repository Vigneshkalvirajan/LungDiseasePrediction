import json
import pytest
from unittest.mock import MagicMock, patch
from google.genai.errors import APIError

from app.services.gemini_service import GeminiService
from app.models.patient import PatientInfo
from app.models.prediction import PredictionResult
from app.models.report import RespiratoryReport

def test_gemini_service_missing_api_key(sample_patient, sample_prediction):
    service = GeminiService(api_key=None)
    with patch("app.services.gemini_service.settings.gemini_api_key", None), patch.dict("os.environ", {"GEMINI_API_KEY": ""}, clear=False):
        service.client = None
        with pytest.raises(ValueError, match="GEMINI_API_KEY is not configured"):
            service.generate_respiratory_report(sample_patient, sample_prediction, allow_fallback=False)

def test_gemini_service_successful_report(sample_patient, sample_prediction, mock_respiratory_report):
    service = GeminiService(api_key="test_api_key")
    
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = mock_respiratory_report.model_dump_json()
    mock_client.models.generate_content.return_value = mock_response
    service.client = mock_client

    report = service.generate_respiratory_report(sample_patient, sample_prediction)
    
    assert isinstance(report, RespiratoryReport)
    assert report.report_title == "AI-Assisted Respiratory Sound Analysis Report"
    assert report.patient_information.patient_id == "P001"
    assert report.patient_information.name == "John Doe"
    assert report.analysis_summary.predicted_category == "COPD"
    assert report.analysis_summary.confidence == 0.87
    assert len(report.recommended_next_steps) >= 1
    assert "not a confirmed medical diagnosis" in report.disclaimer

def test_gemini_service_low_confidence_prediction(sample_patient, mock_respiratory_report):
    """Test generating report with low confidence prediction."""
    low_conf_pred = PredictionResult(
        predicted_class="Pneumonia",
        confidence=0.38,
        probabilities={
            "Bronchiectasis": 0.15,
            "Bronchiolitis": 0.12,
            "COPD": 0.10,
            "Healthy": 0.10,
            "Pneumonia": 0.38,
            "URTI": 0.15
        }
    )
    service = GeminiService(api_key="test_api_key")
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = mock_respiratory_report.model_dump_json()
    mock_client.models.generate_content.return_value = mock_response
    service.client = mock_client

    report = service.generate_respiratory_report(sample_patient, low_conf_pred)
    assert isinstance(report, RespiratoryReport)
    assert report.analysis_summary.predicted_category == "Pneumonia"
    assert report.analysis_summary.confidence == 0.38

def test_gemini_service_fallback_on_network_failure(sample_patient, sample_prediction):
    """Test that when network/DNS fails, the service falls back to clinical synthesis engine."""
    service = GeminiService(api_key="test_api_key")
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = Exception("[Errno 11001] getaddrinfo failed")
    service.client = mock_client

    report = service.generate_respiratory_report(sample_patient, sample_prediction, allow_fallback=True)
    assert isinstance(report, RespiratoryReport)
    assert report.analysis_summary.predicted_category == "COPD"
    assert report.detection_rationale is not None
    assert "obstructive" in report.detection_rationale.lower() or "wheez" in report.detection_rationale.lower()

def test_gemini_service_malformed_json_response(sample_patient, sample_prediction):
    service = GeminiService(api_key="test_api_key")
    
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "This is not a JSON object {broken"
    mock_client.models.generate_content.return_value = mock_response
    service.client = mock_client

    with pytest.raises(RuntimeError, match="Report generation failed"):
        service.generate_respiratory_report(sample_patient, sample_prediction, allow_fallback=False)

def test_gemini_service_timeout_error(sample_patient, sample_prediction):
    service = GeminiService(api_key="test_api_key")
    
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = TimeoutError("Request timed out")
    service.client = mock_client

    with pytest.raises(RuntimeError, match="Report generation failed"):
        service.generate_respiratory_report(sample_patient, sample_prediction, allow_fallback=False)

def test_gemini_service_api_error(sample_patient, sample_prediction):
    service = GeminiService(api_key="test_api_key")
    
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = Exception("Rate limit exceeded")
    service.client = mock_client

    with pytest.raises(RuntimeError, match="Report generation failed"):
        service.generate_respiratory_report(sample_patient, sample_prediction, allow_fallback=False)
