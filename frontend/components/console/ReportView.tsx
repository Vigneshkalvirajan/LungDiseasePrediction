"use client";

import React, { useState } from "react";
import { PredictionResult, RespiratoryReport, PatientInfo } from "../../types";
import { WhatsAppModal } from "./WhatsAppModal";
import { PatientChatDrawer } from "./PatientChatDrawer";
import { generateClinicalReportPdf } from "../../services/pdfService";

export type Severity = "low" | "mid" | "high";

export const severityBar: Record<Severity, string> = {
  low: "bg-sev-low",
  mid: "bg-sev-mid",
  high: "bg-sev-high",
};

export const severityDot: Record<Severity, string> = {
  low: "bg-sev-low",
  mid: "bg-sev-mid",
  high: "bg-sev-high",
};

export const severityText: Record<Severity, string> = {
  low: "text-sev-low",
  mid: "text-sev-mid",
  high: "text-sev-high",
};

export const severityLabel: Record<Severity, string> = {
  low: "Clear / Normal",
  mid: "Moderate Finding",
  high: "Significant Finding",
};

interface ReportViewProps {
  patient: PatientInfo | {
    patient_id: string;
    name: string;
    age: number;
    gender: string;
    mobile_number?: string;
    dob?: string;
    visit_date?: string;
  };
  prediction: PredictionResult | null;
  report: RespiratoryReport | null;
  audioFilename?: string;
  onBack: () => void;
  onSendWhatsApp?: () => void;
}

