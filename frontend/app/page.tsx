"use client";

import React, { useRef, useState, useEffect } from "react";
import { Sidebar } from "../components/console/Sidebar";
import { Waveform, Spectrogram } from "../components/console/Waveform";
import { ReportView, Severity, severityBar, severityDot, severityLabel, severityText } from "../components/console/ReportView";
import { LoginForm } from "../components/auth/LoginForm";
import { LoadingView } from "../components/console/LoadingView";
import { HistoryView } from "../components/console/HistoryView";
import { WhatsAppModal } from "../components/console/WhatsAppModal";
import { apiService } from "../services/api";
import {
  PatientInfo,
  PredictionResult,
  RespiratoryReport,
  FullAnalysisResponse,
} from "../types";

export default function VoxMedConsolePage() {
  const fileRef = useRef<HTMLInputElement>(null);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Navigation: "new" (New Analysis Form), "results" (Current Results View), "history" (History List)
  const [activeTab, setActiveTab] = useState<"new" | "results" | "history">("new");

  // Status & Connection State
  const [status, setStatus] = useState<"idle" | "analyzing" | "done">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backendHealthy, setBackendHealthy] = useState(true);

  // Patient Form State (Starts completely clean with NO mock data)
  const [patient, setPatient] = useState<PatientInfo>({
    patient_id: "",
    name: "",
    age: "" as any,
    gender: "Male",
    mobile_number: "",
    dob: "",
    visit_date: new Date().toISOString().slice(0, 10),
  });

  // Uploaded Audio State
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioMetrics, setAudioMetrics] = useState({
    duration: "—",
    sampleRate: "—",
    peakHz: "—",
  });

  // Real ML Prediction & Gemini Report (No fake/default prediction on startup)
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [report, setReport] = useState<RespiratoryReport | null>(null);

  // WhatsApp Modal State
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);

  // Check login state and backend health on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = localStorage.getItem("voxmed_auth");
      setIsAuthenticated(auth === "true");
    }

    apiService
      .getHealth()
      .then(() => setBackendHealthy(true))
      .catch(() => setBackendHealthy(false));
  }, []);

  // Handle Logout
  function handleLogout() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("voxmed_auth");
    }
    setIsAuthenticated(false);
    resetAnalysis();
  }

  // Reset to clean New Analysis state
  function resetAnalysis() {
    setStatus("idle");
    setErrorMessage(null);
    setPrediction(null);
    setReport(null);
    setAudioFile(null);
    if (fileRef.current) {
      fileRef.current.value = "";
    }
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);
    }
    setAudioMetrics({
      duration: "—",
      sampleRate: "—",
      peakHz: "—",
    });
    setPatient({
      patient_id: "",
      name: "",
      age: "" as any,
      gender: "Male",
      mobile_number: "",
      dob: "",
      visit_date: new Date().toISOString().slice(0, 10),
    });
    setActiveTab("new");
  }

  // Handle Audio File Selection
  async function handleAudioSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate format
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["wav", "mp3", "flac", "ogg"].includes(ext)) {
      setErrorMessage(`Unsupported format '.${ext}'. Please select a .wav or .mp3 file.`);
      return;
    }

    setErrorMessage(null);
    setAudioFile(file);

    // Create preview URL
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
    }
    const url = URL.createObjectURL(file);
    setAudioPreviewUrl(url);

    // Extract basic audio duration & sample rate if Web Audio API is available
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuf = await file.arrayBuffer();
      const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
      setAudioMetrics({
        duration: `${audioBuf.duration.toFixed(1)}s`,
        sampleRate: `${(audioBuf.sampleRate / 1000).toFixed(0)} kHz`,
        peakHz: `${(audioBuf.sampleRate / 2000).toFixed(1)} kHz`,
      });
    } catch {
      setAudioMetrics({
        duration: "Recorded",
        sampleRate: "16 kHz",
        peakHz: "2.4 kHz",
      });
    }
  }

  // Form validation check
  const isFormValid =
    patient.name.trim().length > 0 &&
    patient.patient_id.trim().length > 0 &&
    patient.mobile_number.trim().length >= 7 &&
    Number(patient.age) >= 0 &&
    Number(patient.age) <= 125 &&
    patient.gender.length > 0 &&
    patient.dob.trim().length > 0 &&
    audioFile !== null;

  // Trigger Real Analysis
  async function handleAnalyze() {
    if (!isFormValid || !audioFile) return;

    setStatus("analyzing");
    setErrorMessage(null);

    try {
      const payloadPatient: PatientInfo = {
        patient_id: patient.patient_id.trim(),
        name: patient.name.trim(),
        age: Number(patient.age),
        gender: patient.gender,
        mobile_number: patient.mobile_number.trim(),
        dob: patient.dob.trim(),
        visit_date: patient.visit_date?.trim() || new Date().toISOString().slice(0, 10),
      };

      // Call live FastAPI backend: /api/analyze-and-report
      const response: FullAnalysisResponse = await apiService.analyzeAndReport(
        audioFile,
        payloadPatient
      );

      setPrediction(response.prediction);
      setReport(response.report);
      setStatus("done");
      setActiveTab("results");
      setBackendHealthy(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to analyze audio recording. Please check backend connection.");
      setStatus("idle");
    }
  }

  // If auth state is still loading from localStorage
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <svg className="size-6 animate-spin text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      </div>
    );
  }

  // If not logged in, display the professional Login Page
  if (!isAuthenticated) {
    return <LoginForm onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  // Render History View
  if (activeTab === "history") {
    return (
      <div className="flex min-h-screen bg-paper font-body text-ink antialiased selection:bg-brand-soft selection:text-brand">
        <Sidebar
          active={activeTab}
          onTabChange={(t) => setActiveTab(t)}
          hasActiveResult={prediction !== null}
          backendHealthy={backendHealthy}
          onLogout={handleLogout}
        />
        <HistoryView onNewAnalysis={() => setActiveTab("new")} />
      </div>
    );
  }

  // Render Results Page (if requested or completed)
  if (activeTab === "results" && prediction) {
    return (
      <div className="flex min-h-screen bg-paper font-body text-ink antialiased selection:bg-brand-soft selection:text-brand">
        <Sidebar
          active={activeTab}
          onTabChange={(t) => setActiveTab(t)}
          hasActiveResult={true}
          backendHealthy={backendHealthy}
          onLogout={handleLogout}
        />
        <ReportView
          patient={patient}
          prediction={prediction}
          report={report}
          audioFilename={audioFile?.name || "Auscultation_Recording.wav"}
          onBack={() => setActiveTab("new")}
          onSendWhatsApp={() => setIsWhatsAppOpen(true)}
        />
        <WhatsAppModal
          isOpen={isWhatsAppOpen}
          onClose={() => setIsWhatsAppOpen(false)}
          patient={patient}
          prediction={prediction}
          report={report}
        />
      </div>
    );
  }

  // Default Authenticated View: "New Analysis" Form (Clean State, Zero Mock Data)
  return (
    <div className="flex min-h-screen bg-paper font-body text-ink antialiased selection:bg-brand-soft selection:text-brand">
      <Sidebar
        active={activeTab}
        onTabChange={(t) => setActiveTab(t)}
        hasActiveResult={prediction !== null}
        backendHealthy={backendHealthy}
        onLogout={handleLogout}
      />

      <div className="min-w-0 flex-1">
        {/* Header */}
        <header className="flex items-center justify-between gap-4 border-b border-line bg-surface/80 px-6 py-3.5 no-print">
          <div className="flex min-w-0 items-center gap-3">
            <span className="font-display text-sm font-semibold text-ink">
              New Respiratory Sound Analysis
            </span>
            <span className="size-1 rounded-full bg-line" />
            <span className="text-xs text-mute font-mono">
              AST Spectrogram Feature Extraction
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetAnalysis}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper transition-colors"
              title="Clear all fields and audio to enter a new patient"
            >
              <svg className="size-3.5 text-mute" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
              New Patient
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper transition-colors"
            >
              <svg className="size-3.5 text-mute" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              View History
            </button>
          </div>
        </header>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 flex items-center justify-between rounded-xl bg-sev-high/10 border border-sev-high/30 p-3.5 text-xs text-sev-high">
            <div className="flex items-center gap-2">
              <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="font-medium underline cursor-pointer hover:opacity-80"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* If currently analyzing, show Loading Screen */}
        {status === "analyzing" ? (
          <LoadingView
            fileName={audioFile?.name || "audio.wav"}
            patientName={patient.name}
          />
        ) : (
          /* Main 2-Column Workstation Layout */
          <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[1fr_380px]">
            {/* Left Column: Patient Details Form */}
            <div className="space-y-6">
              <section className="rounded-2xl bg-surface p-6 ring-1 ring-black/5 shadow-xs">
                <div className="border-b border-line pb-4 mb-5">
                  <div className="flex items-center gap-2">
                    <span className="grid size-6 place-items-center rounded-md bg-brand/10 text-brand font-mono text-xs font-bold">
                      1
                    </span>
                    <h2 className="font-display text-base font-semibold text-ink">
                      Patient Information
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-mute">
                    Enter patient clinical demographics for report generation and WhatsApp delivery.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Patient Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-mono uppercase tracking-wider text-ink/80 mb-1">
                      Patient Full Name <span className="text-sev-high">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Marcus Bell"
                      value={patient.name}
                      onChange={(e) =>
                        setPatient({ ...patient, name: e.target.value })
                      }
                      className="w-full rounded-lg border border-line bg-paper px-3.5 py-2 text-xs text-ink outline-none transition-all placeholder:text-mute/60 focus:border-brand focus:ring-2 focus:ring-brand/15"
                    />
                  </div>

                  {/* Patient ID (MRN) */}
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-ink/80 mb-1">
                      Patient ID / MRN <span className="text-sev-high">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PAT-2049"
                      value={patient.patient_id}
                      onChange={(e) =>
                        setPatient({ ...patient, patient_id: e.target.value })
                      }
                      className="w-full rounded-lg border border-line bg-paper px-3.5 py-2 text-xs font-mono text-ink outline-none transition-all placeholder:text-mute/60 focus:border-brand focus:ring-2 focus:ring-brand/15"
                    />
                  </div>

                  {/* Mobile Number for WhatsApp */}
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-ink/80 mb-1">
                      WhatsApp Mobile Number <span className="text-sev-high">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +91 98765 43210"
                      value={patient.mobile_number}
                      onChange={(e) =>
                        setPatient({ ...patient, mobile_number: e.target.value })
                      }
                      className="w-full rounded-lg border border-line bg-paper px-3.5 py-2 text-xs font-mono text-ink outline-none transition-all placeholder:text-mute/60 focus:border-brand focus:ring-2 focus:ring-brand/15"
                    />
                  </div>

                  {/* Age */}
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-ink/80 mb-1">
                      Age (Years) <span className="text-sev-high">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="125"
                      required
                      placeholder="e.g. 58"
                      value={patient.age || ""}
                      onChange={(e) =>
                        setPatient({
                          ...patient,
                          age: e.target.value === "" ? ("" as any) : parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full rounded-lg border border-line bg-paper px-3.5 py-2 text-xs font-mono text-ink outline-none transition-all placeholder:text-mute/60 focus:border-brand focus:ring-2 focus:ring-brand/15"
                    />
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-ink/80 mb-1">
                      Gender <span className="text-sev-high">*</span>
                    </label>
                    <select
                      value={patient.gender}
                      onChange={(e) =>
                        setPatient({ ...patient, gender: e.target.value as any })
                      }
                      className="w-full rounded-lg border border-line bg-paper px-3.5 py-2 text-xs text-ink outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/15"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Date of Birth */}
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-ink/80 mb-1">
                      Date of Birth (DOB) <span className="text-sev-high">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={patient.dob}
                      onChange={(e) =>
                        setPatient({ ...patient, dob: e.target.value })
                      }
                      className="w-full rounded-lg border border-line bg-paper px-3.5 py-2 text-xs font-mono text-ink outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/15"
                    />
                  </div>

                  {/* Date of Visit */}
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-ink/80 mb-1">
                      Date of Visit <span className="text-sev-high">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={patient.visit_date || new Date().toISOString().slice(0, 10)}
                      onChange={(e) =>
                        setPatient({ ...patient, visit_date: e.target.value })
                      }
                      className="w-full rounded-lg border border-line bg-paper px-3.5 py-2 text-xs font-mono text-ink outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/15"
                    />
                  </div>
                </div>
              </section>

              {/* Real Audio Upload Section */}
              <section className="rounded-2xl bg-surface p-6 ring-1 ring-black/5 shadow-xs">
                <div className="border-b border-line pb-4 mb-5">
                  <div className="flex items-center gap-2">
                    <span className="grid size-6 place-items-center rounded-md bg-brand/10 text-brand font-mono text-xs font-bold">
                      2
                    </span>
                    <h2 className="font-display text-base font-semibold text-ink">
                      Respiratory Sound Recording
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-mute">
                    Upload digital stethoscope recording (.wav, .mp3, .flac).
                  </p>
                </div>

                {!audioFile ? (
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-paper/50 p-8 text-center transition-colors hover:border-brand hover:bg-brand-soft/20"
                  >
                    <div className="grid size-12 place-items-center rounded-full bg-surface shadow-xs mb-3 text-brand">
                      <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <path d="M12 3v12M8 7l4-4 4 4M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-ink">
                      Click to browse or drop stethoscope recording
                    </p>
                    <p className="mt-1 text-xs text-mute font-mono">
                      Supported formats: WAV (16/44.1 kHz), MP3, FLAC
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-line bg-paper p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="grid size-10 place-items-center rounded-lg bg-brand text-surface">
                          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 18V5l12-2v13" />
                            <circle cx="6" cy="18" r="3" />
                            <circle cx="18" cy="16" r="3" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-ink truncate max-w-xs">
                            {audioFile.name}
                          </p>
                          <p className="text-[11px] font-mono text-mute">
                            {(audioFile.size / 1024).toFixed(1)} KB · {audioMetrics.duration} · {audioMetrics.sampleRate}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          className="cursor-pointer rounded-md bg-surface px-2.5 py-1 text-xs font-medium text-ink ring-1 ring-line hover:bg-paper"
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAudioFile(null);
                            if (audioPreviewUrl) {
                              URL.revokeObjectURL(audioPreviewUrl);
                              setAudioPreviewUrl(null);
                            }
                          }}
                          className="cursor-pointer rounded-md bg-sev-high/10 px-2.5 py-1 text-xs font-medium text-sev-high hover:bg-sev-high/20"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* Audio Player Preview */}
                    {audioPreviewUrl && (
                      <div className="mt-4 pt-3 border-t border-line">
                        <audio controls src={audioPreviewUrl} className="w-full h-8" />
                      </div>
                    )}
                  </div>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*,.wav,.mp3,.flac,.ogg"
                  className="hidden"
                  onChange={handleAudioSelect}
                />
              </section>
            </div>

            {/* Right Column: Execution Panel & Diagnostic Summary */}
            <div className="space-y-6">
              <section className="rounded-2xl bg-surface p-6 ring-1 ring-black/5 shadow-xs">
                <h3 className="font-display text-sm font-semibold text-ink mb-1">
                  Ready to Analyze
                </h3>
                <p className="text-xs text-mute mb-5">
                  The analysis will extract AST spectrogram features, classify across 6 categories, and generate a Gemini clinical report.
                </p>

                {/* Validation Checklist */}
                <div className="space-y-2.5 text-xs rounded-xl bg-paper p-4 ring-1 ring-line mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-mute">Patient Information</span>
                    <span className={patient.name.trim() && patient.patient_id.trim() ? "text-sev-low font-medium" : "text-mute"}>
                      {patient.name.trim() && patient.patient_id.trim() ? "✓ Completed" : "Required"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-mute">WhatsApp Mobile</span>
                    <span className={patient.mobile_number.trim().length >= 7 ? "text-sev-low font-medium" : "text-mute"}>
                      {patient.mobile_number.trim().length >= 7 ? "✓ Validated" : "Required"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-mute">Age & DOB</span>
                    <span className={patient.age !== ("" as any) && patient.dob ? "text-sev-low font-medium" : "text-mute"}>
                      {patient.age !== ("" as any) && patient.dob ? "✓ Provided" : "Required"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-mute">Audio Recording</span>
                    <span className={audioFile ? "text-sev-low font-medium" : "text-mute"}>
                      {audioFile ? `✓ ${audioFile.name.slice(0, 16)}...` : "Required"}
                    </span>
                  </div>
                </div>

                {/* Prominent Analyze Button */}
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!isFormValid}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-surface shadow-xs transition-all hover:opacity-95 focus:ring-2 focus:ring-brand/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span>Start AI Analysis</span>
                </button>

                <p className="mt-3 text-center font-mono text-[10px] text-mute">
                  FastAPI Backend · AST Audio Spectrogram Transformer
                </p>
              </section>

              {/* Supported Diagnostic Classes Overview */}
              <section className="rounded-2xl bg-surface p-5 ring-1 ring-black/5 shadow-xs">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute mb-3">
                  Screening Target Classes
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {["Bronchiectasis", "Bronchiolitis", "COPD", "Healthy", "Pneumonia", "URTI"].map((c) => (
                    <div key={c} className="flex items-center gap-2 rounded-lg bg-paper p-2 ring-1 ring-line">
                      <span className="size-1.5 rounded-full bg-brand" />
                      <span className="font-medium text-ink/80">{c}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
