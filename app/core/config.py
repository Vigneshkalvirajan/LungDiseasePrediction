import os
from typing import List, Optional
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Explicitly load .env file from the project root if it exists
ENV_PATH = BASE_DIR / ".env"
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH, override=False)

class Settings(BaseSettings):
    # App Settings
    app_name: str = "VoxMed Respiratory Sound Analysis API"
    app_version: str = "1.0.0"
    app_env: str = "development"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "http://localhost:8501",
        "http://127.0.0.1:8501"
    ]

    # ML Model Settings
    model_dir: Path = BASE_DIR / "VoxMed"
    model_path: Path = BASE_DIR / "VoxMed" / "Model.h5"
    ast_model_name: str = "MIT/ast-finetuned-audioset-10-10-0.4593"
    target_classes: List[str] = [
        "Bronchiectasis",
        "Bronchiolitis",
        "COPD",
        "Healthy",
        "Pneumonia",
        "URTI"
    ]

    # Gemini API Settings
    gemini_api_key: Optional[str] = Field(default=None, alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-2.5-flash", alias="GEMINI_MODEL")

    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def is_gemini_configured(self) -> bool:
        """Returns True if a non-placeholder Gemini API key is configured."""
        key = self.gemini_api_key or os.environ.get("GEMINI_API_KEY")
        return bool(key and key.strip() and key.strip() != "your_gemini_api_key_here")

settings = Settings()
