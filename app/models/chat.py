from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.models.patient import PatientInfo
from app.models.prediction import PredictionResult
from app.models.report import RespiratoryReport

class ChatMessage(BaseModel):
    """Single chat message in a conversation thread."""
    role: str = Field(..., description="Role of message sender: 'user', 'assistant', or 'system'")
    content: str = Field(..., description="Text content of the message")
    timestamp: Optional[str] = Field(None, description="ISO timestamp of message")

class PatientChatRequest(BaseModel):
    """Payload sent to backend to query AI about a specific patient's auscultation & diagnosis."""
    patient: PatientInfo = Field(..., description="Patient clinical demographics")
    prediction: PredictionResult = Field(..., description="Acoustic ML prediction results")
    report: Optional[RespiratoryReport] = Field(None, description="Full structured Gemini clinical report if generated")
    messages: List[ChatMessage] = Field(default_factory=list, description="Prior conversation history")
    question: str = Field(..., description="Clinician or patient question")

class PatientChatResponse(BaseModel):
    """Response returned by the AI Clinical Copilot."""
    success: bool = True
    reply: str = Field(..., description="Markdown formatted clinical response")
    timestamp: str = Field(..., description="Response generation timestamp")
    suggested_followups: List[str] = Field(
        default_factory=list,
        description="Suggested contextual follow-up questions tailored to the disease"
    )
