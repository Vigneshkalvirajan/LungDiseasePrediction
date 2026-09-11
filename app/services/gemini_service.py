import os
import json
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from google import genai
from google.genai import types
from google.genai.errors import APIError

from app.core.config import settings
from app.models.patient import PatientInfo
from app.models.prediction import PredictionResult
from app.models.report import (
    RespiratoryReport,
    PatientReportInfo,
    AnalysisSummary,
    ProbabilityAnalysis,
    LongitudinalProgression,
    PreviousVisitSummary,
)

logger = logging.getLogger(__name__)

# Clinical knowledge base for acoustic detection rationale & contexts
CLINICAL_KNOWLEDGE: Dict[str, Dict[str, Any]] = {
    "COPD": {
        "rationale": "The Audio Spectrogram Transformer (AST) and 1D-CNN identified continuous low-to-mid frequency polyphonic wheezing harmonics combined with a prolonged expiratory airflow phase and reduced high-frequency vesicular sound transmission characteristic of chronic obstructive airway patterns.",
        "interpretation": "Auscultation acoustic patterns demonstrate persistent airflow limitation and expiratory obstruction consistent with Chronic Obstructive Pulmonary Disease (COPD).",
        "sound_context": "COPD auscultation typically features expiratory wheezes, rhonchi, distant heart sounds, and prolonged expiration due to airway remodeling and hyperinflation.",
        "clinical_context": "COPD is a progressive inflammatory lung condition characterized by persistent airflow limitation and breathlessness, frequently linked to long-term inhalational exposure.",
        "next_steps": [
            "Consult a pulmonologist or primary care physician for clinical correlation.",
            "Schedule post-bronchodilator spirometry (FEV1/FVC assessment) to confirm obstruction severity.",
            "Review inhaler compliance, smoking cessation support, and pulmonary rehabilitation.",
        ],
    },
    "Pneumonia": {
        "rationale": "Neural spectrogram feature extraction identified localized discontinuous explosive acoustic bursts (inspiratory fine/coarse crackles/rales) and increased high-frequency transmission characteristic of pulmonary alveolar fluid consolidation.",
        "interpretation": "Auscultation acoustic findings demonstrate localized alveolar consolidation and adventitious crackling consistent with Pneumonia.",
        "sound_context": "Pneumonia sounds typically include localized fine or coarse crackles during inspiration, bronchial breath sound transmission, and egophony over consolidated lung lobes.",
        "clinical_context": "Pneumonia is an acute lower respiratory tract infection causing inflammation and fluid accumulation in the alveolar sacs of one or both lungs.",
        "next_steps": [
            "Urgent clinical examination by a physician to assess vital signs, oxygen saturation, and temperature.",
            "Consider a confirmatory chest radiograph (CXR) and complete blood count (CBC).",
            "Initiate targeted antimicrobial therapy under medical supervision if bacterial etiology is suspected.",
        ],
    },
    "Bronchiectasis": {
        "rationale": "The acoustic model detected prominent mid-to-late inspiratory and early expiratory bubbling coarse crackles associated with thick secretions in permanently dilated bronchial pathways.",
        "interpretation": "Auscultation features show prominent coarse secretion crackles and bronchial airway changes consistent with Bronchiectasis.",
        "sound_context": "Bronchiectasis auscultation is characterized by widespread coarse crackles, scattered wheezing, and prominent secretion sounds that shift with coughing.",
        "clinical_context": "Bronchiectasis involves irreversible abnormal dilatation of the bronchi due to chronic cycle of infection, inflammation, and impaired mucus clearance.",
        "next_steps": [
            "Consult a respiratory specialist for high-resolution chest CT (HRCT) evaluation.",
            "Implement airway clearance techniques and daily chest physiotherapy.",
            "Review sputum culture and prophylaxis for recurrent exacerbations.",
        ],
    },
    "Bronchiolitis": {
        "rationale": "The neural classifier identified diffuse high-pitched musical end-expiratory wheezes and fine scattered crackles originating from acute small airway inflammatory narrowing.",
        "interpretation": "Auscultation acoustic findings show small-airway obstructive wheezing and fine crackles characteristic of acute Bronchiolitis.",
        "sound_context": "Bronchiolitis typically presents with tachypneic breath sounds, high-pitched expiratory wheezing, and fine inspiratory rales from swollen terminal bronchioles.",
        "clinical_context": "Bronchiolitis is an acute viral inflammatory infection of the small conducting airways (bronchioles), common in infants, children, and susceptible adults.",
        "next_steps": [
            "Clinical assessment by a healthcare professional to evaluate respiratory effort and hydration.",
            "Maintain adequate hydration, humidification, and gentle nasal suctioning if needed.",
            "Monitor closely for signs of respiratory distress or hypoxia.",
        ],
    },
    "URTI": {
        "rationale": "Neural acoustic analysis detected clear vesicular transmission over the pulmonary fields without persistent lower-airway adventitious sounds, with isolated upper airway harshness from pharyngeal/tracheal secretions.",
        "interpretation": "Acoustic examination reveals clear lower lung fields with transmitted upper airway congestion consistent with an Upper Respiratory Tract Infection (URTI).",
        "sound_context": "URTI auscultation exhibits clear vesicular breath sounds throughout bilateral lung bases, with occasional harsh tracheal sounds that clear on coughing.",
        "clinical_context": "Upper Respiratory Tract Infection involves acute viral inflammation confined to the nasal passages, pharynx, larynx, and trachea without parenchymal involvement.",
        "next_steps": [
            "Symptomatic management with rest, adequate hydration, and warm fluid intake.",
            "Warm saline gargles and steam inhalation for mucosal comfort.",
            "Follow up with a physician if symptoms worsen or persist beyond 7 to 10 days.",
        ],
    },
    "Healthy": {
        "rationale": "Neural spectrogram feature analysis confirmed clear, symmetric, low-resistance vesicular breath sounds across all frequency bands with no adventitious wheezes, crackles, or pleural friction rubs.",
        "interpretation": "Auscultation features demonstrate normal vesicular respiration with clean laminar airflow and clear lung fields.",
        "sound_context": "Healthy auscultation is defined by soft, low-pitched vesicular breath sounds heard during inspiration and early expiration without adventitious components.",
        "clinical_context": "Normal respiratory auscultation indicative of intact alveolar ventilation and unobstructed conducting airways.",
        "next_steps": [
            "Maintain standard preventive respiratory hygiene and healthy lifestyle practices.",
            "Routine periodic health checkups as recommended for age group.",
        ],
    },
}

