# 🫁 VoxMed: AI-Assisted Respiratory Sound Analysis Platform

VoxMed is an AI-assisted respiratory sound analysis system that classifies respiratory conditions from stethoscope audio using a trained machine learning model and generates a professional respiratory analysis report using Gemini.

---

## ⚠️ Medical Disclaimer

> **IMPORTANT MEDICAL NOTICE:**  
> This report provides an AI-assisted respiratory sound classification/screening result and is not a confirmed medical diagnosis. Clinical evaluation and confirmation by a qualified healthcare professional are recommended.

---

## 🏛️ System Architecture

```
[Digital Stethoscope Audio (.wav / .mp3)]
                   │
                   ▼
┌────────────────────────────────────────────────────────┐
│               FastAPI Backend (`/api`)                 │
├────────────────────────────────────────────────────────┤
│ 1. ML Inference Service (`app/services/ml_service.py`) │
│    - Audio Decoding (16 kHz Mono Resampling)           │
│    - Hugging Face AST Model Feature Extraction         │
│    - 6-Class 1D-CNN Classifier (`Model.h5`)            │
│    - Class Probabilities & Top Prediction              │
├────────────────────────────────────────────────────────┤
│ 2. Gemini Service (`app/services/gemini_service.py`)   │
│    - Google GenAI SDK (`gemini-2.5-flash`)             │
│    - Structured 9-Section Clinical Report              │
│    - Strict Anti-Hallucination & Safety Constraints    │
├────────────────────────────────────────────────────────┤
│ 3. Report Service (`app/services/report_service.py`)   │
│    - Report Structuring & Metadata Helpers             │
│    - Patient & Analysis Summary Formatting             │
└────────────────────────────────────────────────────────┘
                   │
                   ▼
   [Structured AI Clinical Report]
```

---

## 🎯 Target Diagnostic Classes (6-Class ICBHI Standard)

1. **Bronchiectasis**
2. **Bronchiolitis**
3. **COPD** (Chronic Obstructive Pulmonary Disease)
4. **Healthy** (Normal / Clear Lung Sounds)
5. **Pneumonia**
6. **URTI** (Upper Respiratory Tract Infection)

---

## ⚙️ Environment Configuration

Create a `.env` file in the root directory (based on `.env.example`):

```env
# Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Application Configuration
APP_NAME=VoxMed Respiratory Sound Analysis API
APP_ENV=development
PORT=8000
HOST=0.0.0.0
CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000","http://localhost:4200","http://127.0.0.1:4200"]
```

---

## 🚀 Getting Started

### 1. Backend Setup & Startup (FastAPI)

