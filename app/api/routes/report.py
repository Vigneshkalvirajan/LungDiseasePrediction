import logging
from fastapi import APIRouter, HTTPException, status
from app.models.report import GenerateReportRequest, GenerateReportResponse
from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Reports"])

@router.post(
    "/generate-report",
    response_model=GenerateReportResponse,
    summary="Generate AI-Assisted Clinical Respiratory Report",
    description="Generates a 9-section structured clinical explanation report from patient information and ML prediction using Gemini."
)
async def generate_report(payload: GenerateReportRequest):
    try:
        report = gemini_service.generate_respiratory_report(
            patient=payload.patient,
            prediction=payload.prediction
        )
        return GenerateReportResponse(success=True, report=report)
    except ValueError as e:
        logger.error(f"Configuration error in generate-report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except RuntimeError as e:
        logger.error(f"Runtime error in generate-report: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error in generate-report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Report generation failed: {str(e)}"
        )
