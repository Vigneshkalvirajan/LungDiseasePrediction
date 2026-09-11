import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.core.config import settings
from app.api.routes.health import router as health_router
from app.api.routes.analyze import router as analyze_router
from app.api.routes.report import router as report_router
from app.api.routes.history import router as history_router

# Configure root logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("voxmed")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for application startup and shutdown."""
    logger.info("Starting VoxMed Backend API...")
    logger.info(f"Target Diagnostic Classes: {settings.target_classes}")
    gemini_status = "YES" if settings.is_gemini_configured else "NO"
    logger.info(f"Gemini API key configured: {gemini_status}")
    logger.info(f"Gemini Model: {settings.gemini_model}")
    yield
    logger.info("Shutting down VoxMed Backend API...")

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "VoxMed AI Backend API for Digital Stethoscope Respiratory Disease Classification "
        "and Gemini-Powered Clinical Report Generation."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS Middleware (Enables Frontend integration on any local port)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Exception Handlers to ensure clean JSON responses without leaking internals
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        field = " -> ".join([str(loc) for loc in err.get("loc", [])])
        errors.append(f"{field}: {err.get('msg', 'Validation error')}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"success": False, "detail": "Validation error", "errors": errors}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception at {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"success": False, "detail": "Internal server error. Please try again later."}
    )

# Register API Routers under /api prefix
app.include_router(health_router, prefix="/api")
app.include_router(analyze_router, prefix="/api")
app.include_router(report_router, prefix="/api")
app.include_router(history_router, prefix="/api")

@app.get("/", include_in_schema=False)
async def root():
    """Redirect root path to interactive OpenAPI Swagger documentation."""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/docs")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
