from fastapi import APIRouter
from app.core.config import settings

router = APIRouter(tags=["Health"])

@router.get("/health", summary="API Health Check")
async def health_check():
    """
    Returns operational status of the VoxMed backend services.
    """
    return {
        "status": "healthy",
        "app_name": settings.app_name,
        "version": settings.app_version,
        "target_classes": settings.target_classes,
        "gemini_model": settings.gemini_model
    }
