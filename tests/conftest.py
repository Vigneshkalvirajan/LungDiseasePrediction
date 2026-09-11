import io
import os
import uuid
from pathlib import Path
import pytest
import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

from app.main import app
from app.models.patient import PatientInfo
from app.models.prediction import PredictionResult
from app.models.report import RespiratoryReport, PatientReportInfo, AnalysisSummary, ProbabilityAnalysis
from app.services.history_service import history_service, HistoryService

@pytest.fixture(autouse=True)
def isolate_test_database():
    """Ensures test runs never write mock data into the production/live SQLite database."""
    test_db_path = Path(__file__).parent / f"test_hist_{uuid.uuid4().hex[:8]}.db"
    orig_path = history_service.db_path
    history_service.db_path = test_db_path
    history_service._init_db()
    yield
    history_service.db_path = orig_path
    if test_db_path.exists():
        try:
            os.remove(test_db_path)
        except Exception:
            pass

@pytest.fixture
def client():
    """FastAPI TestClient fixture."""
    return TestClient(app)

@pytest.fixture
def sample_patient():
    """Valid patient fixture."""
    return PatientInfo(
        patient_id="P001",
        name="John Doe",
        age=45,
        gender="Male"
    )

@pytest.fixture
def sample_prediction():
    """Valid 6-class prediction fixture."""
    return PredictionResult(
        predicted_class="COPD",
        confidence=0.87,
        probabilities={
            "Bronchiectasis": 0.02,
            "Bronchiolitis": 0.01,
            "COPD": 0.87,
            "Healthy": 0.04,
            "Pneumonia": 0.03,
            "URTI": 0.03
        }
    )

@pytest.fixture
def sample_audio_bytes():
    """Generates 1 second of synthetic 16kHz sine wave audio bytes."""
    sr = 16000
    t = np.linspace(0, 1.0, sr)
    audio = 0.5 * np.sin(2 * np.pi * 440 * t)
    buf = io.BytesIO()
    sf.write(buf, audio, sr, format="WAV")
    return buf.getvalue()

@pytest.fixture
def mock_respiratory_report():
    """Fixture providing a valid structured RespiratoryReport."""
    return RespiratoryReport(
        report_title="AI-Assisted Respiratory Sound Analysis Report",
        patient_information=PatientReportInfo(
            patient_id="P001",
            name="John Doe",
            age=45,
            gender="Male",
            analysis_datetime="2026-09-10 10:00:00 UTC"
        ),
        analysis_summary=AnalysisSummary(
            predicted_category="COPD",
            confidence=0.87,
            overall_interpretation="The AI-assisted respiratory sound analysis indicates COPD as the highest-probability category."
        ),
        probability_analysis=ProbabilityAnalysis(
            Bronchiectasis=0.02,
            Bronchiolitis=0.01,
            COPD=0.87,
            Healthy=0.04,
            Pneumonia=0.03,
            URTI=0.03
        ),
        interpretation="Acoustic analysis shows characteristics consistent with obstructive airway patterns.",
        detection_rationale="The AST neural transformer identified low-frequency polyphonic wheezing harmonics and prolonged expiratory airflow characteristic of obstructive pulmonary patterns in the auscultation audio.",
        respiratory_sound_context="General traits associated with COPD include wheezing and prolonged expiratory airflow.",
        general_clinical_context="COPD is a progressive condition characterized by persistent airflow limitation.",
        recommended_next_steps=[
            "Consult a qualified pulmonologist or primary care physician.",
            "Consider spirometry and clinical pulmonary function testing."
        ],
        limitations=None,
        disclaimer=(
            "This report provides an AI-assisted respiratory sound classification/screening result "
            "and is not a confirmed medical diagnosis. Clinical evaluation and confirmation by a "
            "qualified healthcare professional are recommended."
        )
    )
