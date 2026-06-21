"""
Ceremony Certificate PDF Generator
Auto-generates a professional certificate when consensus is APPROVED.
Includes QR code linking to public verification endpoint.
"""
import io
import hashlib
import os
import qrcode
from datetime import datetime, timezone

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT


def generate_ceremony_certificate(ceremony: dict, sovereign_seal: dict = None) -> bytes:
    """Generate a professional Ceremony Certificate PDF.

    If `sovereign_seal` is provided (the conducting notary's enabled Sovereign ID),
    a verifiable notary seal block + QR is stamped on the certificate.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.6 * inch, bottomMargin=0.6 * inch,
                            leftMargin=0.75 * inch, rightMargin=0.75 * inch)
    elements = []
    styles = getSampleStyleSheet()

    # -- Custom Styles --
    brand_dark = colors.HexColor("#0f1825")
    brand_blue = colors.HexColor("#3b82f6")
    brand_green = colors.HexColor("#10b981")
    brand_red = colors.HexColor("#ef4444")
    brand_gray = colors.HexColor("#6b7280")

    title_style = ParagraphStyle("CertTitle", parent=styles["Title"], fontSize=24, textColor=brand_dark,
                                 spaceAfter=4, alignment=TA_CENTER, fontName="Helvetica-Bold")
    subtitle_style = ParagraphStyle("CertSubtitle", parent=styles["Normal"], fontSize=11,
                                    textColor=brand_gray, spaceAfter=16, alignment=TA_CENTER)
    cert_id_style = ParagraphStyle("CertID", parent=styles["Normal"], fontSize=9,
                                   textColor=brand_blue, spaceAfter=4, alignment=TA_CENTER, fontName="Courier")
    section_head = ParagraphStyle("SectionHead", parent=styles["Heading2"], fontSize=13,
                                  textColor=brand_dark, spaceBefore=14, spaceAfter=6, fontName="Helvetica-Bold")
    small_style = ParagraphStyle("CertSmall", parent=styles["Normal"], fontSize=8,
                                 textColor=brand_gray, spaceAfter=2)

    consensus = ceremony.get("consensus", {})
    agents = ceremony.get("agents", {})
    seal = ceremony.get("blockchain_seal", {})
    cert_hash = hashlib.sha256(f"cert-{ceremony.get('ceremony_id', '')}-{ceremony.get('created_at', '')}".encode()).hexdigest()[:12].upper()

    # ===== HEADER =====
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("NOTARYCHAIN", ParagraphStyle("Brand", parent=styles["Normal"],
                               fontSize=11, textColor=brand_blue, alignment=TA_CENTER,
                               fontName="Helvetica-Bold", spaceAfter=2)))
    elements.append(Paragraph("NOTARIZATION CEREMONY CERTIFICATE", title_style))
    elements.append(Paragraph("Multi-Agent Verified &bull; Blockchain Sealed", subtitle_style))
    elements.append(Paragraph(f"Certificate ID: NC-{cert_hash}", cert_id_style))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=brand_blue, spaceAfter=12))

    # ===== DOCUMENT INFO =====
    elements.append(Paragraph("Document Information", section_head))
    info_data = [
        ["Document:", ceremony.get("document_name", "N/A")],
        ["Signer:", ceremony.get("signer_name", "N/A")],
        ["Initiated By:", ceremony.get("initiated_by_name", ceremony.get("initiated_by", "N/A"))],
        ["Ceremony ID:", ceremony.get("ceremony_id", "N/A")],
        ["Date:", _fmt_date(ceremony.get("created_at", ""))],
        ["Status:", ceremony.get("status", "").upper()],
    ]
    info_table = Table(info_data, colWidths=[1.5 * inch, 5.0 * inch])
    info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), brand_gray),
        ("TEXTCOLOR", (1, 0), (1, -1), brand_dark),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 8))

    # ===== AGENT VERDICTS =====
    elements.append(Paragraph("Agent Verification Results", section_head))

    agent_header = ["Agent", "Verdict", "Confidence", "Evidence Hash"]
    agent_rows = [agent_header]
    for name in ["verifier", "witness", "sealer"]:
        a = agents.get(name, {})
        verdict = a.get("verdict", "N/A")
        conf = f"{round(a.get('confidence', 0) * 100)}%" if a.get("confidence") else "N/A"
        ev_hash = a.get("evidence_hash", "N/A")
        agent_rows.append([name.capitalize(), verdict, conf, ev_hash])

    agent_table = Table(agent_rows, colWidths=[1.2 * inch, 1.0 * inch, 1.0 * inch, 3.3 * inch])
    agent_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), brand_dark),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
        ("ALIGN", (1, 1), (2, -1), "CENTER"),
        ("FONTNAME", (3, 1), (3, -1), "Courier"),
    ]))

    # Color verdict cells
    for i, name in enumerate(["verifier", "witness", "sealer"], start=1):
        verdict = agents.get(name, {}).get("verdict", "")
        if verdict == "PASS":
            agent_table.setStyle(TableStyle([("TEXTCOLOR", (1, i), (1, i), brand_green)]))
        elif verdict == "FAIL":
            agent_table.setStyle(TableStyle([("TEXTCOLOR", (1, i), (1, i), brand_red)]))

    elements.append(agent_table)
    elements.append(Spacer(1, 8))

    # Verifier details
    verifier_details = agents.get("verifier", {}).get("details", {})
    if verifier_details.get("ai_powered"):
        elements.append(Paragraph(f"<i>Verifier Agent powered by GPT-5.2 Vision &mdash; "
                                  f"Checks: {', '.join(verifier_details.get('checks_performed', []))}</i>", small_style))

    # ===== CONSENSUS =====
    elements.append(Paragraph("Consensus Oracle", section_head))
    result = consensus.get("result", "N/A")
    result_color = brand_green if result == "APPROVED" else brand_red

    consensus_data = [
        ["Result:", result],
        ["Vote Requirement:", f"{consensus.get('required_votes', 2)} of {consensus.get('total_votes', 3)}"],
        ["Pass Votes:", str(consensus.get("pass_count", 0))],
        ["Fail Votes:", str(consensus.get("fail_count", 0))],
        ["Decided At:", _fmt_date(consensus.get("decided_at", ""))],
    ]
    votes = consensus.get("votes", {})
    vote_str = ", ".join([f"{k.capitalize()}: {v}" for k, v in votes.items()])
    consensus_data.append(["Votes:", vote_str])

    cons_table = Table(consensus_data, colWidths=[1.5 * inch, 5.0 * inch])
    cons_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), brand_gray),
        ("TEXTCOLOR", (1, 0), (1, -1), brand_dark),
        ("TEXTCOLOR", (1, 0), (1, 0), result_color),
        ("FONTNAME", (1, 0), (1, 0), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(cons_table)
    elements.append(Spacer(1, 8))

    # ===== BLOCKCHAIN SEAL =====
    if seal:
        elements.append(Paragraph("Blockchain Seal", section_head))
        seal_data = [
            ["Network:", seal.get("network", "N/A")],
            ["Topic ID:", seal.get("topic_id", "N/A")],
        ]
        if seal.get("transaction_id"):
            seal_data.append(["Transaction ID:", seal["transaction_id"]])
        if seal.get("sequence_number") is not None:
            seal_data.append(["Sequence #:", str(seal["sequence_number"])])
        seal_data.append(["Consensus Hash:", seal.get("consensus_hash", "N/A")])
        seal_data.append(["HCS Submitted:", "Yes" if seal.get("hcs_submitted") else "No"])
        seal_data.append(["Sealed At:", _fmt_date(seal.get("sealed_at", ""))])
        if seal.get("explorer_url"):
            seal_data.append(["Explorer:", seal["explorer_url"]])

        seal_table = Table(seal_data, colWidths=[1.5 * inch, 5.0 * inch])
        seal_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("TEXTCOLOR", (0, 0), (0, -1), brand_gray),
            ("TEXTCOLOR", (1, 0), (1, -1), brand_dark),
            ("FONTNAME", (1, 0), (-1, -1), "Courier"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
        ]))
        elements.append(seal_table)

    # ===== NOTARY'S SOVEREIGN SEAL (verifiable digital seal) =====
    if sovereign_seal:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("Notary's Sovereign Seal", section_head))
        sov_qr_buf = io.BytesIO()
        sov_qr = qrcode.make(sovereign_seal["verify_url"], box_size=4, border=2)
        sov_qr.save(sov_qr_buf, format="PNG")
        sov_qr_buf.seek(0)
        sov_qr_flowable = Image(sov_qr_buf, width=1.1 * inch, height=1.1 * inch)
        commission_line = ""
        if sovereign_seal.get("license_number") or sovereign_seal.get("license_state"):
            commission_line = (
                f"<font size='7' color='#6b7280'>Commission "
                f"{sovereign_seal.get('license_number') or '—'} &bull; "
                f"{sovereign_seal.get('license_state') or '—'}</font><br/>"
            )
        sov_text = Paragraph(
            f"<b>{sovereign_seal['holder_name']}</b> &mdash; Verified Notary<br/>"
            f"{commission_line}"
            f"<font size='7' color='#6b7280'>Sovereign NFT: {sovereign_seal['token']}</font><br/>"
            f"<font size='7' color='#6b7280'>Ed25519: {sovereign_seal['fingerprint']}</font><br/>"
            f"<font size='8' color='#10b981'><b>Scan to verify this notary</b></font><br/>"
            f"<font size='6' color='#3b82f6'>{sovereign_seal['verify_url']}</font>",
            ParagraphStyle("SovText", parent=styles["Normal"], fontSize=9, textColor=brand_dark, leading=12),
        )
        sov_table = Table([[sov_qr_flowable, sov_text]], colWidths=[1.4 * inch, 5.1 * inch])
        sov_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (1, 0), (1, 0), 12),
            ("BOX", (0, 0), (-1, -1), 1, brand_green),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))
        elements.append(sov_table)

    # ===== QR CODE =====
    base_url = os.environ.get("REACT_APP_BACKEND_URL", "https://notarychain.com")
    verify_url = f"{base_url}/verify-certificate/NC-{cert_hash}"
    qr_buf = io.BytesIO()
    qr_img = qrcode.make(verify_url, box_size=4, border=2)
    qr_img.save(qr_buf, format="PNG")
    qr_buf.seek(0)
    qr_flowable = Image(qr_buf, width=1.1 * inch, height=1.1 * inch)

    qr_table = Table(
        [[qr_flowable, Paragraph(
            f"<b>Scan to Verify</b><br/>"
            f"<font size='7' color='#6b7280'>Certificate ID: NC-{cert_hash}</font><br/>"
            f"<font size='6' color='#3b82f6'>{verify_url}</font>",
            ParagraphStyle("QRText", parent=styles["Normal"], fontSize=9, textColor=brand_dark, leading=13),
        )]],
        colWidths=[1.4 * inch, 5.1 * inch],
    )
    qr_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (1, 0), (1, 0), 12),
    ]))
    elements.append(qr_table)
    elements.append(Spacer(1, 10))

    # ===== FOOTER =====
    elements.append(Spacer(1, 20))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e5e7eb")))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(
        f"This certificate was auto-generated by NotaryChain Ceremony Protocol on {datetime.now(timezone.utc).strftime('%B %d, %Y at %H:%M UTC')}. "
        f"The notarization was verified by a 3-agent consensus pipeline and sealed on Hedera Mainnet. "
        f"Verify this certificate at hashscan.io using the Transaction ID above.",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, textColor=brand_gray, alignment=TA_CENTER, leading=11),
    ))

    doc.build(elements)
    return buf.getvalue()


def _fmt_date(iso_str: str) -> str:
    if not iso_str:
        return "N/A"
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.strftime("%B %d, %Y at %H:%M UTC")
    except (ValueError, TypeError):
        return iso_str
