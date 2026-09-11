import pytest
import os
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.models.patient import PatientInfo
from app.models.prediction import PredictionResult
from app.services.history_service import HistoryService, history_service
from pathlib import Path

client = TestClient(app)

def test_history_service_crud():
    test_db_name = f"test_hist_{uuid.uuid4().hex[:8]}.db"
    test_db_path = Path(__file__).parent / test_db_name
    try:
        svc = HistoryService(db_path=test_db_path)
        
        patient = PatientInfo(
            patient_id="PAT-999",
            name="Alice Smith",
            age=32,
            gender="Female",
            mobile_number="+1 555 123 4567",
            dob="1992-04-10"
        )
        prediction = PredictionResult(
            predicted_class="Healthy",
            confidence=0.98,
            probabilities={
                "Bronchiectasis": 0.001,
                "Bronchiolitis": 0.002,
                "COPD": 0.003,
                "Healthy": 0.98,
                "Pneumonia": 0.004,
                "URTI": 0.010,
            }
        )
        
        record = svc.create_record(patient=patient, prediction=prediction, audio_filename="sample.wav")
        assert record is not None
        assert record["patient_id"] == "PAT-999"
        assert record["name"] == "Alice Smith"
        assert record["mobile_number"] == "+1 555 123 4567"
        assert record["dob"] == "1992-04-10"
        assert record["predicted_class"] == "Healthy"
        
        all_records = svc.list_records()
        assert len(all_records) >= 1
        found = any(r["id"] == record["id"] for r in all_records)
        assert found is True

        fetched = svc.get_record(record["id"])
        assert fetched is not None
        assert fetched["name"] == "Alice Smith"
    finally:
        if test_db_path.exists():
            try:
                os.remove(test_db_path)
            except Exception:
                pass

def test_history_api_endpoints():
    response = client.get("/api/history")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "history" in data
    assert isinstance(data["history"], list)

def test_history_not_found():
    response = client.get("/api/history/non-existent-uuid-12345")
    assert response.status_code == 404

def test_history_pdf_download():
    # Create record in global history_service
    patient = PatientInfo(
        patient_id="PAT-PDF-TEST",
        name="PDF Test Patient",
        age=45,
        gender="Male",
        mobile_number="+91 9876543210",
        dob="1980-01-01"
    )
    prediction = PredictionResult(
        predicted_class="COPD",
        confidence=0.92,
        probabilities={
            "Bronchiectasis": 0.01,
            "Bronchiolitis": 0.02,
            "COPD": 0.92,
            "Healthy": 0.01,
            "Pneumonia": 0.02,
            "URTI": 0.02,
        }
    )
    rec = history_service.create_record(patient=patient, prediction=prediction)
    assert rec is not None

    response = client.get(f"/api/history/{rec['id']}/pdf")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert len(response.content) > 100
