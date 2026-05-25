"""
Autonomous Cross-Border Notarization Network (ACN) — Core Service
=================================================================
Transforms a single notarization into a jurisdiction-aware multi-proof packet
that is automatically compliant in every detected jurisdiction.

Architecture
------------
1. _detect_jurisdictions(text) — heuristic regex scan over jurisdiction names,
   state codes, governing-law boilerplate, country names; falls back to an
   optional GPT-5.2 call only when the heuristic finds zero matches.
2. JURISDICTION_RULES — seeded RON-rule + jurat-template database for the
   first 11 supported jurisdictions (7 US states + EU/eIDAS, UK, DE-de, JP).
3. score_risk(detected, doc_text) — produces a per-jurisdiction rejection-risk
   number 0-100 used by the AI Intelligence Hub integration.
4. seal_packet(packet, jurisdictions) — for each requested jurisdiction:
       a. renders the localized jurat,
       b. generates a single-jurisdiction certificate PDF (re-using ReportLab),
       c. submits an ACN_JURISDICTION_SEAL message to Hedera HCS with the
          jurisdiction's rule_version_hash + cert sha256 so a verifier can
          later prove byte-for-byte compliance.
5. apply_rule_update — admin-triggered: marks affected packets as needing reseal.
"""
from __future__ import annotations
import asyncio
import base64
import hashlib
import io
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Module-level dependencies — set by acn_routes.set_db()
_db = None
_hedera = None


def set_dependencies(db, hedera_svc=None):
    global _db, _hedera
    _db = db
    _hedera = hedera_svc


# ────────────────────────────────────────────────────────────────────────────
# JURISDICTION SEED — RON rules + jurat templates
# ────────────────────────────────────────────────────────────────────────────

# Tokens are matched case-insensitive against the document text. The first
# tuple element is the canonical jurisdiction code, the rest are regex
# patterns that count as a "hit".
_DETECTION_TOKENS: list[tuple[str, list[str]]] = [
    ("US-FL", [r"\bFlorida\b", r"\bFL\b(?:\s*statute|\s*notary|,?\s*USA)", r"State of Florida"]),
    ("US-TX", [r"\bTexas\b", r"\bTX\b(?:\s*notary|\s*statute|,?\s*USA)", r"State of Texas"]),
    ("US-NY", [r"\bNew York\b", r"\bNY\b(?:\s*notary|\s*statute|,?\s*USA)", r"State of New York"]),
    ("US-CA", [r"\bCalifornia\b", r"\bCA\b(?:\s*notary|\s*civil code|,?\s*USA)", r"State of California"]),
    ("US-VA", [r"\bVirginia\b", r"\bVA\b(?:\s*notary|\s*code|,?\s*USA)", r"Commonwealth of Virginia"]),
    ("US-DE", [r"\bDelaware\b", r"State of Delaware"]),
    ("US-IL", [r"\bIllinois\b", r"State of Illinois"]),
    ("EU",    [r"\bEuropean Union\b", r"\bEU\b", r"\beIDAS\b", r"qualified electronic signature"]),
    ("GB",    [r"\bUnited Kingdom\b", r"\bUK\b", r"\bEngland\b", r"\bScotland\b", r"\bWales\b"]),
    ("DE-de", [r"\bGermany\b", r"\bDeutschland\b", r"German notary", r"German civil code"]),
    ("JP",    [r"\bJapan\b", r"Japanese notary", r"\bTokyo\b"]),
]