export function ReportView({
  patient,
  prediction,
  report,
  audioFilename = "Respiratory_Auscultation.wav",
  onBack,
  onSendWhatsApp,
}: ReportViewProps) {
  const [internalWhatsAppOpen, setInternalWhatsAppOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Determine severity based on predicted class
  const predictedClass = prediction?.predicted_class || "Healthy";

  const severity: Severity =
    predictedClass === "Healthy"
      ? "low"
      : predictedClass === "URTI" || predictedClass === "Bronchiolitis"
      ? "mid"
      : "high";

  // Finding title & summary from real report or model output (definitive, no % badges)
  const findingTitle =
    predictedClass === "Healthy"
      ? "Healthy — Normal Vesicular Breath Sounds"
      : `${predictedClass} — Diagnosed Respiratory Condition`;

  const findingSummary =
    typeof report?.analysis_summary === "object"
      ? report.analysis_summary.overall_interpretation
      : report?.interpretation ||
        `Deep neural acoustic feature analysis with AST Transformer and 1D-CNN confirmed findings of ${predictedClass}.`;

  const recommendation =
    report?.recommended_next_steps && report.recommended_next_steps.length > 0
      ? report.recommended_next_steps
      : ["Recommend clinical correlation, spirometry evaluation, and follow-up consultation with primary physician."];

  const formattedDate = new Date().toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const displayVisitDate = patient.visit_date || formattedDate;

  // Longitudinal progression details (robust resolution for returning patients)
  const prog = report?.longitudinal_progression;
  const latestPrev = prog?.previous_visits && prog.previous_visits.length > 0 ? prog.previous_visits[0] : null;
  const previousDiagnosis = prog?.previous_diagnosis || latestPrev?.diagnosed_disease || null;
  const previousVisitDate = prog?.previous_visit_date || latestPrev?.visit_date || null;
  const isReturningPatient = Boolean(
    prog?.is_returning_patient ||
    previousDiagnosis ||
    (prog?.previous_visits && prog.previous_visits.length > 0)
  );

  const prevDiagDisplay = previousDiagnosis || "Previous Record";
  const prevDateDisplay = previousVisitDate || "Earlier Visit";

  const computedTrend =
    prog?.trend ||
    (predictedClass === "Healthy" && prevDiagDisplay !== "Healthy"
      ? "cured"
      : predictedClass !== "Healthy" && prevDiagDisplay === "Healthy"
      ? "deteriorated"
      : predictedClass === prevDiagDisplay
      ? "stable"
      : "improved");

  const hasDiagnosisChanged = isReturningPatient && previousDiagnosis && previousDiagnosis !== predictedClass;

  function handleOpenWhatsApp() {
    if (onSendWhatsApp) {
      onSendWhatsApp();
    } else {
      setInternalWhatsAppOpen(true);
    }
  }

  return (
    <div className="min-w-0 flex-1">
      {/* Top Action Bar */}
      <header className="no-print flex items-center justify-between gap-4 border-b border-line bg-surface/80 px-6 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-mono text-[11px] text-mute">
            {patient.patient_id}
          </span>
          <span className="size-1 rounded-full bg-line" />
          <span className="truncate text-sm font-medium">
            Report · {patient.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="cursor-pointer rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper transition-colors"
          >
            ← Back
          </button>


          <button
            type="button"
            onClick={() => {
              const pdfDoc = generateClinicalReportPdf({
                patient,
                prediction,
                report,
                audioFilename,
              });
              const fileName = `RespiraAI_Report_${(patient.patient_id || "PAT").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
              pdfDoc.save(fileName);
            }}
            className="flex cursor-pointer items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-surface hover:opacity-90 transition-opacity shadow-xs"
          >
            <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v7H8z" />
            </svg>
            Download PDF
          </button>
        </div>
      </header>

      {/* Main Report Document */}
      <div className="p-6">
        <article className="mx-auto max-w-3xl rounded-2xl bg-surface p-8 ring-1 ring-black/5 shadow-sm">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-line pb-5">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-lg bg-brand font-display text-sm font-semibold text-surface">
                R
              </div>
              <div className="leading-tight">
                <h1 className="font-display text-lg font-semibold text-ink">
                  {report?.report_title || "RespiraAI — Respiratory Sound Analysis Report"}
                </h1>
                <p className="font-mono text-[11px] text-mute">
                  ID: {patient.patient_id} · Date of Visit: {displayVisitDate} · RespiraAI Workstation
                </p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${severityText[severity]} bg-paper ring-1 ring-line`}>
              <span className={`size-1.5 rounded-full ${severityDot[severity]}`} />
              {severityLabel[severity]}
            </span>
          </div>

          {/* Patient Demographics Table */}
          <section className="grid grid-cols-2 gap-x-8 gap-y-3 py-5 text-xs">
            <div className="flex justify-between border-b border-line pb-2">
              <span className="text-mute">Patient Name</span>
              <span className="font-medium text-ink">{patient.name}</span>
            </div>
            <div className="flex justify-between border-b border-line pb-2">
              <span className="text-mute">Patient ID (MRN)</span>
              <span className="font-mono text-ink font-medium">{patient.patient_id}</span>
            </div>
            <div className="flex justify-between border-b border-line pb-2">
              <span className="text-mute">Age / Gender</span>
              <span className="font-medium text-ink">
                {patient.age} yrs · {patient.gender}
              </span>
            </div>
            <div className="flex justify-between border-b border-line pb-2">
              <span className="text-mute">Date of Visit</span>
              <span className="font-mono text-ink font-medium">{displayVisitDate}</span>
            </div>
            <div className="flex justify-between border-b border-line pb-2">
              <span className="text-mute">Date of Birth</span>
              <span className="font-mono text-ink">{patient.dob || "Not specified"}</span>
            </div>
            <div className="flex justify-between border-b border-line pb-2">
              <span className="text-mute">Mobile / WhatsApp</span>
              <span className="font-mono text-ink font-medium">
                {patient.mobile_number || "Not specified"}
              </span>
            </div>
            <div className="flex justify-between border-b border-line pb-2 col-span-2">
              <span className="text-mute">Auscultation Audio</span>
              <span className="font-mono text-ink truncate">
                {audioFilename}
              </span>
            </div>
          </section>

          {/* Primary Finding (Definitive, No Percentage) */}
          <section className="py-4 border-b border-line">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">Primary Diagnostic Finding</p>
            <p className="mt-1 font-display text-xl font-semibold text-ink">{findingTitle}</p>
            <p className="mt-2 text-xs text-ink/80 leading-relaxed">{findingSummary}</p>

            {/* Prominent Before vs After Transition Banner if diagnosis changed */}
            {hasDiagnosisChanged && (
              <div className="mt-3 rounded-lg border border-brand/20 bg-brand-soft/30 p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-ink">Health Status Shift:</span>
                  <span className="rounded bg-paper px-2 py-0.5 font-mono text-[11px] font-medium text-mute border border-line">
                    Previous: {prevDiagDisplay} ({prevDateDisplay})
                  </span>
                  <span className="text-brand font-bold">→</span>
                  <span className="rounded bg-brand-soft px-2 py-0.5 font-mono text-[11px] font-bold text-brand border border-brand/30">
                    Current: {predictedClass} ({displayVisitDate})
                  </span>
                </div>
                <span className={`font-semibold text-xs ${computedTrend === "cured" || computedTrend === "improved" ? "text-sev-low" : "text-brand"}`}>
                  {computedTrend === "cured" ? "✓ Full Recovery / Cured" : computedTrend === "improved" ? "✓ Improved" : "Condition Transition"}
                </span>
              </div>
            )}
          </section>

          {/* Longitudinal Health Journey & Progression Card (When previous records exist) */}
          {isReturningPatient && (
            <section className="my-5 rounded-xl border border-brand/20 bg-brand-soft/20 p-5">
              <div className="flex items-center justify-between mb-3 border-b border-brand/15 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-md bg-brand text-surface text-xs font-bold">
                    📈
                  </span>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-ink">
                      Longitudinal Patient Health Journey & Progression
                    </h3>
                    <p className="text-[11px] text-mute">
                      Historical comparison with previous hospital visit on {prevDateDisplay} ({prevDiagDisplay})
                    </p>
                  </div>
                </div>
                <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${
                  computedTrend === "improved" || computedTrend === "cured"
                    ? "bg-sev-low/20 text-sev-low border border-sev-low/30"
                    : computedTrend === "deteriorated"
                    ? "bg-sev-high/20 text-sev-high border border-sev-high/30"
                    : "bg-paper text-ink border border-line"
                }`}>
                  {computedTrend === "improved" || computedTrend === "cured"
                    ? "✓ Health Improved / Cured"
                    : computedTrend === "deteriorated"
                    ? "⚠ Condition Deteriorated"
                    : "↔ Stable Condition"}
                </span>
              </div>

              {/* Visual Progression Milestone Timeline */}
              <div className="my-4 rounded-lg bg-surface p-4 ring-1 ring-line">
                <div className="flex items-center justify-between relative">
                  {/* Timeline connector line */}
                  <div className="absolute left-1/4 right-1/4 top-1/2 h-0.5 -translate-y-1/2 bg-line -z-0" />
                  
                  {/* Step 1: Previous Visit */}
                  <div className="flex flex-col items-center text-center z-10 bg-surface px-2">
                    <span className="size-8 rounded-full border-2 border-mute/40 bg-paper flex items-center justify-center font-mono text-xs font-bold text-mute">
                      1
                    </span>
                    <span className="mt-1.5 font-mono text-[10px] text-mute">
                      {prevDateDisplay}
                    </span>
                    <span className="mt-0.5 rounded px-2 py-0.5 text-xs font-semibold bg-sev-mid/15 text-sev-mid border border-sev-mid/30">
                      {prevDiagDisplay}
                    </span>
                  </div>

                  {/* Transition Arrow / Trend Label */}
                  <div className="flex flex-col items-center z-10 bg-surface px-3">
                    <span className="text-xs font-bold text-brand font-mono">
                      {computedTrend === "cured" ? "→ Full Recovery →" : computedTrend === "improved" ? "→ Improvement →" : "→ Comparison →"}
                    </span>
                    <span className="text-[10px] text-mute">
                      Auscultation Shift
                    </span>
                  </div>

                  {/* Step 2: Current Visit */}
                  <div className="flex flex-col items-center text-center z-10 bg-surface px-2">
                    <span className={`size-8 rounded-full border-2 flex items-center justify-center font-mono text-xs font-bold ${
                      predictedClass === "Healthy"
                        ? "border-sev-low bg-sev-low/10 text-sev-low"
                        : "border-brand bg-brand-soft text-brand"
                    }`}>
                      2
                    </span>
                    <span className="mt-1.5 font-mono text-[10px] text-mute">
                      {displayVisitDate} (Today)
                    </span>
                    <span className={`mt-0.5 rounded px-2 py-0.5 text-xs font-semibold ${
                      predictedClass === "Healthy"
                        ? "bg-sev-low/20 text-sev-low border border-sev-low/30"
                        : "bg-brand/10 text-brand border border-brand/30"
                    }`}>
                      {predictedClass}
                    </span>
                  </div>
                </div>
              </div>

              {/* Clinical Progression Narrative */}
              <div className="space-y-2 text-xs">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-mute font-semibold">
                    Clinical Progression Summary
                  </p>
                  <p className="mt-1 text-ink/90 leading-relaxed">
                    {prog?.progression_summary ||
                      prog?.progression_narrative ||
                      (predictedClass === "Healthy" && prevDiagDisplay !== "Healthy"
                        ? `On ${prevDateDisplay}, the patient was diagnosed with ${prevDiagDisplay}. Present auscultation on ${displayVisitDate} reveals complete resolution of adventitious sounds with clear vesicular airflow, confirming that the patient is now healthy and has achieved full clinical recovery.`
                        : `Patient was diagnosed with ${prevDiagDisplay} on ${prevDateDisplay} and current evaluation on ${displayVisitDate} indicates transition to ${predictedClass}.`)}
                  </p>
                </div>
                {(prog?.acoustic_comparison || hasDiagnosisChanged) && (
                  <div className="rounded-md bg-paper p-2.5 text-[11px] text-ink/80 ring-1 ring-line">
                    <span className="font-semibold text-ink">Acoustic Differences: </span>
                    {prog?.acoustic_comparison ||
                      (predictedClass === "Healthy"
                        ? `Previous examination showed adventitious features of ${prevDiagDisplay}; current auscultation demonstrates soft, laminar vesicular breath sounds across all pulmonary zones without wheezes or crackles.`
                        : `Acoustic frequency dynamics demonstrate transition from ${prevDiagDisplay} characteristics to ${predictedClass} sound signatures.`)}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Why Model Detected This Disease (Acoustic Detection Rationale) */}
          <section className="mt-5 rounded-xl bg-brand-soft/40 border border-brand/20 p-4 text-xs space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="grid size-5 place-items-center rounded bg-brand text-surface font-mono text-[10px] font-bold">
                ✓
              </span>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand font-semibold">
                Why the Model Detected {predictedClass}
              </p>
            </div>
            <p className="text-ink/90 leading-relaxed pt-1">
              {report?.detection_rationale ||
                report?.respiratory_sound_context ||
                `The Audio Spectrogram Transformer (AST) neural model identified signature acoustic patterns associated with ${predictedClass} from this stethoscope recording, including specific frequency power distributions and adventitious breath traits.`}
            </p>
          </section>

          {/* Respiratory Acoustic Context */}
          {report?.respiratory_sound_context && (
            <section className="py-4 border-b border-line text-xs">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute mb-1">
                Acoustic Characteristics
              </p>
              <p className="text-ink/80 leading-relaxed">{report.respiratory_sound_context}</p>
            </section>
          )}

          {/* General Clinical Context */}
          {report?.general_clinical_context && (
            <section className="py-4 border-b border-line text-xs">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute mb-1">
                Clinical Context
              </p>
              <p className="text-ink/80 leading-relaxed">{report.general_clinical_context}</p>
            </section>
          )}

          {/* Actionable Clinical Recommendations */}
          <section className="mt-4 rounded-xl bg-paper p-4 ring-1 ring-line">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute mb-2 font-medium">
              Recommended Clinical Next Steps
            </p>
            <ul className="space-y-1.5 text-xs text-ink/90">
              {recommendation.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-brand font-bold">•</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Disclaimer */}
          <p className="mt-5 text-[10px] leading-relaxed text-mute/80 border-t border-line pt-4">
            {report?.disclaimer ||
              "This report provides an AI-assisted respiratory sound classification/screening result and is not a confirmed medical diagnosis. Clinical evaluation and confirmation by a qualified healthcare professional are recommended."}
          </p>
        </article>
      </div>

      {/* Internal WhatsApp Modal fallback */}
      <WhatsAppModal
        isOpen={internalWhatsAppOpen}
        onClose={() => setInternalWhatsAppOpen(false)}
        patient={patient}
        prediction={prediction}
        report={report}
      />
    </div>
  );
}
