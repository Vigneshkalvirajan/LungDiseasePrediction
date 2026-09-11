"use client";

import React, { useState } from "react";
import {
  FileText,
  Printer,
  Copy,
  Check,
  Download,
  AlertTriangle,
  Stethoscope,
  Activity,
  User,
  ListOrdered,
  ShieldAlert,
  Info,
  Sparkles,
} from "lucide-react";
import { RespiratoryReport, PredictionResult } from "../types";

interface ClinicalReportViewProps {
  report: RespiratoryReport;
  prediction?: PredictionResult;
  audioFilename?: string;
}

export default function ClinicalReportView({
  report,
  prediction,
  audioFilename,
}: ClinicalReportViewProps) {
  const [copied, setCopied] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    const summaryText =
      typeof report.analysis_summary === "object"
        ? `Predicted: ${report.analysis_summary.predicted_category} (${(
            report.analysis_summary.confidence * 100
          ).toFixed(1)}%)\n${report.analysis_summary.overall_interpretation}`
        : report.analysis_summary;

    const probText =
      typeof report.probability_analysis === "object"
        ? Object.entries(report.probability_analysis)
            .map(([cls, p]) => `${cls}: ${((p as number) * 100).toFixed(1)}%`)
            .join(", ")
        : report.probability_analysis;

    const limText = Array.isArray(report.limitations)
      ? report.limitations.map((lim) => `- ${lim}`).join("\n")
      : report.limitations;

    const text = `
=========================================
VOXMED / BREATHE EASY AI - CLINICAL REPORT
=========================================
${report.report_title}

PATIENT INFORMATION:
- Name: ${report.patient_information?.name || "N/A"}
- Age: ${report.patient_information?.age || "N/A"}
- Gender: ${report.patient_information?.gender || "N/A"}
- Patient ID / MRN: ${report.patient_information?.patient_id || "N/A"}
- Audio Source: ${audioFilename || "Uploaded Stethoscope Audio"}

ANALYSIS SUMMARY:
${summaryText}

PROBABILITY ANALYSIS:
${probText}

DIAGNOSTIC INTERPRETATION:
${report.interpretation}

RESPIRATORY SOUND CONTEXT:
${report.respiratory_sound_context}

GENERAL CLINICAL CONTEXT:
${report.general_clinical_context}

RECOMMENDED NEXT STEPS:
${report.recommended_next_steps?.map((step, idx) => `${idx + 1}. ${step}`).join("\n")}

LIMITATIONS:
${limText}

DISCLAIMER:
${report.disclaimer}
=========================================
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `voxmed_report_${report.patient_information?.patient_id || "patient"}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="glass-panel-glow rounded-3xl p-6 md:p-8 shadow-2xl relative space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80 no-print">
        <div className="flex items-center space-x-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-cyan-600 to-teal-500 flex items-center justify-center text-slate-950 shadow-lg shadow-cyan-500/25">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-bold text-white">
                AI Clinical Respiratory Report
              </h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/60">
                Gemini Powered
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Structured multi-parameter auscultation analysis
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 transition"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-cyan-400" />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadJson}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 transition"
          >
            <Download className="h-3.5 w-3.5 text-teal-400" />
            <span>JSON</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-slate-950 text-xs font-semibold shadow-md shadow-cyan-600/20 transition"
          >
            <Printer className="h-3.5 w-3.5 fill-slate-950" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Report Title & Metadata Banner */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">
              Official Diagnostic Brief
            </span>
            <h2 className="text-xl font-bold text-white mt-0.5">
              {report.report_title}
            </h2>
          </div>
          {prediction && (
            <div className="flex items-center space-x-2 bg-slate-950/80 px-3.5 py-1.5 rounded-xl border border-cyan-500/30">
              <Activity className="h-4 w-4 text-cyan-400" />
              <div className="text-xs">
                <span className="text-slate-400 font-medium">Model Match: </span>
                <span className="text-cyan-300 font-bold">
                  {prediction.predicted_class} ({(prediction.confidence * 100).toFixed(1)}%)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Patient Demographics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Patient Name</span>
            <span className="font-semibold text-slate-100">
              {report.patient_information?.name || "N/A"}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 block text-[11px]">MRN / ID</span>
            <span className="font-semibold font-mono text-cyan-300">
              {report.patient_information?.patient_id || "N/A"}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Age & Gender</span>
            <span className="font-semibold text-slate-100">
              {report.patient_information?.age} yrs • {report.patient_information?.gender}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Audio File</span>
            <span className="font-semibold text-slate-300 truncate block">
              {audioFilename || "Stethoscope Auscultation"}
            </span>
          </div>
        </div>
      </div>

      {/* 1. Analysis Summary */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center space-x-1.5">
          <FileText className="h-4 w-4" />
          <span>1. Executive Analysis Summary</span>
        </h4>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/90 text-sm leading-relaxed text-slate-200">
          {typeof report.analysis_summary === "object" ? (
            <div className="space-y-1.5">
              <div className="font-semibold text-cyan-300">
                Predicted: {report.analysis_summary.predicted_category} (
                {(report.analysis_summary.confidence * 100).toFixed(1)}% Confidence)
              </div>
              <p>{report.analysis_summary.overall_interpretation}</p>
            </div>
          ) : (
            <p>{report.analysis_summary}</p>
          )}
        </div>
      </div>

      {/* 2. Probability Analysis */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center space-x-1.5">
          <Activity className="h-4 w-4" />
          <span>2. Model Probability & Softmax Distribution</span>
        </h4>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/90 text-sm leading-relaxed text-slate-200">
          {typeof report.probability_analysis === "object" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(report.probability_analysis).map(([cls, prob]) => (
                <div
                  key={cls}
                  className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-xs flex justify-between"
                >
                  <span className="text-slate-300">{cls}</span>
                  <span className="font-mono text-cyan-300 font-semibold">
                    {((prob as number) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p>{report.probability_analysis}</p>
          )}
        </div>
      </div>

      {/* 3. Diagnostic Interpretation */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
          <Stethoscope className="h-4 w-4" />
          <span>3. Diagnostic Acoustic Interpretation</span>
        </h4>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/90 text-sm leading-relaxed text-slate-200">
          {report.interpretation}
        </div>
      </div>

      {/* 4. Respiratory Sound Context */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-1.5">
          <Info className="h-4 w-4" />
          <span>4. Auscultation Acoustic Characteristics (Wheezes/Crackles)</span>
        </h4>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/90 text-sm leading-relaxed text-slate-200">
          {report.respiratory_sound_context}
        </div>
      </div>

      {/* 5. General Clinical Context */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center space-x-1.5">
          <User className="h-4 w-4" />
          <span>5. Patient-Specific Clinical & Pathological Context</span>
        </h4>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/90 text-sm leading-relaxed text-slate-200">
          {report.general_clinical_context}
        </div>
      </div>

      {/* 6. Recommended Next Steps */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
          <ListOrdered className="h-4 w-4" />
          <span>6. Recommended Actionable Next Steps</span>
        </h4>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/90 space-y-2.5">
          {report.recommended_next_steps?.map((step, idx) => (
            <div key={idx} className="flex items-start space-x-3 text-sm text-slate-200">
              <span className="flex-shrink-0 h-6 w-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold text-xs flex items-center justify-center">
                {idx + 1}
              </span>
              <p className="pt-0.5 leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 7. Diagnostic Limitations */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center space-x-1.5">
          <AlertTriangle className="h-4 w-4" />
          <span>7. Technical & Diagnostic Limitations</span>
        </h4>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/90 space-y-2">
          {Array.isArray(report.limitations) ? (
            report.limitations.map((lim, idx) => (
              <div key={idx} className="flex items-start space-x-2.5 text-xs text-slate-300">
                <span className="text-rose-400 font-bold">•</span>
                <p className="leading-relaxed">{lim}</p>
              </div>
            ))
          ) : (
            <div className="text-xs text-slate-300 leading-relaxed">
              {report.limitations}
            </div>
          )}
        </div>
      </div>

      {/* 8. Medical Disclaimer */}
      <div className="p-4 rounded-xl bg-rose-950/25 border border-rose-900/40 text-xs text-rose-300/90 flex items-start space-x-3">
        <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold uppercase tracking-wider text-rose-300 block">
            Medical AI Advisory & Disclaimer
          </span>
          <p className="leading-relaxed">{report.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}
