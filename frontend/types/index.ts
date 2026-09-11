export interface HealthResponse {
  status: string;
  app_name: string;
  version: string;
  target_classes: string[];
  gemini_model: string;
}

export interface PatientInfo {
  patient_id: string;
  name: string;
  age: number;
  gender: "Male" | "Female" | "Other" | string;
  mobile_number: string;
  dob: string;
  visit_date?: string;
}

export interface PredictionResult {
  predicted_class: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface AnalysisResponse {
  success: boolean;
  prediction: PredictionResult;
  audio_filename?: string;
  message?: string;
}

export interface PreviousVisitSummary {
  visit_date: string;
  diagnosed_disease: string;
  status?: string;
}

export interface LongitudinalProgression {
  is_returning_patient: boolean;
  total_previous_visits: number;
  previous_visits: PreviousVisitSummary[];
  progression_narrative?: string;
  health_status_trend?: string;
  previous_diagnosis?: string;
  previous_visit_date?: string;
  trend?: "improved" | "cured" | "deteriorated" | "stable" | string;
  progression_summary?: string;
  acoustic_comparison?: string;
}

export interface RespiratoryReport {
  report_title: string;
  patient_information: {
    patient_id: string;
    name: string;
    age: number;
    gender: string;
    analysis_datetime?: string;
    visit_date?: string;
    mobile_number?: string;
    dob?: string;
  };
  analysis_summary: {
    predicted_category: string;
    confidence: number;
    overall_interpretation: string;
  } | string;
  probability_analysis: Record<string, number> | string;
  interpretation: string;
  detection_rationale?: string;
  longitudinal_progression?: LongitudinalProgression;
  respiratory_sound_context: string;
  general_clinical_context: string;
  recommended_next_steps: string[];
  limitations?: string[] | string;
  disclaimer: string;
}

export interface FullAnalysisResponse {
  success: boolean;
  prediction: PredictionResult;
  report: RespiratoryReport;
  audio_filename?: string;
  message?: string;
}

export interface ReportResponse {
  success: boolean;
  report: RespiratoryReport;
  message?: string;
}

export interface HistoryItem {
  id: string;
  created_at: string;
  visit_date?: string;
  patient_id: string;
  name: string;
  age: number;
  gender: string;
  mobile_number?: string;
  dob?: string;
  audio_filename?: string;
  predicted_class: string;
  confidence: number;
  probabilities: Record<string, number>;
  status: string;
}

export interface HistoryListResponse {
  success: boolean;
  count: number;
  history: HistoryItem[];
}

export interface HistoryDetailRecord {
  id: string;
  created_at: string;
  visit_date?: string;
  patient_id: string;
  name: string;
  age: number;
  gender: string;
  mobile_number?: string;
  dob?: string;
  audio_filename?: string;
  predicted_class: string;
  confidence: number;
  probabilities: Record<string, number>;
  report?: RespiratoryReport;
  status: string;
}

export interface HistoryDetailResponse {
  success: boolean;
  record: HistoryDetailRecord;
}

export type WhatsAppLanguage = "en" | "ta" | "hi";

export type DiseaseCategory =
  | "Bronchiectasis"
  | "Bronchiolitis"
  | "COPD"
  | "Healthy"
  | "Pneumonia"
  | "URTI";
