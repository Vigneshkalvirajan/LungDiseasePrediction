import logging
from fastapi import APIRouter, HTTPException, status
from app.models.chat import PatientChatRequest, PatientChatResponse
from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Clinical Chatbot"],
    responses={404: {"description": "Endpoint not found"}},
)

@router.post(
    "/chat",
    response_model=PatientChatResponse,
    summary="Interactive AI Clinical Copilot for Patient Analysis & Diagnosis Q&A",
    description=(
        "Processes a natural language clinical inquiry regarding a specific patient's auscultation, "
        "Audio Spectrogram Transformer ML predictions, probability distribution, and clinical recommendations."
    ),
)
async def chat_with_patient_copilot(payload: PatientChatRequest):
    """
    Answers questions about a patient's examination and auscultation diagnosis
    using Gemini with fallback clinical knowledge engine.
    """
    try:
        if not payload.question or not payload.question.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Question cannot be empty."
            )
            
        logger.info(
            f"Received clinical chat query for patient {payload.patient.patient_id} ({payload.patient.name}): "
            f"'{payload.question[:60]}...'"
        )

        response = gemini_service.chat_with_patient(
            patient=payload.patient,
            prediction=payload.prediction,
            report=payload.report,
            messages=payload.messages,
            question=payload.question.strip(),
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing clinical chat request: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate clinical response: {str(e)}"
        )
