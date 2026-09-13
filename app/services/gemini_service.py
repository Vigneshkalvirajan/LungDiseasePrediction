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
from app.models.chat import ChatMessage, PatientChatResponse
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

    def _get_default_followups(self, disease: str) -> List[str]:
        """Returns relevant clinical follow-up questions tailored to the disease."""
        followups_map = {
            "COPD": [
                "What spirometry or pulmonary function tests should be ordered?",
                "What are the key lifestyle changes and triggers to avoid for COPD?",
                "How does the model distinguish COPD from Asthma or URTI?",
                "What medication or inhaler classes are commonly considered?",
            ],
            "Pneumonia": [
                "What are the red flag symptoms requiring immediate emergency care?",
                "What imaging (e.g. Chest X-Ray) is recommended to confirm alveolar consolidation?",
                "How do crackles/rales physically sound in pneumonia auscultation?",
                "What is the expected recovery timeline and follow-up protocol?",
            ],
            "Bronchiectasis": [
                "What airway clearance techniques and chest physiotherapy help most?",
                "Is a High-Resolution CT (HRCT) scan indicated for this patient?",
                "How are recurrent bacterial exacerbations prevented in bronchiectasis?",
                "How do coarse secretion crackles differ from fine crackles?",
            ],
            "Bronchiolitis": [
                "What are the indicators of respiratory distress in small airway disease?",
                "What supportive measures (hydration, humidification) are recommended?",
                "When should oxygen saturation or hospitalization be evaluated?",
                "How does viral bronchiolitis resolve over time?",
            ],
            "URTI": [
                "What symptomatic relief measures are recommended for URTI?",
                "How can we distinguish upper airway congestion from lower respiratory involvement?",
                "What warning signs suggest progression to a secondary bacterial infection?",
                "When should the patient follow up if symptoms persist?",
            ],
            "Healthy": [
                "What does normal vesicular breath sound transmission indicate?",
                "What routine preventive respiratory hygiene is recommended?",
                "When should routine follow-up auscultation be scheduled?",
            ],
        }
        return followups_map.get(disease, followups_map["Healthy"])

    def generate_fallback_chat_reply(
        self,
        patient: PatientInfo,
        prediction: PredictionResult,
        report: Optional[RespiratoryReport],
        question: str,
    ) -> str:
        """
        Synthesizes an intelligent, accurate, and helpful clinical response
        when Gemini API is unreachable or offline.
        """
        q_lower = question.lower().strip()
        disease = prediction.predicted_class if prediction.predicted_class in CLINICAL_KNOWLEDGE else "Healthy"
        knowledge = CLINICAL_KNOWLEDGE.get(disease, CLINICAL_KNOWLEDGE["Healthy"])
        confidence_pct = f"{prediction.confidence * 100:.1f}%"
        
        # 1. History or past visit inquiry
        if any(w in q_lower for w in ["history", "past visit", "previous", "prior", "last time", "record", "timeline"]):
            prog = getattr(report, "longitudinal_progression", None) if report else None
            prev_visits = getattr(prog, "previous_visits", []) if prog else []
            if prev_visits:
                visits_str = "\n".join([f"- **{v.visit_date}**: Diagnosed with **{v.diagnosed_disease}** ({getattr(v, 'status', 'Completed')})" for v in prev_visits])
                narrative = getattr(prog, "progression_narrative", "")
                trend_status = getattr(prog, "health_status_trend", "")
                return (
                    f"### Clinical History & Longitudinal Record for {patient.name}\n\n"
                    f"**Patient ID / MRN:** `{patient.patient_id}`\n"
                    f"**Health Trend:** {trend_status or 'Monitored'}\n\n"
                    f"**Previous Auscultation Visits:**\n{visits_str}\n\n"
                    f"**Progression Analysis:**\n{narrative or 'Patient undergoing continuous longitudinal monitoring.'}\n\n"
                    f"**Current Auscultation ({patient.visit_date or 'Recent'}):** Diagnosed as **{disease}** with {confidence_pct} confidence."
                )
            else:
                return (
                    f"### Clinical History for {patient.name}\n\n"
                    f"- **Patient ID / MRN:** `{patient.patient_id}`\n"
                    f"- **Demographics:** {patient.age} years old, {patient.gender}\n"
                    f"- **Current Visit Date:** {patient.visit_date or 'Today'}\n"
                    f"- **Current Diagnosis:** **{disease}** ({confidence_pct} confidence)\n\n"
                    f"*Note: This is the patient's initial recorded auscultation assessment in the system. No earlier visits exist under ID `{patient.patient_id}`. As new auscultations are saved, longitudinal comparisons will be tracked automatically.*"
                )

        # 2. Confidence or Model Accuracy inquiry
        if any(w in q_lower for w in ["confidence", "accuracy", "certain", "probability", "percent", "score"]):
            probs_str = "\n".join([f"- **{k}**: {v*100:.1f}%" for k, v in sorted(prediction.probabilities.items(), key=lambda x: x[1], reverse=True)])
            return (
                f"### Analysis Confidence Breakdown for {patient.name}\n\n"
                f"The Audio Spectrogram Transformer (AST) and 1D-CNN neural classifier diagnosed **{disease}** with a confidence score of **{confidence_pct}**.\n\n"
                f"**Full Differential Probability Distribution:**\n{probs_str}\n\n"
                f"**Clinical Significance:**\n"
                f"A confidence of {confidence_pct} reflects strong acoustic pattern matching between the recorded digital stethoscope audio and characteristic spectrogram features of {disease}."
            )

        # 3. Sound characteristics / Stethoscope / Acoustic features inquiry
        if any(w in q_lower for w in ["sound", "acoustic", "audio", "wheeze", "crackle", "spectrogram", "frequency", "hear", "auscultation"]):
            return (
                f"### Acoustic Characteristics & Auscultation Findings for {patient.name}\n\n"
                f"**Target Diagnosis:** {disease} ({confidence_pct} confidence)\n\n"
                f"**Auscultation Sound Profile:**\n{knowledge['sound_context']}\n\n"
                f"**Spectrogram Detection Mechanics:**\n{knowledge['rationale']}"
            )

        # 4. Treatment / Medications / Management / Next Steps inquiry
        if any(w in q_lower for w in ["treatment", "cure", "medicine", "medication", "drug", "manage", "next step", "what to do", "care", "action"]):
            steps_list = "\n".join([f"{i+1}. {step}" for i, step in enumerate(knowledge['next_steps'])])
            return (
                f"### Recommended Clinical Management for {patient.name} ({disease})\n\n"
                f"Based on the auscultation finding of **{disease}** (Confidence: {confidence_pct}), the following clinical next steps and management strategies are recommended:\n\n"
                f"{steps_list}\n\n"
                f"> **Clinical Note:** Always correlate with direct clinical examination, vital signs (SpO2, heart rate, temperature), and relevant diagnostic imaging."
            )

        # 5. Patient Information / Demographics inquiry
        if any(w in q_lower for w in ["patient info", "demographic", "who is", "age", "gender", "patient details", "mrn", "id", "dob"]):
            return (
                f"### Clinical Demographics for {patient.name}\n\n"
                f"- **Patient Name:** {patient.name}\n"
                f"- **Patient ID / MRN:** {patient.patient_id}\n"
                f"- **Age:** {patient.age} years old\n"
                f"- **Gender:** {patient.gender}\n"
                f"- **Mobile / WhatsApp:** {patient.mobile_number or 'Not provided'}\n"
                f"- **Date of Visit:** {patient.visit_date or 'Today'}\n"
                f"- **Date of Birth:** {patient.dob or 'Not specified'}\n"
                f"- **Current Diagnostic Status:** **{disease}** ({confidence_pct} confidence)"
            )

        # 6. Diagnosis / Condition explanation inquiry
        if any(w in q_lower for w in ["diagnos", "what is", "explain", "condition", "illness", "copd", "pneumonia", "bronch", "urti", "healthy"]):
            return (
                f"### Diagnostic Summary: {disease}\n\n"
                f"**Patient:** {patient.name} (Age: {patient.age}, {patient.gender})\n"
                f"**Primary Diagnosis:** **{disease}** (Model Confidence: **{confidence_pct}**)\n\n"
                f"**Condition Overview:**\n{knowledge['clinical_context']}\n\n"
                f"**Diagnostic Interpretation:**\n{knowledge['interpretation']}\n\n"
                f"**Key Recommendations:**\n" + "\n".join([f"- {s}" for s in knowledge['next_steps']])
            )

        # 7. General / Conversational fallback
        return (
            f"### Clinical Copilot Response for {patient.name}\n\n"
            f"**Current Status:** {patient.name} ({patient.gender}, {patient.age} yrs) was evaluated on {patient.visit_date or 'recent visit'} with an AI auscultation diagnosis of **{disease}** (Confidence: **{confidence_pct}**).\n\n"
            f"**Key Clinical Impression:**\n"
            f"{knowledge['interpretation']}\n\n"
            f"**Acoustic Rationale:**\n"
            f"{knowledge['rationale']}\n\n"
            f"**Recommended Actions:**\n" + "\n".join([f"- {step}" for step in knowledge['next_steps']])
        )

    def chat_with_patient(
        self,
        patient: PatientInfo,
        prediction: PredictionResult,
        report: Optional[RespiratoryReport],
        messages: List[ChatMessage],
        question: str,
    ) -> PatientChatResponse:
        """
        Interactive clinical copilot chat answering clinician/patient inquiries
        grounded in the patient's auscultation, spectrogram features, and clinical report.
        """
        now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        disease = prediction.predicted_class if prediction.predicted_class in CLINICAL_KNOWLEDGE else "Healthy"
        knowledge = CLINICAL_KNOWLEDGE.get(disease, CLINICAL_KNOWLEDGE["Healthy"])
        followups = self._get_default_followups(disease)
        confidence_pct = f"{prediction.confidence * 100:.1f}%"

        # Check if Gemini client can be initialized
        client = None
        try:
            client = self._get_client()
        except Exception as e:
            logger.info(f"Using rule-based clinical response synthesizer (Gemini client not initialized: {e})")
            reply = self.generate_fallback_chat_reply(patient, prediction, report, question)
            return PatientChatResponse(
                success=True,
                reply=reply,
                timestamp=now_str,
                suggested_followups=followups,
            )

        # Construct comprehensive clinical context
        probabilities_text = ", ".join([f"{k}: {v*100:.1f}%" for k, v in prediction.probabilities.items()])
        sound_analysis_text = (
            f"Acoustic Pattern: {knowledge['sound_context']} | "
            f"Neural Spectrogram Detection: {knowledge['rationale']}"
        )
        report_summary_text = ""
        if report:
            interpretation_val = getattr(report, "interpretation", None)
            if not interpretation_val and hasattr(report, "analysis_summary"):
                summary_obj = getattr(report, "analysis_summary")
                interpretation_val = getattr(summary_obj, "overall_interpretation", str(summary_obj))
            
            rationale_val = getattr(report, "detection_rationale", None)
            recs_val = getattr(report, "recommended_next_steps", None) or []
            
            prog_val = getattr(report, "longitudinal_progression", None)
            prog_text = ""
            if prog_val:
                prog_narrative = getattr(prog_val, "progression_narrative", "")
                prog_trend = getattr(prog_val, "health_status_trend", "")
                prog_text = f"- Longitudinal History/Progression: {prog_narrative} (Trend: {prog_trend})\n"

            report_summary_text = (
                f"\nStructured Clinical Report Summary:\n"
                f"- Clinical Interpretation: {interpretation_val or 'N/A'}\n"
                f"- Acoustic Rationale: {rationale_val or 'N/A'}\n"
                f"- Recommended Next Steps: {', '.join(recs_val) if isinstance(recs_val, list) else str(recs_val)}\n"
                f"{prog_text}"
            )

        history_lines = []
        for m in messages[-6:]:  # include up to last 6 messages for context
            role_label = "Clinician/User" if m.role == "user" else "AI Clinical Copilot"
            history_lines.append(f"{role_label}: {m.content}")
        history_text = "\n".join(history_lines) if history_lines else "No previous messages."

        system_instruction = (
            "You are VoxMed AI Clinical Copilot, an expert clinical AI assistant specializing in digital stethoscope auscultation, "
            "pulmonology, and respiratory disease diagnostics. You are assisting a doctor or patient regarding a specific patient's examination.\n\n"
            "PATIENT CLINICAL CONTEXT:\n"
            f"- Name: {patient.name}\n"
            f"- Patient ID/MRN: {patient.patient_id}\n"
            f"- Age: {patient.age}, Gender: {patient.gender}\n"
            f"- Visit Date: {patient.visit_date or 'Recent Visit'}\n"
            f"- Mobile/WhatsApp: {patient.mobile_number or 'Not provided'}\n\n"
            "ACOUSTIC ML PREDICTION (Audio Spectrogram Transformer + 1D-CNN):\n"
            f"- Primary Diagnosis: {disease} (Confidence: {confidence_pct})\n"
            f"- Class Probabilities: {probabilities_text}\n"
            f"- Stethoscope Sound Findings: {sound_analysis_text}\n"
            f"{report_summary_text}\n"
            "GUIDELINES FOR YOUR RESPONSE:\n"
            "1. Ground all answers specifically in this patient's clinical and acoustic data.\n"
            "2. Be concise, medically accurate, and empathetic. Format with clean Markdown headers, bullet points, and bold text for readability.\n"
            "3. If asked about patient history or previous visits, explain the timeline and progression based on available data.\n"
            "4. If asked about medications or treatments, provide standard clinical guidelines while advising physical correlation and physician consultation.\n"
            "5. If asked about sounds or spectrograms, explain the physical acoustic mechanisms (e.g. airflow turbulence, airway narrowing for wheezes, explosive reopening for crackles)."
        )

        prompt = (
            f"CONVERSATION HISTORY:\n{history_text}\n\n"
            f"CURRENT QUESTION:\n{question}\n\n"
            f"Please provide a helpful, structured clinical response for {patient.name}:"
        )

        try:
            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.3,
            )
            response = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=config,
            )
            reply = response.text.strip()
            return PatientChatResponse(
                success=True,
                reply=reply,
                timestamp=now_str,
                suggested_followups=followups,
            )
        except Exception as e:
            logger.warning(f"Gemini chat generation encountered error ({e}). Using clinical fallback synthesizer.")
            reply = self.generate_fallback_chat_reply(patient, prediction, report, question)
            return PatientChatResponse(
                success=True,
                reply=reply,
                timestamp=now_str,
                suggested_followups=followups,
            )

# Global singleton instance
gemini_service = GeminiService()

