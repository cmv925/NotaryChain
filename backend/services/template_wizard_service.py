"""
Template Wizard Service
Generates formatted PDFs from template fields and provides AI suggestions.
"""

import os
import io
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

UPLOAD_DIR = "/tmp/notary_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _build_styles():
    """Create custom PDF styles."""
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='DocTitle', parent=styles['Title'],
        fontSize=18, spaceAfter=6, textColor=colors.HexColor('#1a1a2e'),
    ))
    styles.add(ParagraphStyle(
        name='DocSubtitle', parent=styles['Normal'],
        fontSize=10, alignment=TA_CENTER, textColor=colors.HexColor('#555555'),
        spaceAfter=20,
    ))
    styles.add(ParagraphStyle(
        name='SectionHead', parent=styles['Heading2'],
        fontSize=12, spaceBefore=16, spaceAfter=8,
        textColor=colors.HexColor('#1a1a2e'), borderWidth=0,
    ))
    styles.add(ParagraphStyle(
        name='FieldLabel', parent=styles['Normal'],
        fontSize=9, textColor=colors.HexColor('#666666'), spaceAfter=2,
    ))
    styles.add(ParagraphStyle(
        name='FieldValue', parent=styles['Normal'],
        fontSize=11, textColor=colors.HexColor('#1a1a1a'), spaceAfter=10,
        leading=14,
    ))
    styles.add(ParagraphStyle(
        name='BodyJustified', parent=styles['Normal'],
        fontSize=10, alignment=TA_JUSTIFY, leading=14, spaceAfter=8,
        textColor=colors.HexColor('#333333'),
    ))
    styles.add(ParagraphStyle(
        name='SignatureLine', parent=styles['Normal'],
        fontSize=10, spaceBefore=30, textColor=colors.HexColor('#333333'),
    ))
    styles.add(ParagraphStyle(
        name='Footer', parent=styles['Normal'],
        fontSize=8, alignment=TA_CENTER, textColor=colors.HexColor('#999999'),
    ))
    return styles


def generate_pdf(template: dict, field_values: dict) -> str:
    """
    Generate a professional legal PDF from template + filled field values.
    Returns the path to the generated PDF.
    """
    styles = _build_styles()
    filename = f"generated_{template['id']}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.pdf"
    filepath = os.path.join(UPLOAD_DIR, filename)

    doc = SimpleDocTemplate(
        filepath, pagesize=letter,
        leftMargin=1 * inch, rightMargin=1 * inch,
        topMargin=0.8 * inch, bottomMargin=0.8 * inch,
    )

    story = []

    # --- Header / Title ---
    story.append(Paragraph(template["name"].upper(), styles["DocTitle"]))
    story.append(Paragraph(
        f"Generated on {datetime.now(timezone.utc).strftime('%B %d, %Y')} &bull; NotaryChain Platform",
        styles["DocSubtitle"],
    ))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#1a1a2e'), spaceAfter=16))

    # --- Document Description ---
    story.append(Paragraph("DOCUMENT PURPOSE", styles["SectionHead"]))
    story.append(Paragraph(template.get("description", ""), styles["BodyJustified"]))
    story.append(Spacer(1, 12))

    # --- Field Sections ---
    story.append(Paragraph("DOCUMENT DETAILS", styles["SectionHead"]))

    for field in template.get("fields", []):
        fname = field["name"]
        flabel = field["label"]
        value = field_values.get(fname, "")
        if not value:
            continue

        # Format dates nicely
        if field.get("type") == "date" and value:
            try:
                from datetime import date as d
                parsed = d.fromisoformat(value)
                value = parsed.strftime("%B %d, %Y")
            except Exception:
                pass

        # Format numbers with commas for currency-like fields
        if field.get("type") == "number" and value:
            try:
                num = float(value)
                if num == int(num):
                    value = f"{int(num):,}"
                else:
                    value = f"{num:,.2f}"
            except Exception:
                pass

        story.append(Paragraph(flabel.upper(), styles["FieldLabel"]))

        # Long text gets justified paragraph, short values are inline
        if field.get("type") == "textarea":
            story.append(Paragraph(str(value), styles["BodyJustified"]))
        else:
            story.append(Paragraph(str(value), styles["FieldValue"]))

    # --- Signature Section ---
    story.append(Spacer(1, 24))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#cccccc'), spaceAfter=12))
    story.append(Paragraph("SIGNATURES", styles["SectionHead"]))

    signers_needed = template.get("signers_needed", 1)
    for i in range(signers_needed):
        sig_block = []
        sig_block.append(Spacer(1, 28))
        sig_block.append(HRFlowable(width="50%", thickness=0.5, color=colors.HexColor('#333333'), spaceAfter=4))
        sig_block.append(Paragraph(f"Signature (Party {i+1})", styles["SignatureLine"]))
        sig_block.append(Spacer(1, 4))
        sig_block.append(Paragraph("Date: _______________________", styles["SignatureLine"]))
        story.extend(sig_block)

    # --- Notarization Section ---
    if template.get("notarization_required"):
        story.append(Spacer(1, 24))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#cccccc'), spaceAfter=12))
        story.append(Paragraph("NOTARY ACKNOWLEDGMENT", styles["SectionHead"]))
        story.append(Paragraph(
            "State of _____________________ County of _____________________",
            styles["BodyJustified"],
        ))
        story.append(Paragraph(
            "On this _____ day of ______________, 20_____, before me, the undersigned notary public, "
            "personally appeared the above-named individual(s), proved to me through satisfactory evidence "
            "of identity to be the person(s) whose name(s) is/are signed on the preceding document, and "
            "acknowledged that he/she/they signed it voluntarily for its stated purpose.",
            styles["BodyJustified"],
        ))
        story.append(Spacer(1, 28))
        story.append(HRFlowable(width="50%", thickness=0.5, color=colors.HexColor('#333333'), spaceAfter=4))
        story.append(Paragraph("Notary Public Signature", styles["SignatureLine"]))
        story.append(Paragraph("Commission Expires: _______________", styles["SignatureLine"]))
        story.append(Paragraph("[NOTARY SEAL]", styles["SignatureLine"]))

    # --- Footer ---
    story.append(Spacer(1, 30))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#cccccc'), spaceAfter=8))
    story.append(Paragraph(
        f"This document was generated via NotaryChain &bull; Template: {template['name']} &bull; "
        f"Document ID: {filename.replace('.pdf', '')}",
        styles["Footer"],
    ))

    doc.build(story)
    return filepath


async def ai_suggest_field(
    api_key: str,
    template_name: str,
    field_label: str,
    field_context: dict,
    existing_values: dict,
) -> str:
    """Use Gemini to generate a professional suggestion for a template field."""
    context_str = "\n".join(
        f"- {k}: {v}" for k, v in existing_values.items() if v
    )

    chat = LlmChat(
        api_key=api_key,
        session_id=f"template_suggest_{field_label}",
        system_message=(
            "You are a legal document assistant for a notarization platform. "
            "Generate professional, legally appropriate text for document fields. "
            "Be concise and formal. Only return the field value — no explanations, "
            "no quotes, no markdown. Match the tone of official legal documents."
        ),
    )

    prompt = (
        f"Document type: {template_name}\n"
        f"Field to fill: {field_label}\n"
    )
    if context_str:
        prompt += f"\nAlready filled fields:\n{context_str}\n"
    prompt += (
        f"\nGenerate appropriate professional text for the '{field_label}' field. "
        "Keep it concise, formal, and legally sound."
    )

    response = await chat.send_message(UserMessage(text=prompt))
    return response.strip()
