import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.services.history_service import history_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["History"])

class HistorySummaryItem(BaseModel):
    id: str
    created_at: str
    visit_date: Optional[str] = None
    patient_id: str
    name: str
    age: int
    gender: str
    mobile_number: Optional[str] = None
    dob: Optional[str] = None
    audio_filename: Optional[str] = None
    predicted_class: str
    confidence: float
    probabilities: Dict[str, float]
    status: str

class HistoryListResponse(BaseModel):
    success: bool = True
    count: int
    history: List[HistorySummaryItem]

class HistoryDetailResponse(BaseModel):
    success: bool = True
    record: Dict[str, Any]

@router.get(
    "/history",
    response_model=HistoryListResponse,
    summary="Get Analysis History",
    description="Retrieve list of all previous real patient analyses from the database, optionally filtered by patient ID."
)
async def get_analysis_history(limit: int = 100, patient_id: Optional[str] = None):
    try:
        records = history_service.list_records(limit=limit, patient_id=patient_id)
        return HistoryListResponse(
            success=True,
            count=len(records),
            history=records
        )
    except Exception as e:
        logger.error(f"Error fetching history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve analysis history."
        )

@router.get(
    "/history/patient/{patient_id}",
    summary="Get All Previous Visits for a Patient",
    description="Retrieve chronological list of past visits and diagnoses for a specific patient ID."
)
async def get_patient_history(patient_id: str):
    try:
        visits = history_service.get_patient_previous_visits(patient_id)
        return {
            "success": True,
            "patient_id": patient_id,
            "total_visits": len(visits),
            "visits": visits
        }
    except Exception as e:
        logger.error(f"Error fetching patient history for {patient_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve history for patient {patient_id}."
        )

@router.get(
    "/history/{analysis_id}",
    response_model=HistoryDetailResponse,
    summary="Get Analysis History Record Detail",
    description="Retrieve full patient, prediction, probabilities and Gemini report for a specific historical analysis."
)
async def get_analysis_record(analysis_id: str):
    record = history_service.get_record(analysis_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis record '{analysis_id}' not found."
        )
    return HistoryDetailResponse(success=True, record=record)

@router.get(
    "/history/{analysis_id}/pdf",
    summary="Download Official Clinical PDF Report",
    description="Generates and streams the official PDF clinical diagnostic report document."
)
async def get_analysis_pdf(analysis_id: str):
    from fastapi.responses import Response
    from app.services.pdf_report_service import generate_pdf_bytes_for_analysis

    record = history_service.get_record(analysis_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis record '{analysis_id}' not found."
        )

    try:
        pdf_bytes = generate_pdf_bytes_for_analysis(record)
        patient_id = record.get('patient_id', 'PAT').replace(' ', '_')
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename=RespiraAI_Report_{patient_id}.pdf"
            }
        )
    except Exception as e:
        logger.error(f"Error rendering PDF for analysis {analysis_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate clinical PDF report."
        )
