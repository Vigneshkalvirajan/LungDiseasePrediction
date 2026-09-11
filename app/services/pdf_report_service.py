import io
from typing import Dict, Any, Optional
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm

def generate_pdf_bytes_for_analysis(record: Dict[str, Any]) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm
    )

    styles = getSampleStyleSheet()
    
    # Custom Palette
    teal_brand = colors.HexColor("#0f766e")
    ink_dark = colors.HexColor("#1e293b")
    text_mute = colors.HexColor("#64748b")
    line_color = colors.HexColor("#e2e8f0")
    card_bg = colors.HexColor("#f8fafc")
    badge_bg = colors.HexColor("#f0fdfa")

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=ink_dark
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=text_mute
    )

    heading_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=teal_brand
    )

    body_style = ParagraphStyle(
        'BodyText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=ink_dark
    )

    disclaimer_style = ParagraphStyle(
        'DisclaimerText',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=7.5,
        leading=10,
        textColor=text_mute
    )

    elements = []

    # 1. Header
    visit_date_str = record.get('visit_date') or record.get('created_at', '')[:10]
    header_data = [
        [
            Paragraph("<b>RespiraAI · Respiratory Diagnostic Report</b><br/><font size='8' color='#64748b'>AI-Assisted Stethoscope Auscultation & Sound Analysis</font>", title_style),
            Paragraph(f"<b>Patient ID:</b> {record.get('patient_id', 'N/A')}<br/><b>Date of Visit:</b> {visit_date_str}", subtitle_style)
        ]
    ]
    header_table = Table(header_data, colWidths=[120 * mm, 60 * mm])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 4 * mm))
    elements.append(HRFlowable(width="100%", thickness=0.8, color=line_color, spaceBefore=2, spaceAfter=8))

    # 2. Patient Demographics Box
    demo_data = [
        [
            Paragraph(f"<b>Patient Name:</b> {record.get('name', 'N/A')}", body_style),
            Paragraph(f"<b>Mobile / WhatsApp:</b> {record.get('mobile_number', 'Not specified')}", body_style)
        ],
        [
            Paragraph(f"<b>Patient ID:</b> {record.get('patient_id', 'N/A')}", body_style),
            Paragraph(f"<b>Date of Visit:</b> {visit_date_str}", body_style)
        ],
        [
            Paragraph(f"<b>Age / Gender:</b> {record.get('age', 'N/A')} yrs / {record.get('gender', 'N/A')}", body_style),
            Paragraph(f"<b>Recording File:</b> {record.get('audio_filename', 'Auscultation_Audio.wav')}", body_style)
        ]
    ]
    demo_table = Table(demo_data, colWidths=[90 * mm, 90 * mm])
    demo_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), card_bg),
        ('BOX', (0, 0), (-1, -1), 0.5, line_color),
        ('INNERGRID', (0, 0), (-1, -1), 0.3, line_color),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(demo_table)
    elements.append(Spacer(1, 6 * mm))

    # 3. Diagnostic Finding Badge (Clean Diagnosis without probability %)
    pred_class = record.get('predicted_class', 'Undetermined')
    status_label = "Normal / Clear" if pred_class == "Healthy" else "Clinical Auscultation Finding"

    elements.append(Paragraph("PRIMARY DIAGNOSTIC FINDING", heading_style))
    elements.append(Spacer(1, 2 * mm))

    finding_data = [
        [
            Paragraph(f"<font size='13' color='#0f766e'><b>{pred_class}</b></font><br/><font size='8.5' color='#1e293b'>Category: <b>{status_label}</b> · Evaluated via AST Neural Spectrogram Classifier</font>", body_style)
        ]
    ]
    finding_table = Table(finding_data, colWidths=[180 * mm])
    finding_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), badge_bg),
        ('BOX', (0, 0), (-1, -1), 0.8, colors.HexColor("#ccfbf1")),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(finding_table)
    elements.append(Spacer(1, 5 * mm))

    # 4. Report Content
    rep = record.get('report') or {}
    
    # Acoustic Detection Rationale
    rationale = rep.get('detection_rationale') or rep.get('respiratory_sound_context') or (
        f"Acoustic spectrogram evaluation identified frequency dynamics, harmonic sound structures, and airflow traits characteristic of {pred_class}."
    )
    elements.append(Paragraph(f"Why the Model Detected {pred_class}", heading_style))
    elements.append(Spacer(1, 1.5 * mm))
    elements.append(Paragraph(rationale, body_style))
    elements.append(Spacer(1, 4 * mm))

    # Longitudinal Health Journey & Progression (if returning patient)
    longitudinal = rep.get('longitudinal_progression')
    if longitudinal and isinstance(longitudinal, dict) and longitudinal.get('is_returning_patient'):
        trend = longitudinal.get('health_status_trend') or "Follow-up Comparison"
        elements.append(Paragraph(f"Patient Health Journey & Progression ({trend})", heading_style))
        elements.append(Spacer(1, 1.5 * mm))
        
        # Table of previous visits
        prev_visits = longitudinal.get('previous_visits') or []
        if prev_visits:
            hist_rows = [
                [Paragraph("<b>Visit Date</b>", body_style), Paragraph("<b>Diagnosed Condition</b>", body_style), Paragraph("<b>Status</b>", body_style)]
            ]
            for v in prev_visits:
                hist_rows.append([
                    Paragraph(v.get('visit_date', 'Past'), body_style),
                    Paragraph(v.get('diagnosed_disease', 'Undetermined'), body_style),
                    Paragraph(v.get('status', 'Completed'), body_style)
                ])
            hist_rows.append([
                Paragraph(f"<b>{visit_date_str} (Current)</b>", body_style),
                Paragraph(f"<b>{pred_class}</b>", body_style),
                Paragraph(f"<b>{trend}</b>", body_style)
            ])
            hist_table = Table(hist_rows, colWidths=[50 * mm, 70 * mm, 60 * mm])
            hist_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ('BOX', (0, 0), (-1, -1), 0.5, line_color),
                ('INNERGRID', (0, 0), (-1, -1), 0.3, line_color),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ]))
            elements.append(hist_table)
            elements.append(Spacer(1, 2.5 * mm))

        prog_narrative = longitudinal.get('progression_narrative')
        if prog_narrative:
            elements.append(Paragraph(f"<b>Clinical Progression Narrative:</b> {prog_narrative}", body_style))
            elements.append(Spacer(1, 4 * mm))

    # Clinical Interpretation
    interp = rep.get('interpretation') or ""
    if isinstance(rep.get('analysis_summary'), dict):
        interp = rep['analysis_summary'].get('overall_interpretation') or interp

    if interp:
        elements.append(Paragraph("Clinical Interpretation", heading_style))
        elements.append(Spacer(1, 1.5 * mm))
        elements.append(Paragraph(interp, body_style))
        elements.append(Spacer(1, 4 * mm))

    # Actionable Next Steps
    steps = rep.get('recommended_next_steps') or []
    if steps:
        elements.append(Paragraph("Recommended Clinical Actions", heading_style))
        elements.append(Spacer(1, 1.5 * mm))
        for idx, s in enumerate(steps):
            elements.append(Paragraph(f"• <b>Step {idx+1}:</b> {s}", body_style))
            elements.append(Spacer(1, 1 * mm))
        elements.append(Spacer(1, 4 * mm))

    # 5. Disclaimer Footer
    disclaimer_text = rep.get('disclaimer') or (
        "This report provides an AI-assisted respiratory sound classification screening result and is not a confirmed medical diagnosis. "
        "Clinical evaluation and confirmation by a qualified healthcare professional are recommended."
    )
    elements.append(HRFlowable(width="100%", thickness=0.5, color=line_color, spaceBefore=4, spaceAfter=4))
    elements.append(Paragraph(disclaimer_text, disclaimer_style))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