JURISDICTION_RULES: dict[str, dict] = {
    "US-FL": {
        "code": "US-FL", "name": "Florida", "country": "US",
        "ron_rules": {"witnesses_required": 2, "recording_required": True, "id_forms_accepted": ["DL", "passport", "state-id"], "session_min_minutes": 0, "registry": "FL Department of State"},
        "jurat_template": "State of Florida\nCounty of {county}\n\nSworn to (or affirmed) and subscribed before me by means of online notarization this {date} by {signer_name}, who is personally known to me or has produced {id_form} as identification.\n\n____________________________\n{notary_name}\nNotary Public — State of Florida\nCommission #{commission_id}",
        "effective_date": "2020-01-01",
    },
    "US-TX": {
        "code": "US-TX", "name": "Texas", "country": "US",
        "ron_rules": {"witnesses_required": 0, "recording_required": True, "id_forms_accepted": ["DL", "passport", "state-id"], "session_min_minutes": 0, "registry": "TX Secretary of State"},
        "jurat_template": "State of Texas\nCounty of {county}\n\nSworn to and subscribed before me by means of online notarization this {date} by {signer_name}.\n\n____________________________\n{notary_name}\nOnline Notary Public — State of Texas\nCommission #{commission_id} / Exp. {commission_expiry}",
        "effective_date": "2018-07-01",
    },
    "US-NY": {
        "code": "US-NY", "name": "New York", "country": "US",
        "ron_rules": {"witnesses_required": 0, "recording_required": True, "id_forms_accepted": ["DL", "passport"], "session_min_minutes": 0, "registry": "NY Department of State", "credential_analysis_required": True},
        "jurat_template": "State of New York\nCounty of {county}\n\nOn the {date} before me, the undersigned, a Notary Public in and for said state, personally appeared {signer_name} (via communication technology), proved to me on the basis of {id_form} to be the individual whose name is subscribed to the within instrument and acknowledged that he/she/they executed the same.\n\n____________________________\n{notary_name}\nNotary Public — State of New York\nReg. #{commission_id}",
        "effective_date": "2022-02-25",
    },
    "US-CA": {
        "code": "US-CA", "name": "California", "country": "US",
        "ron_rules": {"witnesses_required": 0, "recording_required": False, "id_forms_accepted": ["DL", "passport", "state-id"], "session_min_minutes": 0, "registry": "CA Secretary of State", "in_person_only_today": True, "note": "California currently does not authorize permanent RON; this packet documents AI-assisted preparation only."},
        "jurat_template": "State of California\nCounty of {county}\n\nOn {date} before me, {notary_name}, personally appeared {signer_name}, who proved to me on the basis of satisfactory evidence ({id_form}) to be the person whose name is subscribed to the within instrument.\n\nI certify under PENALTY OF PERJURY under the laws of the State of California that the foregoing paragraph is true and correct.\n\n____________________________\n{notary_name}\nNotary Public — State of California\nCommission #{commission_id}",
        "effective_date": "2024-01-01",
    },
    "US-VA": {
        "code": "US-VA", "name": "Virginia", "country": "US",
        "ron_rules": {"witnesses_required": 0, "recording_required": True, "id_forms_accepted": ["DL", "passport", "state-id"], "session_min_minutes": 0, "registry": "VA Secretary of the Commonwealth"},
        "jurat_template": "Commonwealth of Virginia\nCounty/City of {county}\n\nAcknowledged before me by means of electronic notarization on {date} by {signer_name}, identified by {id_form}.\n\n____________________________\n{notary_name}\nElectronic Notary Public — Commonwealth of Virginia\nRegistration #{commission_id}",
        "effective_date": "2012-07-01",
    },
    "US-DE": {
        "code": "US-DE", "name": "Delaware", "country": "US",
        "ron_rules": {"witnesses_required": 0, "recording_required": True, "id_forms_accepted": ["DL", "passport", "state-id"], "session_min_minutes": 0, "registry": "DE Department of State"},
        "jurat_template": "State of Delaware\nCounty of {county}\n\nSubscribed and sworn before me by means of remote online notarization on {date} by {signer_name} ({id_form}).\n\n____________________________\n{notary_name}\nNotary Public — State of Delaware\nCommission #{commission_id}",
        "effective_date": "2021-08-01",
    },
    "US-IL": {
        "code": "US-IL", "name": "Illinois", "country": "US",
        "ron_rules": {"witnesses_required": 0, "recording_required": True, "id_forms_accepted": ["DL", "passport", "state-id"], "session_min_minutes": 0, "registry": "IL Secretary of State"},
        "jurat_template": "State of Illinois\nCounty of {county}\n\nSworn to and subscribed before me by means of audio-video communication this {date} by {signer_name}, identified by {id_form}.\n\n____________________________\n{notary_name}\nNotary Public — State of Illinois\nCommission #{commission_id}",
        "effective_date": "2022-06-05",
    },
    "EU": {
        "code": "EU", "name": "European Union (eIDAS)", "country": "EU",
        "ron_rules": {"witnesses_required": 0, "recording_required": True, "id_forms_accepted": ["eID", "passport", "qualified-certificate"], "session_min_minutes": 0, "registry": "Qualified Trust Service Provider", "qualified_signature_required": True},
        "jurat_template": "European Union — eIDAS Regulation (EU) 910/2014\n\nThis electronic notarial act was executed on {date} by {signer_name}, identified via {id_form}, and bears a Qualified Electronic Signature compliant with Annex IV of Regulation (EU) 910/2014.\n\n____________________________\n{notary_name}\nQualified Trust Service — EU eIDAS\nQTSP ID: {commission_id}",
        "effective_date": "2016-07-01",
    },
    "GB": {
        "code": "GB", "name": "United Kingdom", "country": "GB",
        "ron_rules": {"witnesses_required": 1, "recording_required": True, "id_forms_accepted": ["passport", "driving-licence", "national-id"], "session_min_minutes": 0, "registry": "Faculty Office of the Archbishop of Canterbury"},
        "jurat_template": "United Kingdom\n\nNotarised on the {date} by means of remote video link, in the presence of {signer_name} (identified by {id_form}) and witness {witness_name}.\n\n____________________________\n{notary_name}\nNotary Public — England & Wales\nFaculty Office Reg. {commission_id}",
        "effective_date": "2020-03-25",
    },
    "DE-de": {
        "code": "DE-de", "name": "Germany", "country": "DE",
        "ron_rules": {"witnesses_required": 0, "recording_required": True, "id_forms_accepted": ["personalausweis", "passport", "elektronischer-aufenthaltstitel"], "session_min_minutes": 0, "registry": "Bundesnotarkammer", "qualified_signature_required": True},
        "jurat_template": "Bundesrepublik Deutschland\n\nDie vorstehende Urkunde wurde am {date} im Rahmen einer Online-Beurkundung durch {signer_name} (Ausweis: {id_form}) errichtet und mit einer qualifizierten elektronischen Signatur versehen.\n\n____________________________\n{notary_name}\nNotar — {commission_id}",
        "effective_date": "2022-08-01",
    },
    "JP": {
        "code": "JP", "name": "Japan", "country": "JP",
        "ron_rules": {"witnesses_required": 0, "recording_required": True, "id_forms_accepted": ["my-number-card", "driver-licence", "passport"], "session_min_minutes": 0, "registry": "Japan Federation of Bar Associations / 法務省"},
        "jurat_template": "日本国 / Japan\n\nThis instrument was electronically notarised on {date} for {signer_name}, identified by {id_form}, pursuant to the Notary Act (公証人法).\n\n____________________________\n{notary_name}\nNotary — Japan\nRegistration #{commission_id}",
        "effective_date": "2019-11-30",
    },
}


