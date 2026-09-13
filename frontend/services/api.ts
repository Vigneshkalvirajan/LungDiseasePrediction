import {
  HealthResponse,
  PatientInfo,
  PredictionResult,
  AnalysisResponse,
  FullAnalysisResponse,
  ReportResponse,
  HistoryListResponse,
  HistoryDetailResponse,
  PatientChatRequest,
  PatientChatResponse,
} from "../types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL !== undefined && process.env.NEXT_PUBLIC_API_BASE_URL !== ""
    ? process.env.NEXT_PUBLIC_API_BASE_URL
    : "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      if (typeof errorData.detail === "string") {
        errorDetail = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        errorDetail = errorData.detail
          .map((err: any) => `${err.loc?.join(".") || "field"}: ${err.msg}`)
          .join(", ");
      } else if (errorData.message) {
        errorDetail = errorData.message;
      }
    } catch {
      // JSON parse failed, use default message
    }
    throw new ApiError(errorDetail, response.status);
  }
  return response.json();
}

export const apiService = {
  /**
   * Health check for FastAPI backend
   */
  async getHealth(): Promise<HealthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    return handleResponse<HealthResponse>(response);
  },

  /**
   * End-to-end audio analysis + Gemini clinical report generation + History persistence
   */
  async analyzeAndReport(
    file: File,
    patient: PatientInfo
  ): Promise<FullAnalysisResponse> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("patient_id", patient.patient_id?.trim() || "ANON-001");
    formData.append("name", patient.name.trim());
    formData.append("age", patient.age.toString());
    formData.append("gender", patient.gender);
    if (patient.mobile_number) {
      formData.append("mobile_number", patient.mobile_number.trim());
    }
    if (patient.dob) {
      formData.append("dob", patient.dob.trim());
    }
    if (patient.visit_date) {
      formData.append("visit_date", patient.visit_date.trim());
    }

    const response = await fetch(`${API_BASE_URL}/api/analyze-and-report`, {
      method: "POST",
      body: formData,
    });
    return handleResponse<FullAnalysisResponse>(response);
  },

  /**
   * ML inference only on audio file
   */
  async analyzeAudio(file: File): Promise<AnalysisResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: "POST",
      body: formData,
    });
    return handleResponse<AnalysisResponse>(response);
  },

  /**
   * Generate Gemini clinical report from existing prediction
   */
  async generateReport(
    patient: PatientInfo,
    prediction: PredictionResult
  ): Promise<ReportResponse> {
    const response = await fetch(`${API_BASE_URL}/api/generate-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        patient: {
          patient_id: patient.patient_id || "ANON-001",
          name: patient.name,
          age: patient.age,
          gender: patient.gender,
          mobile_number: patient.mobile_number,
          dob: patient.dob,
          visit_date: patient.visit_date,
        },
        prediction: {
          predicted_class: prediction.predicted_class,
          confidence: prediction.confidence,
          probabilities: prediction.probabilities,
        },
      }),
    });
    return handleResponse<ReportResponse>(response);
  },

  /**
   * Fetch historical analyses, optionally filtered by patient ID
   */
  async getHistory(limit: number = 100, patient_id?: string): Promise<HistoryListResponse> {
    let url = `${API_BASE_URL}/api/history?limit=${limit}`;
    if (patient_id && patient_id.trim()) {
      url += `&patient_id=${encodeURIComponent(patient_id.trim())}`;
    }
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    return handleResponse<HistoryListResponse>(response);
  },

  /**
   * Fetch past visits for a specific patient
   */
  async getPatientHistory(patient_id: string): Promise<{ success: boolean; visits: any[] }> {
    const response = await fetch(`${API_BASE_URL}/api/history/patient/${encodeURIComponent(patient_id)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    return handleResponse<{ success: boolean; visits: any[] }>(response);
  },

  /**
   * Fetch specific historical analysis record
   */
  async getHistoryDetail(id: string): Promise<HistoryDetailResponse> {
    const response = await fetch(`${API_BASE_URL}/api/history/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    return handleResponse<HistoryDetailResponse>(response);
  },

  /**
   * Check if a Patient ID is already registered in the system
   */
  async checkPatientId(patient_id: string): Promise<{ success: boolean; exists: boolean; patient?: PatientInfo | null }> {
    if (!patient_id || !patient_id.trim()) {
      return { success: true, exists: false, patient: null };
    }
    const response = await fetch(`${API_BASE_URL}/api/history/patient-check/${encodeURIComponent(patient_id.trim())}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    return handleResponse<{ success: boolean; exists: boolean; patient?: PatientInfo | null }>(response);
  },

  /**
   * Interactive AI Clinical Copilot Chat regarding patient's analysis & diagnosis
   */
  async chatWithPatient(payload: PatientChatRequest): Promise<PatientChatResponse> {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<PatientChatResponse>(response);
  },
};
