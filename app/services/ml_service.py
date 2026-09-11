import os
import io
import logging
import warnings
from pathlib import Path
from typing import Dict, Tuple

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
warnings.filterwarnings('ignore')

import numpy as np
import soundfile as sf
import torch
import torchaudio
from transformers import AutoProcessor, ASTModel
from tensorflow.keras.models import load_model

from app.core.config import settings
from app.models.prediction import PredictionResult

logger = logging.getLogger(__name__)

class MLInferenceService:
    """
    Encapsulates audio feature extraction using Hugging Face AST and 
    disease classification using the pre-trained 6-class Keras 1D-CNN.
    """
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.target_classes = settings.target_classes
        self.sample_rate = 16000
        self.processor = None
        self.ast_model = None
        self.classifier_model = None
        self._load_models()

    def _load_models(self):
        """Loads AST transformer and Keras classifier."""
        logger.info("Initializing AST feature extractor and Keras classifier...")
        try:
            self.processor = AutoProcessor.from_pretrained(settings.ast_model_name)
            self.ast_model = ASTModel.from_pretrained(settings.ast_model_name)
            self.ast_model.to(self.device)
            self.ast_model.eval()

            model_file = settings.model_path
            if not model_file.exists():
                # Fallback check for Model_6class.h5
                fallback = settings.model_dir / "Model_6class.h5"
                if fallback.exists():
                    model_file = fallback
                else:
                    raise FileNotFoundError(f"Model file not found at {model_file}")

            self.classifier_model = load_model(str(model_file))
            logger.info(f"Loaded ML classifier from {model_file}")
        except Exception as e:
            logger.error(f"Failed to load ML models: {e}")
            raise RuntimeError(f"Failed to initialize ML models: {e}")

    def extract_features_from_bytes(self, audio_bytes: bytes) -> np.ndarray:
        """
        Extracts 768-dimensional AST embeddings from raw audio bytes.
        Converts stereo/multi-channel to mono and resamples to 16kHz.
        """
        try:
            data, fs = sf.read(io.BytesIO(audio_bytes))
        except Exception as e:
            raise ValueError(f"Could not decode audio file: {e}")

        if data.size == 0:
            raise ValueError("Uploaded audio file is empty.")

        # Convert stereo/multi-channel to mono
        if data.ndim > 1:
            data = np.mean(data, axis=1)

        waveform = torch.from_numpy(data).float().unsqueeze(0)

        # Resample to 16kHz if audio sampling rate differs
        if fs != self.sample_rate:
            resampler = torchaudio.transforms.Resample(orig_freq=fs, new_freq=self.sample_rate)
            waveform = resampler(waveform)

        array = waveform.squeeze(0).numpy()
        inputs = self.processor(array, sampling_rate=self.sample_rate, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self.ast_model(**inputs)

        # 768-dim mean-pooled embedding
        last_hidden_states = outputs.last_hidden_state.squeeze().mean(axis=0).to("cpu").numpy()
        return last_hidden_states

    def predict(self, audio_bytes: bytes) -> PredictionResult:
        """
        Runs full inference on audio bytes and returns PredictionResult schema.
        """
        features = self.extract_features_from_bytes(audio_bytes)
        # Adapt input shape to 2D (batch, 768) or 3D (batch, 768, 1)
        if hasattr(self.classifier_model, 'input_shape') and len(self.classifier_model.input_shape) == 2:
            features_reshaped = features.reshape((1, 768))
        else:
            features_reshaped = features.reshape((1, 768, 1))

        probs = self.classifier_model.predict(features_reshaped, verbose=0)[0]
        probs = [float(p) for p in probs]

        top_idx = int(np.argmax(probs))
        predicted_class = self.target_classes[top_idx]
        confidence = float(probs[top_idx])

        probabilities_dict = {
            cls_name: float(probs[i])
            for i, cls_name in enumerate(self.target_classes)
        }

        return PredictionResult(
            predicted_class=predicted_class,
            confidence=confidence,
            probabilities=probabilities_dict
        )

# Global singleton instance (lazy initialization or app lifespan)
ml_service = MLInferenceService()