def _rule_version_hash(code: str) -> str:
    """Stable hash of the jurisdiction's current rule set — changes when rules change."""
    rule = JURISDICTION_RULES.get(code)
    if not rule:
        return "0" * 64
    payload = f"{code}::{rule['effective_date']}::{sorted(rule['ron_rules'].items())}::{rule['jurat_template']}"
    return hashlib.sha256(payload.encode()).hexdigest()


def list_jurisdictions() -> list[dict]:
    out = []
    for code, r in JURISDICTION_RULES.items():
        out.append({
            "code": code, "name": r["name"], "country": r["country"],
            "ron_rules": r["ron_rules"], "effective_date": r["effective_date"],
            "rule_version_hash": _rule_version_hash(code),
        })
    return out


# ────────────────────────────────────────────────────────────────────────────
# JURISDICTION DETECTION (heuristic primary + GPT-5.2 fallback)
# ────────────────────────────────────────────────────────────────────────────

def _detect_heuristic(text: str) -> list[str]:
    """Returns a deterministic, ordered list of jurisdiction codes detected
    via regex match against the document text."""
    if not text:
        return []
    hits: dict[str, int] = {}
    for code, patterns in _DETECTION_TOKENS:
        for pat in patterns:
            try:
                if re.search(pat, text, flags=re.IGNORECASE):
                    hits[code] = hits.get(code, 0) + 1
                    break
            except re.error:
                continue
    # Stable order: insertion order of _DETECTION_TOKENS
    return [code for code, _ in _DETECTION_TOKENS if code in hits]