```bash
# Clone the repository and navigate to root
cd lungDiseasePrediction

# Create and activate Python 3.11 virtual environment
python -m venv .venv
# On Windows PowerShell:
.venv\Scripts\Activate.ps1
# On Linux / macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- **API Documentation (Swagger UI):** [`http://localhost:8000/docs`](http://localhost:8000/docs)
- **API Documentation (ReDoc):** [`http://localhost:8000/redoc`](http://localhost:8000/redoc)

---

### 2. Frontend Setup & Startup (Next.js / React)

The frontend is located in the `frontend/` directory.

```bash
# Navigate to the frontend folder
cd frontend

# Install Node dependencies
npm install

# Start Next.js development server
npm run dev
```

- **Interactive Medical Dashboard:** [`http://localhost:3000`](http://localhost:3000)
- **Production Build Check:** `npm run build`


---

## 📡 API Endpoints

### 1. Health Check
- **Endpoint:** `GET /api/health`
- **Response:**
```json
{
  "status": "healthy",
  "app_name": "VoxMed Respiratory Sound Analysis API",
  "version": "1.0.0",
  "target_classes": [
    "Bronchiectasis",
    "Bronchiolitis",
    "COPD",
    "Healthy",
    "Pneumonia",
    "URTI"
  ],
  "gemini_model": "gemini-2.5-flash"
}
```

---

### 2. Audio Classification
- **Endpoint:** `POST /api/analyze`
- **Content-Type:** `multipart/form-data`
- **Parameter:** `file` (Binary audio recording `.wav` or `.mp3`)
- **Response:**
```json
{
  "success": true,
  "prediction": {
    "predicted_class": "COPD",
    "confidence": 0.9404,
    "probabilities": {
      "Bronchiectasis": 0.004,
      "Bronchiolitis": 0.0475,
      "COPD": 0.9404,
      "Healthy": 0.0014,
      "Pneumonia": 0.0049,
      "URTI": 0.0019
    }
  }
}
```

---

### 3. Generate Gemini Clinical Report
- **Endpoint:** `POST /api/generate-report`
- **Content-Type:** `application/json`
- **Request Body:**
```json
{
  "patient": {
    "patient_id": "P001",
    "name": "John Doe",
    "age": 45,
    "gender": "Male"
  },
  "prediction": {
    "predicted_class": "COPD",
    "confidence": 0.87,
    "probabilities": {
      "Bronchiectasis": 0.02,
      "Bronchiolitis": 0.01,
      "COPD": 0.87,
      "Healthy": 0.04,
      "Pneumonia": 0.03,
      "URTI": 0.03
    }
  }
}
```
- **Response (Structured 9-Section Clinical Report):**
```json
{
  "success": true,
  "report": {
    "report_title": "AI-Assisted Respiratory Sound Analysis Report",
    "patient_information": {
      "patient_id": "P001",
      "name": "John Doe",
      "age": 45,
      "gender": "Male",
      "analysis_datetime": "2026-09-10 10:00:00 UTC"
    },
    "analysis_summary": {
      "predicted_category": "COPD",
      "confidence": 0.87,
      "overall_interpretation": "The AI-assisted respiratory sound analysis indicates COPD as the highest-probability category."
    },
    "probability_analysis": {
      "Bronchiectasis": 0.02,
      "Bronchiolitis": 0.01,
      "COPD": 0.87,
      "Healthy": 0.04,
      "Pneumonia": 0.03,
      "URTI": 0.03
    },
    "interpretation": "Acoustic features demonstrate prolonged expiratory phases and high-frequency adventitious sounds characteristic of airway limitation.",
    "respiratory_sound_context": "COPD auscultation typically features wheezes and reduced vesicular breath sound intensity.",
    "general_clinical_context": "Chronic Obstructive Pulmonary Disease involves airflow obstruction usually related to significant exposure to noxious particles or gases.",
    "recommended_next_steps": [
      "Schedule a consultation with a pulmonologist or primary care physician.",
      "Conduct spirometry and pulmonary function testing.",
      "Perform a clinical evaluation of symptom onset and environmental exposures."
    ],
    "limitations": "AI sound classification is sensitive to stethoscope placement, background noise, and vocal interference.",
    "disclaimer": "This report provides an AI-assisted respiratory sound classification/screening result and is not a confirmed medical diagnosis. Clinical evaluation and confirmation by a qualified healthcare professional are recommended."
  }
}
```

---

### 4. Combined Analysis & Report
- **Endpoint:** `POST /api/analyze-and-report`
- **Content-Type:** `multipart/form-data`
- **Parameters:** `file` (audio file), `patient_id`, `name`, `age`, `gender`.
- **Response:**
```json
{
  "success": true,
  "prediction": {
    "predicted_class": "COPD",
    "confidence": 0.87,
    "probabilities": {
      "Bronchiectasis": 0.02,
      "Bronchiolitis": 0.01,
      "COPD": 0.87,
      "Healthy": 0.04,
      "Pneumonia": 0.03,
      "URTI": 0.03
    }
  },
  "report": {
    "report_title": "AI-Assisted Respiratory Sound Analysis Report",
    "patient_information": {
      "patient_id": "P001",
      "name": "John Doe",
      "age": 45,
      "gender": "Male",
      "analysis_datetime": "2026-09-10 10:00:00 UTC"
    },
    "analysis_summary": {
      "predicted_category": "COPD",
      "confidence": 0.87,
      "overall_interpretation": "The AI-assisted respiratory sound analysis indicates COPD as the highest-probability category."
    },
    "probability_analysis": {
      "Bronchiectasis": 0.02,
      "Bronchiolitis": 0.01,
      "COPD": 0.87,
      "Healthy": 0.04,
      "Pneumonia": 0.03,
      "URTI": 0.03
    },
    "interpretation": "...",
    "respiratory_sound_context": "...",
    "general_clinical_context": "...",
    "recommended_next_steps": [
      "..."
    ],
    "limitations": "...",
    "disclaimer": "This report provides an AI-assisted respiratory sound classification/screening result and is not a confirmed medical diagnosis. Clinical evaluation and confirmation by a qualified healthcare professional are recommended."
  }
}
```

---

## 🧪 Testing Suite

Execute the automated test suite covering ML inference, Gemini service, and API routes:

```bash
pytest -v
```

---

## 🔒 Security Best Practices

1. **API Keys & Credentials:** Never commit `.env` or hard-code `GEMINI_API_KEY`.
2. **CORS:** Configured explicitly to allow Angular frontend development (`http://localhost:4200`) without opening insecure wildcard origins in production.
3. **Input Sanitization:** Robust Pydantic validations on all input types, age boundaries, gender categories, and audio MIME checks.
#   L u n g D i s e a s e P r e d i c t i o n  
 