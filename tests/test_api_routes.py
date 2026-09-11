import io
import pytest
from unittest.mock import patch, MagicMock

def test_api_analyze_audio_success(client, sample_audio_bytes):
    files = {"file": ("test.wav", sample_audio_bytes, "audio/wav")}
    response = client.post("/api/analyze", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "prediction" in data
    pred = data["prediction"]
    assert "predicted_class" in pred
    assert "confidence" in pred
    assert "probabilities" in pred
    assert len(pred["probabilities"]) == 6
    assert pred["predicted_class"] in ["Bronchiectasis", "Bronchiolitis", "COPD", "Healthy", "Pneumonia", "URTI"]

def test_api_analyze_audio_unsupported_format(client):
    files = {"file": ("document.pdf", b"not an audio file", "application/pdf")}
    response = client.post("/api/analyze", files=files)
    assert response.status_code == 400
    assert "Unsupported audio format" in response.json()["detail"]

def test_api_analyze_audio_empty_file(client):
    files = {"file": ("empty.wav", b"", "audio/wav")}
    response = client.post("/api/analyze", files=files)
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()

def test_api_generate_report_success(client, sample_patient, sample_prediction, mock_respiratory_report):
    with patch("app.services.gemini_service.gemini_service.generate_respiratory_report") as mock_gen:
        mock_gen.return_value = mock_respiratory_report

        payload = {
            "patient": sample_patient.model_dump(),
            "prediction": sample_prediction.model_dump()
        }
        response = client.post("/api/generate-report", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "report" in data
        rep = data["report"]
        assert rep["report_title"] == "AI-Assisted Respiratory Sound Analysis Report"
        assert rep["analysis_summary"]["predicted_category"] == "COPD"
        assert len(rep["recommended_next_steps"]) > 0
        assert "not a confirmed medical diagnosis" in rep["disclaimer"]

def test_api_generate_report_invalid_patient_age(client, sample_prediction):
    payload = {
        "patient": {
            "patient_id": "P001",
            "name": "John Doe",
            "age": -5,  # Invalid: negative age
            "gender": "Male"
        },
        "prediction": sample_prediction.model_dump()
    }
    response = client.post("/api/generate-report", json=payload)
    assert response.status_code == 422
    assert response.json()["success"] is False

def test_api_generate_report_missing_patient_id(client, sample_prediction):
    payload = {
        "patient": {
            "patient_id": "",  # Invalid: empty string
            "name": "John Doe",
            "age": 45,
            "gender": "Male"
        },
        "prediction": sample_prediction.model_dump()
    }
    response = client.post("/api/generate-report", json=payload)
    assert response.status_code == 422
    assert response.json()["success"] is False

def test_api_generate_report_invalid_patient_gender(client, sample_prediction):
    payload = {
        "patient": {
            "patient_id": "P001",
            "name": "John Doe",
            "age": 45,
            "gender": "Alien"  # Invalid gender
        },
        "prediction": sample_prediction.model_dump()
    }
    response = client.post("/api/generate-report", json=payload)
    assert response.status_code == 422
    assert response.json()["success"] is False

def test_api_generate_report_invalid_prediction_class(client, sample_patient):
    payload = {
        "patient": sample_patient.model_dump(),
        "prediction": {
            "predicted_class": "InvalidDisease",  # Invalid class
            "confidence": 0.85,
            "probabilities": {
                "Bronchiectasis": 0.0,
                "Bronchiolitis": 0.0,
                "COPD": 0.0,
                "Healthy": 0.0,
                "Pneumonia": 0.0,
                "URTI": 0.0
            }
        }
    }
    response = client.post("/api/generate-report", json=payload)
    assert response.status_code == 422
    assert response.json()["success"] is False

def test_api_generate_report_gemini_failure(client, sample_patient, sample_prediction):
    with patch("app.services.gemini_service.gemini_service.generate_respiratory_report") as mock_gen:
        mock_gen.side_effect = RuntimeError("Gemini API service timeout")

        payload = {
            "patient": sample_patient.model_dump(),
            "prediction": sample_prediction.model_dump()
        }
        response = client.post("/api/generate-report", json=payload)
        assert response.status_code == 502
        assert "Gemini API service timeout" in response.json()["detail"]

def test_api_analyze_and_report_success(client, sample_audio_bytes, mock_respiratory_report):
    with patch("app.services.gemini_service.gemini_service.generate_respiratory_report") as mock_gen:
        mock_gen.return_value = mock_respiratory_report

        files = {"file": ("recording.wav", sample_audio_bytes, "audio/wav")}
        data = {
            "patient_id": "P005",
            "name": "Jane Smith",
            "age": 52,
            "gender": "Female"
        }
        response = client.post("/api/analyze-and-report", files=files, data=data)
        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        assert "prediction" in result
        assert "report" in result
        assert result["report"]["report_title"] == "AI-Assisted Respiratory Sound Analysis Report"

def test_api_analyze_and_report_invalid_audio(client):
    files = {"file": ("bad.wav", b"invalid_corrupt_data", "audio/wav")}
    data = {
        "patient_id": "P005",
        "name": "Jane Smith",
        "age": 52,
        "gender": "Female"
    }
    response = client.post("/api/analyze-and-report", files=files, data=data)
    assert response.status_code == 400

def test_api_analyze_and_report_invalid_patient(client, sample_audio_bytes):
    files = {"file": ("recording.wav", sample_audio_bytes, "audio/wav")}
    data = {
        "patient_id": "P005",
        "name": "Jane Smith",
        "age": 200,  # Invalid age > 125
        "gender": "Female"
    }
    response = client.post("/api/analyze-and-report", files=files, data=data)
    assert response.status_code == 422