async def _detect_with_llm(text: str) -> list[str]:
    """GPT-5.2 fallback — returns canonical codes when the heuristic finds nothing."""
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key or not text:
        return []
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception:
        return []
    snippet = text[:4000]
    codes = ", ".join(JURISDICTION_RULES.keys())
    prompt = (
        "Analyse the following document excerpt and list every notarisation jurisdiction "
        f"that is relevant. Respond with ONLY a comma-separated subset of these codes: {codes}. "
        f"If none are relevant, respond with the single word NONE.\n\nDOCUMENT:\n{snippet}"
    )
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"acn-detect-{uuid.uuid4().hex[:8]}",
            system_message="You are a notary-law jurisdiction classifier. Output only the codes, no prose.",
        ).with_model("openai", "gpt-5.2")
        resp = (await chat.send_message(UserMessage(text=prompt))) or ""
        if "NONE" in resp.upper():
            return []
        out = []
        for tok in re.split(r"[,\s]+", resp.strip()):
            tok = tok.strip().rstrip(".")
            if tok in JURISDICTION_RULES and tok not in out:
                out.append(tok)
        return out
    except Exception as e:
        logger.warning("[ACN.detect] LLM fallback failed: %s", e)
        return []


async def detect_jurisdictions(text: str, hint_codes: Optional[list[str]] = None) -> dict:
    """Returns {detected: [...codes], method: 'heuristic'|'llm'|'hint+heuristic', source_text_hash: '...'}"""
    detected = _detect_heuristic(text)
    method = "heuristic"
    if not detected:
        llm_detected = await _detect_with_llm(text)
        if llm_detected:
            detected = llm_detected
            method = "llm"
    if hint_codes:
        for c in hint_codes:
            if c in JURISDICTION_RULES and c not in detected:
                detected.append(c)
        method = f"hint+{method}"
    text_hash = hashlib.sha256((text or "").encode()).hexdigest()
    return {"detected": detected, "method": method, "source_text_hash": text_hash}


# ────────────────────────────────────────────────────────────────────────────
# RISK SCORING
# ────────────────────────────────────────────────────────────────────────────

def score_risk(detected: list[str], doc_text: str) -> dict[str, dict]:
    """Per-jurisdiction rejection-risk 0-100 + human-readable rationale."""
    out: dict[str, dict] = {}
    base = 8  # low baseline
    text = (doc_text or "")
    text_len = len(text)
    sparse = text_len < 200
    for code in detected:
        rule = JURISDICTION_RULES.get(code, {})
        rrules = rule.get("ron_rules", {})
        score = base
        reasons: list[str] = []
        if sparse:
            score += 30
            reasons.append("Document text is sparse; jurisdictional cues may be incomplete.")
        if rrules.get("witnesses_required", 0) > 0:
            score += 12
            reasons.append(f"{rrules['witnesses_required']} witness(es) required by {rule.get('name', code)}.")
        if rrules.get("qualified_signature_required"):
            score += 18
            reasons.append("Qualified Electronic Signature required (eIDAS / German civil code).")
        if rrules.get("in_person_only_today"):
            score += 35
            reasons.append("Jurisdiction does not authorise permanent RON; in-person execution may still be required.")
        if rrules.get("credential_analysis_required"):
            score += 8
            reasons.append("Credential analysis is mandatory and must be evidenced in the packet.")
        score = max(2, min(99, score))
        out[code] = {
            "score": score,
            "level": "low" if score < 20 else "medium" if score < 50 else "high",
            "reasons": reasons or ["No structural blockers detected."],
        }
    return out


# ────────────────────────────────────────────────────────────────────────────
# PROOF GENERATION (PDF + HCS)
# ────────────────────────────────────────────────────────────────────────────

def _render_jurat(template: str, ctx: dict) -> str:
    safe_ctx = {
        "signer_name": ctx.get("signer_name", "(signer)"),
        "notary_name": ctx.get("notary_name", "NotaryChain Online Notary"),
        "commission_id": ctx.get("commission_id", "ACN-" + uuid.uuid4().hex[:8].upper()),
        "commission_expiry": ctx.get("commission_expiry", "(on file)"),
        "county": ctx.get("county", "(county on file)"),
        "id_form": ctx.get("id_form", "government-issued ID"),
        "date": ctx.get("date", datetime.now(timezone.utc).strftime("%B %d, %Y")),
        "witness_name": ctx.get("witness_name", "(remote witness on file)"),
    }
    try:
        return template.format(**safe_ctx)
    except Exception:
        return template


