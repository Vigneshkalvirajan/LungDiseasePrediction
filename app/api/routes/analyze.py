import logging
from typing import Optional
from fastapi import APIRouter, File, Form, UploadFile, HTTPException, status
from app.models.patient import PatientInfo
from app.models.prediction import AnalyzeResponse, PredictionResult
from app.models.report import AnalyzeAndReportResponse
from app.services.ml_service import ml_service
from app.services.gemini_service import gemini_service
from app.services.history_service import history_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Analysis"])

@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    summary="Classify Respiratory Sound Recording",
    description="Upload a stethoscope recording (.wav or .mp3) to predict respiratory category across 6 classes."
)
async def analyze_audio(file: UploadFile = File(..., description="Audio file in .wav or .mp3 format")):
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file uploaded.")

    # Validate file extension
    ext = file.filename.split(".")[-1].lower()
    if ext not in ["wav", "mp3", "flac", "ogg"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported audio format '.{ext}'. Please upload a .wav or .mp3 file."
        )

    audio_bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

    try:
        prediction = ml_service.predict(audio_bytes)
        return AnalyzeResponse(success=True, prediction=prediction)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Inference error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Audio analysis failed: {str(e)}")

@router.post(
    "/analyze-and-report",
    response_model=AnalyzeAndReportResponse,
    summary="Classify Audio, Generate Gemini Clinical Report, and Persist History",
    description="Runs ML inference on audio, generates structured AI respiratory report, and saves to database history."
)
async def analyze_and_report(
    file: UploadFile = File(..., description="Audio recording (.wav/.mp3)"),
    patient_id: Optional[str] = Form(None, description="Patient ID / MRN"),
    name: str = Form(..., description="Patient Name"),
    age: int = Form(..., ge=0, le=125, description="Patient Age"),
    gender: str = Form(..., description="Gender (Male/Female/Other/Unknown)"),
    mobile_number: Optional[str] = Form(None, description="Patient WhatsApp/Mobile Phone Number"),
    dob: Optional[str] = Form(None, description="Patient Date of Birth (YYYY-MM-DD)"),
    visit_date: Optional[str] = Form(None, description="Date of Visit (YYYY-MM-DD)")
):
    # 1. Validate Patient Info
    try:
        pid = patient_id.strip() if (patient_id and patient_id.strip()) else "ANON-001"
        patient = PatientInfo(
            patient_id=pid,
            name=name.strip(),
            age=age,
            gender=gender,
            mobile_number=mobile_number.strip() if mobile_number else None,
            dob=dob.strip() if dob else None,
            visit_date=visit_date.strip() if visit_date else None
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    # 2. Run ML Analysis
    audio_bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

    try:
        prediction = ml_service.predict(audio_bytes)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Audio analysis error in analyze-and-report: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Audio analysis failed: {str(e)}")

    # 3. Retrieve any previous visits for this patient to compute longitudinal progression
    previous_visits = []
    try:
        previous_visits = history_service.get_patient_previous_visits(patient.patient_id)
    except Exception as e:
        logger.warning(f"Could not retrieve previous visits for patient {patient.patient_id}: {e}")

    # 4. Generate Gemini Report with longitudinal context
    try:
        report = gemini_service.generate_respiratory_report(
            patient=patient,
            prediction=prediction,
            previous_visits=previous_visits
        )
        
        # 5. Save to persistent SQLite history
        try:
            history_service.create_record(
                patient=patient,
                prediction=prediction,
                report=report,
                audio_filename=file.filename
            )
        except Exception as db_err:
            logger.warning(f"Failed to persist history record: {db_err}")

        return AnalyzeAndReportResponse(success=True, prediction=prediction, report=report)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Gemini generation error in analyze-and-report: {e}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Gemini report generation failed: {str(e)}")