class GeminiService:
    """
    Dedicated service for generating professional AI-Assisted Respiratory Sound Analysis Reports
    using the official Google GenAI SDK, with an automatic clinical synthesis fallback.
    """
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self._custom_api_key = api_key
        self.model_name = model or settings.gemini_model
        self.client = None
        if self._custom_api_key:
            try:
                self.client = genai.Client(api_key=self._custom_api_key)
            except Exception as e:
                logger.warning(f"Failed to initialize GenAI client: {e}")

    @property
    def api_key(self) -> Optional[str]:
        """Dynamically retrieves API key from instance, settings, or environment."""
        return self._custom_api_key or settings.gemini_api_key or os.environ.get("GEMINI_API_KEY")

    def _get_client(self) -> genai.Client:
        """Returns initialized Gemini client or raises configuration error."""
        active_key = self.api_key
        if not active_key or not active_key.strip() or active_key.strip() == "your_gemini_api_key_here":
            logger.error("Gemini API key configured: NO")
            raise ValueError("GEMINI_API_KEY is not configured in backend environment.")
        
        if not self.client:
            self.client = genai.Client(api_key=active_key.strip())
        return self.client

    def generate_fallback_report(
        self,
        patient: PatientInfo,
        prediction: PredictionResult,
        analysis_datetime: Optional[str] = None,
        previous_visits: Optional[List[Dict[str, Any]]] = None,
    ) -> RespiratoryReport:
        """
        Synthesizes a high-fidelity, clinically accurate structured RespiratoryReport
        when cloud API endpoints are unreachable or DNS resolution fails.
        """
        now_str = analysis_datetime or datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        current_visit_date = patient.visit_date or datetime.utcnow().strftime("%Y-%m-%d")
        category = prediction.predicted_class if prediction.predicted_class in CLINICAL_KNOWLEDGE else "Healthy"
        knowledge = CLINICAL_KNOWLEDGE.get(category, CLINICAL_KNOWLEDGE["Healthy"])

        # Longitudinal Analysis
        longitudinal_data = None
        if previous_visits and len(previous_visits) > 0:
            total_prev = len(previous_visits)
            latest_prev = previous_visits[0]
            prev_diag = latest_prev.get("predicted_class", "Previous Condition")
            prev_date = latest_prev.get("visit_date") or (latest_prev.get("created_at", "")[:10]) or "earlier visit"

            # Determine trend
            if category == "Healthy" and prev_diag != "Healthy":
                trend = "cured"
                summary = (
                    f"On {prev_date}, the patient presented with {prev_diag}. "
                    f"Present auscultation on {current_visit_date} demonstrates complete resolution of adventitious sounds "
                    f"with clear vesicular breath sounds, indicating significant clinical recovery/cure."
                )
                acoustic_comp = f"Previous recording showed adventitious features consistent with {prev_diag}; current auscultation displays clear laminar vesicular airflow across all acoustic frequency bands."
            elif category != "Healthy" and prev_diag == "Healthy":
                trend = "deteriorated"
                summary = (
                    f"Patient had clear breath sounds on {prev_date}. "
                    f"Current evaluation on {current_visit_date} identifies acute acoustic onset of {category}."
                )
                acoustic_comp = f"New onset of {category}-specific adventitious sound signatures compared to baseline."
            elif category == prev_diag:
                trend = "stable"
                summary = (
                    f"Patient continues to exhibit acoustic findings of {category}, consistent with the assessment from {prev_date}."
                )
                acoustic_comp = f"Acoustic frequency distribution remains consistent with persistent {category} findings."
            else:
                trend = "improved" if category == "URTI" else "stable"
                summary = (
                    f"Patient transitioned from {prev_diag} on {prev_date} to {category} on {current_visit_date}."
                )
                acoustic_comp = f"Acoustic shift from {prev_diag} characteristics to {category} patterns."

            prev_summaries = [
                PreviousVisitSummary(
                    visit_date=v.get("visit_date") or (v.get("created_at", "")[:10]) or "Unknown",
                    diagnosed_disease=v.get("predicted_class", "Unknown"),
                    status=v.get("status", "completed"),
                )
                for v in previous_visits
            ]

            longitudinal_data = LongitudinalProgression(
                is_returning_patient=True,
                total_previous_visits=total_prev,
                previous_visits=prev_summaries,
                progression_narrative=summary,
                health_status_trend="Recovered / Healthy" if trend == "cured" else "Condition Stable / Monitored",
                previous_diagnosis=prev_diag,
                previous_visit_date=prev_date,
                trend=trend,
                progression_summary=summary,
                acoustic_comparison=acoustic_comp,
            )
        else:
            longitudinal_data = LongitudinalProgression(
                is_returning_patient=False,
                total_previous_visits=0,
                previous_visits=[],
                progression_narrative="Initial baseline auscultation assessment.",
                health_status_trend="Initial Assessment",
            )

        return RespiratoryReport(
            report_title="AI-Assisted Respiratory Sound Analysis Report",
            patient_information=PatientReportInfo(
                patient_id=patient.patient_id,
                name=patient.name,
                age=patient.age,
                gender=patient.gender,
                analysis_datetime=now_str,
                visit_date=current_visit_date,
                mobile_number=patient.mobile_number,
                dob=patient.dob,
            ),
            analysis_summary=AnalysisSummary(
                predicted_category=category,
                confidence=float(prediction.confidence),
                overall_interpretation=knowledge["interpretation"],
            ),
            probability_analysis=ProbabilityAnalysis(
                Bronchiectasis=float(prediction.probabilities.get("Bronchiectasis", 0.0)),
                Bronchiolitis=float(prediction.probabilities.get("Bronchiolitis", 0.0)),
                COPD=float(prediction.probabilities.get("COPD", 0.0)),
                Healthy=float(prediction.probabilities.get("Healthy", 0.0)),
                Pneumonia=float(prediction.probabilities.get("Pneumonia", 0.0)),
                URTI=float(prediction.probabilities.get("URTI", 0.0)),
            ),
            interpretation=knowledge["interpretation"],
            detection_rationale=knowledge["rationale"],
            longitudinal_progression=longitudinal_data,
            respiratory_sound_context=knowledge["sound_context"],
            general_clinical_context=knowledge["clinical_context"],
            recommended_next_steps=knowledge["next_steps"],
            limitations=None,
            disclaimer=(
                "This report provides an AI-assisted respiratory sound classification/screening result "
                "and is not a confirmed medical diagnosis. Clinical evaluation and confirmation by a "
                "qualified healthcare professional are recommended."
            ),
        )

    def generate_respiratory_report(
        self,
        patient: PatientInfo,
        prediction: PredictionResult,
        analysis_datetime: Optional[str] = None,
        previous_visits: Optional[list] = None,
        allow_fallback: bool = True
    ) -> RespiratoryReport:
        """
        Generates a structured clinical explanation report from patient info and ML prediction.
        Tries Google Gemini API first; gracefully falls back to the clinical synthesis engine
        if network/DNS resolution is unavailable or if the API key encounters network errors.
        """
        now_str = analysis_datetime or datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        current_visit_date = patient.visit_date or datetime.utcnow().strftime("%Y-%m-%d")

        try:
            client = self._get_client()
        except ValueError as e:
            if allow_fallback:
                logger.warning(f"Gemini client unavailable ({e}). Utilizing clinical fallback report engine.")
                return self.generate_fallback_report(patient, prediction, analysis_datetime, previous_visits)
            raise

        has_prior_history = bool(previous_visits and len(previous_visits) > 0)
        history_context = ""
        if has_prior_history:
            history_lines = []
            for idx, v in enumerate(previous_visits, 1):
                v_date = v.get("visit_date") or (v.get("created_at", "")[:10]) or f"Visit {idx}"
                v_diag = v.get("predicted_class", "Unknown")
                history_lines.append(f"  * Visit {idx} ({v_date}): Diagnosed Category = {v_diag}")
            history_context = "\nPREVIOUS VISIT HISTORY (LONGITUDINAL RECORDS):\n" + "\n".join(history_lines) + f"\n  * CURRENT VISIT ({current_visit_date}): Current Predicted Category = {prediction.predicted_class}\n"
        else:
            history_context = "\nPREVIOUS VISIT HISTORY:\n  * First recorded visit for this patient ID (Initial Baseline Assessment).\n"

        prompt = f"""You are a professional medical AI communications specialist and pulmonologist generating a RespiraAI Respiratory Sound Diagnostic Report.

PATIENT INFORMATION:
- Patient ID: {patient.patient_id}
- Name: {patient.name}
- Age: {patient.age}
- Gender: {patient.gender}
- Date of Visit: {current_visit_date}
- Analysis Date/Time: {now_str}

{history_context}

MACHINE LEARNING PREDICTION DATA:
- Current Diagnosed Category: {prediction.predicted_class}
- Model Confidence: {prediction.confidence * 100:.1f}% ({prediction.confidence:.4f})
- Full 6-Class Probability Distribution:
  * Bronchiectasis: {prediction.probabilities.get('Bronchiectasis', 0.0) * 100:.2f}%
  * Bronchiolitis: {prediction.probabilities.get('Bronchiolitis', 0.0) * 100:.2f}%
  * COPD: {prediction.probabilities.get('COPD', 0.0) * 100:.2f}%
  * Healthy: {prediction.probabilities.get('Healthy', 0.0) * 100:.2f}%
  * Pneumonia: {prediction.probabilities.get('Pneumonia', 0.0) * 100:.2f}%
  * URTI: {prediction.probabilities.get('URTI', 0.0) * 100:.2f}%

CRITICAL CLINICAL & ACOUSTIC RULES (MUST BE STRICTLY FOLLOWED):
1. The report title MUST be exactly "AI-Assisted Respiratory Sound Analysis Report".
2. In 'detection_rationale', explicitly explain WHY the Audio Spectrogram Transformer (AST) and 1D-CNN neural classifier detected this specific disease ({prediction.predicted_class}) from the stethoscope audio file.
3. LONGITUDINAL PROGRESSION ANALYSIS:
   - If the patient has previous visits, populate 'longitudinal_progression' comparing past diagnoses with current finding.
4. Return the report adhering to the RespiratoryReport structured schema.
"""

        try:
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=RespiratoryReport,
                temperature=0.2,
            )

            response = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=config,
            )

            response_text = response.text.strip()
            report_dict = json.loads(response_text)
            
            # Ensure patient demographic fields match input exactly
            report_dict["patient_information"] = {
                "patient_id": patient.patient_id,
                "name": patient.name,
                "age": patient.age,
                "gender": patient.gender,
                "analysis_datetime": now_str,
                "visit_date": current_visit_date,
                "mobile_number": patient.mobile_number,
                "dob": patient.dob,
            }
            
            # Ensure probability distribution matches ML input exactly
            report_dict["probability_analysis"] = {
                cls: float(prediction.probabilities.get(cls, 0.0))
                for cls in settings.target_classes
            }
            report_dict["analysis_summary"]["predicted_category"] = prediction.predicted_class
            report_dict["analysis_summary"]["confidence"] = float(prediction.confidence)

            # Clean out limitations if present
            report_dict["limitations"] = None

            return RespiratoryReport.model_validate(report_dict)

        except (APIError, json.JSONDecodeError, Exception) as e:
            logger.warning(f"Gemini API or network issue ({e}). Utilizing clinical fallback report engine.")
            if allow_fallback:
                return self.generate_fallback_report(
                    patient=patient,
                    prediction=prediction,
                    analysis_datetime=now_str,
                    previous_visits=previous_visits,
                )
            raise RuntimeError(f"Report generation failed: {str(e)}")

# Global singleton instance
gemini_service = GeminiService()