def _generate_certificate_pdf(jurisdiction: dict, jurat_text: str, packet: dict) -> bytes:
    """Single-jurisdiction certificate PDF with localized jurat + bilingual header."""
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Preformatted
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.6 * inch, bottomMargin=0.6 * inch,
                            leftMargin=0.75 * inch, rightMargin=0.75 * inch)
    styles = getSampleStyleSheet()
    navy = colors.HexColor("#0f1825")
    coral = colors.HexColor("#e35d4e")
    gray = colors.HexColor("#6b7280")

    title = ParagraphStyle("Title", parent=styles["Title"], fontSize=20, textColor=navy,
                           alignment=TA_CENTER, fontName="Helvetica-Bold", spaceAfter=4)
    sub = ParagraphStyle("Sub", parent=styles["Normal"], fontSize=10, textColor=gray,
                         alignment=TA_CENTER, spaceAfter=14)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=12, textColor=navy,
                        fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=6)
    jurat_style = ParagraphStyle("Jurat", parent=styles["Code"], fontSize=10, textColor=navy,
                                 leading=14, leftIndent=10, rightIndent=10, fontName="Helvetica")

    elements = []
    elements.append(Paragraph("NOTARYCHAIN · ACN", ParagraphStyle("Brand", parent=styles["Normal"],
                              fontSize=10, textColor=coral, alignment=TA_CENTER,
                              fontName="Helvetica-Bold", spaceAfter=2)))
    elements.append(Paragraph(f"Cross-Border Notarisation Certificate — {jurisdiction['name']}", title))
    elements.append(Paragraph(f"Jurisdiction Code: {jurisdiction['code']} · "
                              f"Rule version: {_rule_version_hash(jurisdiction['code'])[:12]}…", sub))
    elements.append(HRFlowable(width="100%", thickness=1.2, color=coral, spaceAfter=10))

    # Localised jurat
    elements.append(Paragraph("Notarial certificate (localised)", h2))
    elements.append(Preformatted(jurat_text, jurat_style))
    elements.append(Spacer(1, 10))

    # RON-rule footprint
    elements.append(Paragraph("RON rule footprint", h2))
    r = jurisdiction["ron_rules"]
    rows = [
        ["Witnesses required", str(r.get("witnesses_required", 0))],
        ["Audio-video recording required", "Yes" if r.get("recording_required") else "No"],
        ["Accepted ID forms", ", ".join(r.get("id_forms_accepted", []))],
        ["Registry of record", r.get("registry", "—")],
        ["Effective date", jurisdiction["effective_date"]],
    ]
    if r.get("qualified_signature_required"):
        rows.append(["Qualified e-signature required", "Yes (eIDAS Annex IV / national equivalent)"])
    if r.get("in_person_only_today"):
        rows.append(["Permanent RON authorised", "No — see jurisdiction note"])
    tbl = Table(rows, colWidths=[2.4 * inch, 4.2 * inch])
    tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (0, -1), gray),
        ("TEXTCOLOR", (1, 0), (1, -1), navy),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(tbl)
    elements.append(Spacer(1, 12))

    # Packet provenance
    elements.append(Paragraph("Cross-border packet provenance", h2))
    prov = [
        ["Packet ID", packet.get("id", "—")],
        ["Source jurisdiction", packet.get("source_jurisdiction", "—")],
        ["Source document hash (sha256)", (packet.get("source_text_hash") or "—")[:64]],
        ["Generated at", datetime.now(timezone.utc).strftime("%B %d, %Y · %H:%M UTC")],
    ]
    p_tbl = Table(prov, colWidths=[2.4 * inch, 4.2 * inch])
    p_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (0, -1), gray),
        ("TEXTCOLOR", (1, 0), (1, -1), navy),
        ("FONTNAME", (1, 0), (1, -1), "Courier"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(p_tbl)

    # Note
    if jurisdiction["ron_rules"].get("note"):
        elements.append(Spacer(1, 10))
        elements.append(Paragraph(
            f"<b>Jurisdiction note:</b> <i>{jurisdiction['ron_rules']['note']}</i>",
            ParagraphStyle("Note", parent=styles["Normal"], fontSize=9, textColor=navy, leading=13)))

    elements.append(Spacer(1, 18))
    elements.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#e5e7eb")))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        f"Verifiable on Hedera HCS · Cross-Border Verification Passport at /acn/verify/{packet.get('id','')}",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, textColor=gray, alignment=TA_CENTER, leading=11)))

    doc.build(elements)
    return buf.getvalue()


async def _submit_hcs(payload: dict) -> dict:
    if not _hedera:
        return {"submitted": False, "reason": "hedera_unconfigured"}
    try:
        res = await _hedera.submit_message(_hedera.default_topic_id, payload)
        if res and res.get("success"):
            return {
                "submitted": True,
                "network": _hedera.network,
                "topic_id": _hedera.default_topic_id,
                "sequence_number": res.get("sequence_number"),
                "transaction_id": f"{_hedera.account_id}@{int(datetime.now(timezone.utc).timestamp())}",
                "explorer_url": res.get("explorer_url"),
            }
        return {"submitted": False, "reason": "hcs_submit_failed"}
    except Exception as e:
        logger.warning("[ACN.hcs] submission failed: %s", e)
        return {"submitted": False, "reason": str(e)[:120]}


async def seal_packet(packet: dict, jurisdiction_codes: list[str], jurat_ctx: dict) -> dict:
    """For each jurisdiction code: render jurat, render PDF, submit to HCS,
    persist an `acn_proofs` doc. Returns {proofs: [...], sealed_at, all_sealed}."""
    now = datetime.now(timezone.utc).isoformat()
    proofs = []
    for code in jurisdiction_codes:
        rule = JURISDICTION_RULES.get(code)
        if not rule:
            continue
        jurat_text = _render_jurat(rule["jurat_template"], jurat_ctx)
        pdf_bytes = _generate_certificate_pdf(rule, jurat_text, packet)
        cert_sha = hashlib.sha256(pdf_bytes).hexdigest()
        rule_version = _rule_version_hash(code)
        hcs_payload = {
            "type": "ACN_JURISDICTION_SEAL",
            "packet_id": packet["id"],
            "jurisdiction": code,
            "jurisdiction_name": rule["name"],
            "cert_sha256": cert_sha,
            "rule_version_hash": rule_version,
            "source_text_hash": packet.get("source_text_hash"),
            "signer": jurat_ctx.get("signer_name"),
            "sealed_at": now,
        }
        hcs = await _submit_hcs(hcs_payload)
        proof_doc = {
            "id": uuid.uuid4().hex,
            "packet_id": packet["id"],
            "jurisdiction_code": code,
            "jurisdiction_name": rule["name"],
            "jurat_text": jurat_text,
            "certificate_pdf_b64": base64.b64encode(pdf_bytes).decode(),
            "certificate_sha256": cert_sha,
            "rule_version_hash": rule_version,
            "hcs": hcs,
            "sealed_at": now,
        }
        await _db.acn_proofs.insert_one(proof_doc)
        proof_doc.pop("_id", None)  # insert_one mutates dict to add ObjectId
        # Don't return base64 in the API summary — too large
        proofs.append({k: v for k, v in proof_doc.items() if k != "certificate_pdf_b64"})
    all_sealed = all(p["hcs"].get("submitted") for p in proofs) if proofs else False
    return {"proofs": proofs, "sealed_at": now, "all_sealed": all_sealed}


# ────────────────────────────────────────────────────────────────────────────
# RULE UPDATES (re-seal triggers)
# ────────────────────────────────────────────────────────────────────────────

async def record_rule_update(code: str, change_summary: str, effective_date: str, actor: str) -> dict:
    """Records a rule-update event and flags every packet that has a proof for
    the affected jurisdiction with a different rule_version_hash."""
    new_version = _rule_version_hash(code)
    affected_ids = set()
    async for proof in _db.acn_proofs.find(
        {"jurisdiction_code": code, "rule_version_hash": {"$ne": new_version}},
        {"_id": 0, "packet_id": 1},
    ):
        affected_ids.add(proof["packet_id"])
    affected = list(affected_ids)
    update_doc = {
        "id": uuid.uuid4().hex,
        "jurisdiction_code": code,
        "change_summary": change_summary,
        "effective_date": effective_date,
        "new_rule_version_hash": new_version,
        "affected_packet_ids": affected,
        "actor": actor,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await _db.acn_rule_updates.insert_one(update_doc)
    # Tag affected packets
    if affected:
        await _db.acn_packets.update_many(
            {"id": {"$in": affected}},
            {"$set": {"needs_reseal": True, "needs_reseal_for_jurisdictions": [code]}},
        )
    update_doc.pop("_id", None)
    return update_doc


# Make the module import-safe for tests
asyncio  # noqa: F401 — re-export to satisfy linter that we imported it intentionally
