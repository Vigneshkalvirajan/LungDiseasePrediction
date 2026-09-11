import jsPDF from "jspdf";
import { PatientInfo, PredictionResult, RespiratoryReport } from "../types";

export interface GeneratePdfParams {
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
}

export function generateClinicalReportPdf({
  patient,
  prediction,
  report,
  audioFilename = "Auscultation_Recording.wav",
}: GeneratePdfParams): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = 18;

  // Primary Colors
  const brandTeal = [15, 118, 110]; // #0f766e
  const inkDark = [30, 41, 59]; // #1e293b
  const textMute = [100, 116, 139]; // #64748b
  const borderLight = [226, 232, 240]; // #e2e8f0
  const bgLight = [248, 250, 252]; // #f8fafc

  // 1. Header Banner
  doc.setFillColor(brandTeal[0], brandTeal[1], brandTeal[2]);
  doc.roundedRect(margin, y, 12, 12, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("R", margin + 3.8, y + 8.5);

  doc.setTextColor(inkDark[0], inkDark[1], inkDark[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("RespiraAI Diagnostic Report", margin + 16, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(textMute[0], textMute[1], textMute[2]);
  doc.text("AI-Assisted Stethoscope Auscultation & Sound Analysis", margin + 16, y + 11);

  const visitDateFormatted = patient.visit_date || new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  doc.text(`Date of Visit: ${visitDateFormatted}`, pageWidth - margin - 50, y + 6);
  doc.text(`Patient ID: ${patient.patient_id}`, pageWidth - margin - 50, y + 11);

  y += 18;

  // Divider Line
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  y += 6;

  // 2. Patient Demographics Box
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.roundedRect(margin, y, pageWidth - 2 * margin, 24, 2, 2, "F");
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.roundedRect(margin, y, pageWidth - 2 * margin, 24, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(inkDark[0], inkDark[1], inkDark[2]);

  // Col 1
  doc.text("Patient Name:", margin + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.text(patient.name || "N/A", margin + 28, y + 6);

  doc.setFont("helvetica", "bold");
  doc.text("Patient ID:", margin + 4, y + 12);
  doc.setFont("helvetica", "normal");
  doc.text(patient.patient_id || "N/A", margin + 28, y + 12);

  doc.setFont("helvetica", "bold");
  doc.text("Age / Gender:", margin + 4, y + 18);
  doc.setFont("helvetica", "normal");
  doc.text(`${patient.age} yrs / ${patient.gender}`, margin + 28, y + 18);

  // Col 2
  const col2X = margin + 95;
  doc.setFont("helvetica", "bold");
  doc.text("Mobile / WhatsApp:", col2X, y + 6);
  doc.setFont("helvetica", "normal");
  doc.text(patient.mobile_number || "Not specified", col2X + 32, y + 6);

  doc.setFont("helvetica", "bold");
  doc.text("Date of Visit:", col2X, y + 12);
  doc.setFont("helvetica", "normal");
  doc.text(visitDateFormatted, col2X + 32, y + 12);

  doc.setFont("helvetica", "bold");
  doc.text("Recording File:", col2X, y + 18);
  doc.setFont("helvetica", "normal");
  doc.text(audioFilename.length > 22 ? audioFilename.slice(0, 20) + "..." : audioFilename, col2X + 32, y + 18);

  y += 30;

  // 3. Primary Diagnostic Finding Badge (No percentage numbers)
  const predClass = prediction?.predicted_class || "Undetermined";
  const statusCategory = predClass === "Healthy" ? "Normal / Clear" : "Clinical Auscultation Finding";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(brandTeal[0], brandTeal[1], brandTeal[2]);
  doc.text("PRIMARY DIAGNOSTIC FINDING", margin, y);

  y += 5;

  doc.setFillColor(240, 253, 250); // teal-50
  doc.setDrawColor(204, 251, 241); // teal-100
  doc.roundedRect(margin, y, pageWidth - 2 * margin, 15, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(brandTeal[0], brandTeal[1], brandTeal[2]);
  doc.text(predClass, margin + 4, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(inkDark[0], inkDark[1], inkDark[2]);
  doc.text(`Category: ${statusCategory} · Evaluated via AST Spectrogram Classifier`, margin + 4, y + 12);

  y += 21;

  // 4. Acoustic Detection Rationale (Why Model Detected this Condition)
  const rationale =
    report?.detection_rationale ||
    report?.respiratory_sound_context ||
    `Acoustic spectrogram evaluation identified signature frequency bands, harmonic structures, and airflow traits characteristic of ${predClass}.`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(brandTeal[0], brandTeal[1], brandTeal[2]);
  doc.text(`Why the Model Detected ${predClass}`, margin, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(inkDark[0], inkDark[1], inkDark[2]);
  const splitRationale = doc.splitTextToSize(rationale, pageWidth - 2 * margin);
  doc.text(splitRationale, margin, y);
  y += splitRationale.length * 4 + 4;

  // 5. Longitudinal Patient Health Journey & Progression (if returning patient)
  const longitudinal = report?.longitudinal_progression;
  const isReturning = Boolean(
    longitudinal?.is_returning_patient ||
    longitudinal?.previous_diagnosis ||
    (longitudinal?.previous_visits && longitudinal.previous_visits.length > 0)
  );

  if (isReturning && longitudinal) {
    const trend = longitudinal.trend || longitudinal.health_status_trend || "Comparison";
    const trendLabel =
      trend === "cured" ? "Full Recovery / Cured" : trend === "improved" ? "Condition Improved" : trend;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(brandTeal[0], brandTeal[1], brandTeal[2]);
    doc.text(`Patient Health Journey & Longitudinal Progression (${trendLabel})`, margin, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(inkDark[0], inkDark[1], inkDark[2]);

    if (longitudinal.previous_visits && longitudinal.previous_visits.length > 0) {
      let timelineText = longitudinal.previous_visits.map((v, i) => `Previous Visit ${i+1} (${v.visit_date}): ${v.diagnosed_disease}`).join("  →  ");
      timelineText += `  →  Current Visit (${visitDateFormatted}): ${predClass} (${trendLabel})`;
      const splitTimeline = doc.splitTextToSize(timelineText, pageWidth - 2 * margin);
      doc.text(splitTimeline, margin, y);
      y += splitTimeline.length * 4 + 2;
    }

    const narrative = longitudinal.progression_summary || longitudinal.progression_narrative;
    if (narrative) {
      const splitNarrative = doc.splitTextToSize(`Clinical Progress: ${narrative}`, pageWidth - 2 * margin);
      doc.text(splitNarrative, margin, y);
      y += splitNarrative.length * 4 + 4;
    }
  }

  // 6. Clinical Interpretation
  let interpretation = "";
  if (report) {
    if (typeof report.analysis_summary === "object" && report.analysis_summary.overall_interpretation) {
      interpretation = report.analysis_summary.overall_interpretation;
    } else if (report.interpretation) {
      interpretation = report.interpretation;
    }
  }

  if (interpretation) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(inkDark[0], inkDark[1], inkDark[2]);
    doc.text("Clinical Interpretation", margin, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(inkDark[0], inkDark[1], inkDark[2]);
    const splitInterp = doc.splitTextToSize(interpretation, pageWidth - 2 * margin);
    doc.text(splitInterp, margin, y);
    y += splitInterp.length * 4 + 4;
  }

  // 7. Actionable Clinical Recommendations
  if (report?.recommended_next_steps && report.recommended_next_steps.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(inkDark[0], inkDark[1], inkDark[2]);
    doc.text("Recommended Clinical Next Steps", margin, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(inkDark[0], inkDark[1], inkDark[2]);
    report.recommended_next_steps.forEach((step, idx) => {
      const stepText = `${idx + 1}. ${step}`;
      const splitStep = doc.splitTextToSize(stepText, pageWidth - 2 * margin);
      doc.text(splitStep, margin, y);
      y += splitStep.length * 4;
    });
    y += 4;
  }

  // 8. Medical Disclaimer Footer
  const disclaimer =
    report?.disclaimer ||
    "This report provides an AI-assisted respiratory sound classification/screening result and is not a confirmed medical diagnosis. Clinical evaluation and confirmation by a qualified healthcare professional are recommended.";

  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.line(margin, pageHeight - 22, pageWidth - margin, pageHeight - 22);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(textMute[0], textMute[1], textMute[2]);
  const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - 2 * margin);
  doc.text(splitDisclaimer, margin, pageHeight - 17);

  return doc;
}
