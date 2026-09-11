import pytest
import numpy as np
from app.services.ml_service import ml_service
from app.models.prediction import PredictionResult

def test_ml_service_initialization():
    assert ml_service.processor is not None
    assert ml_service.ast_model is not None
    assert ml_service.classifier_model is not None
    assert ml_service.target_classes == ["Bronchiectasis", "Bronchiolitis", "COPD", "Healthy", "Pneumonia", "URTI"]

def test_ml_service_feature_extraction(sample_audio_bytes):
    features = ml_service.extract_features_from_bytes(sample_audio_bytes)
    assert isinstance(features, np.ndarray)
    assert features.shape == (768,)

def test_ml_service_predict(sample_audio_bytes):
    result = ml_service.predict(sample_audio_bytes)
    assert isinstance(result, PredictionResult)
    assert result.predicted_class in ml_service.target_classes
    assert 0.0 <= result.confidence <= 1.0
    assert len(result.probabilities) == 6
    assert pytest.approx(sum(result.probabilities.values()), rel=1e-2) == 1.0

def test_ml_service_empty_audio():
    with pytest.raises(ValueError, match="Could not decode|empty"):
        ml_service.predict(b"")

def test_ml_service_invalid_audio():
    with pytest.raises(ValueError, match="Could not decode"):
        ml_service.predict(b"not_a_valid_wav_header")
