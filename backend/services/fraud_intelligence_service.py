"""
Fraud Intelligence Service — Pre-seeded fraud patterns, RON compliance rules,
and context injection for ANAN agent prompts.
"""
import os
from datetime import datetime, timezone
import uuid

# ─── Pre-seeded Fraud Patterns ───

DEFAULT_FRAUD_PATTERNS = [
    {
        "pattern_id": "FP-001",
        "category": "identity",
        "title": "Synthetic Identity Fraud",
        "description": "Combination of real and fabricated personal information to create a new identity. Common indicators: mismatched SSN age, no credit history before recent date, PO box as primary address.",
        "severity": "high",
        "indicators": ["mismatched_ssn_age", "no_credit_history", "po_box_address", "recently_created_identity"],
        "document_types": ["all"],
        "active": True,
    },
    {
        "pattern_id": "FP-002",
        "category": "document",
        "title": "Forged Government ID",
        "description": "Digitally altered or completely fabricated government-issued identification. Look for inconsistent fonts, misaligned holograms, wrong barcode data, incorrect state formatting.",
        "severity": "critical",
        "indicators": ["font_inconsistency", "hologram_misalignment", "barcode_mismatch", "format_deviation"],
        "document_types": ["all"],
        "active": True,
    },
    {
        "pattern_id": "FP-003",
        "category": "biometric",
        "title": "Deepfake Video/Image",
        "description": "AI-generated facial imagery used to bypass biometric verification. Watch for unnatural blinking patterns, inconsistent lighting on face edges, temporal artifacts in video.",
        "severity": "critical",
        "indicators": ["unnatural_blink", "lighting_inconsistency", "temporal_artifacts", "face_edge_blur", "lip_sync_mismatch"],
        "document_types": ["all"],
        "active": True,
    },
    {
        "pattern_id": "FP-004",
        "category": "document",
        "title": "Power of Attorney Abuse",
        "description": "Unauthorized use of POA documents, often with expired or revoked authority. Verify POA is current, principal is alive and competent, scope covers the transaction.",
        "severity": "high",
        "indicators": ["expired_poa", "revoked_authority", "scope_mismatch", "principal_incapacity"],
        "document_types": ["power_of_attorney"],
        "active": True,
    },
    {
        "pattern_id": "FP-005",
        "category": "transaction",
        "title": "Real Estate Wire Fraud",
        "description": "Impersonation of title company or real estate agent to redirect closing funds. Common in remote transactions. Verify all wire instructions independently.",
        "severity": "critical",
        "indicators": ["email_spoofing", "wire_instruction_change", "urgency_pressure", "unverified_contact"],
        "document_types": ["deed", "contract"],
        "active": True,
    },
    {
        "pattern_id": "FP-006",
        "category": "identity",
        "title": "Identity Theft — Elderly Victim",
        "description": "Targeting elderly individuals for unauthorized document signing. Watch for signs of duress, unfamiliar notarization patterns, third-party coaching during session.",
        "severity": "high",
        "indicators": ["elderly_signer", "third_party_coaching", "duress_signs", "unusual_pattern"],
        "document_types": ["will", "power_of_attorney", "deed"],
        "active": True,
    },
    {
        "pattern_id": "FP-007",
        "category": "biometric",
        "title": "Photo Replay Attack",
        "description": "Using a printed photo or screen display instead of live face. Liveness detection should catch lack of 3D depth, screen reflection patterns, and static imagery.",
        "severity": "high",
        "indicators": ["no_3d_depth", "screen_reflection", "static_imagery", "moire_pattern"],
        "document_types": ["all"],
        "active": True,
    },
    {
        "pattern_id": "FP-008",
        "category": "document",
        "title": "Notary Seal Forgery",
        "description": "Unauthorized reproduction of notary commission seal or stamp. Check seal number against state database, verify commission expiry, cross-reference notary identity.",
        "severity": "critical",
        "indicators": ["seal_number_mismatch", "expired_commission", "identity_mismatch", "unauthorized_jurisdiction"],
        "document_types": ["all"],
        "active": True,
    },
]

# ─── RON Compliance Rules by Jurisdiction ───

DEFAULT_RON_RULES = {
    "US-FL": {
        "jurisdiction": "US-FL",
        "state_name": "Florida",
        "ron_enabled": True,
        "statute": "FL Stat. §117.265",
        "requirements": {
            "audio_video_required": True,
            "recording_retention_years": 10,
            "identity_proofing": "credential_analysis_plus_kba",
            "kba_questions_required": 5,
            "kba_correct_required": 4,
            "tamper_evident_seal": True,
            "notary_physical_location": "Florida",
            "signer_location": "anywhere",
            "allowed_document_types": ["all"],
            "max_signers_per_session": 10,
        },
        "prohibited_documents": [],
        "notes": "Florida was among the first states to authorize RON. No document type restrictions.",
    },
    "US-TX": {
        "jurisdiction": "US-TX",
        "state_name": "Texas",
        "ron_enabled": True,
        "statute": "TX Gov Code §406.101-406.114",
        "requirements": {
            "audio_video_required": True,
            "recording_retention_years": 5,
            "identity_proofing": "credential_analysis_plus_kba",
            "kba_questions_required": 5,
            "kba_correct_required": 4,
            "tamper_evident_seal": True,
            "notary_physical_location": "Texas",
            "signer_location": "anywhere",
            "allowed_document_types": ["all"],
            "max_signers_per_session": None,
        },
        "prohibited_documents": [],
        "notes": "Texas requires notary to be commissioned in TX. Online notary must complete additional training.",
    },
    "US-VA": {
        "jurisdiction": "US-VA",
        "state_name": "Virginia",
        "ron_enabled": True,
        "statute": "VA Code §47.1-1 to 47.1-29",
        "requirements": {
            "audio_video_required": True,
            "recording_retention_years": 5,
            "identity_proofing": "credential_analysis_plus_kba",
            "kba_questions_required": 5,
            "kba_correct_required": 4,
            "tamper_evident_seal": True,
            "notary_physical_location": "Virginia",
            "signer_location": "anywhere",
            "allowed_document_types": ["all"],
            "max_signers_per_session": None,
        },
        "prohibited_documents": [],
        "notes": "Virginia was the first state to authorize RON (2011). Gold standard for RON legislation.",
    },
    "US-NV": {
        "jurisdiction": "US-NV",
        "state_name": "Nevada",
        "ron_enabled": True,
        "statute": "NV NRS Chapter 240",
        "requirements": {
            "audio_video_required": True,
            "recording_retention_years": 7,
            "identity_proofing": "credential_analysis_plus_kba",
            "kba_questions_required": 5,
            "kba_correct_required": 4,
            "tamper_evident_seal": True,
            "notary_physical_location": "Nevada",
            "signer_location": "anywhere",
            "allowed_document_types": ["all"],
            "max_signers_per_session": None,
        },
        "prohibited_documents": ["will_codicil"],
        "notes": "Nevada prohibits RON for wills and codicils.",
    },
    "US-OH": {
        "jurisdiction": "US-OH",
        "state_name": "Ohio",
        "ron_enabled": True,
        "statute": "OH RC §147.60-147.66",
        "requirements": {
            "audio_video_required": True,
            "recording_retention_years": 5,
            "identity_proofing": "credential_analysis_plus_kba",
            "kba_questions_required": 5,
            "kba_correct_required": 4,
            "tamper_evident_seal": True,
            "notary_physical_location": "Ohio",
            "signer_location": "anywhere",
            "allowed_document_types": ["all"],
            "max_signers_per_session": None,
        },
        "prohibited_documents": [],
        "notes": "Ohio RON effective 2019. Standard credential analysis + KBA.",
    },
    "US-IN": {
        "jurisdiction": "US-IN",
        "state_name": "Indiana",
        "ron_enabled": True,
        "statute": "IN Code §33-42-17",
        "requirements": {
            "audio_video_required": True,
            "recording_retention_years": 10,
            "identity_proofing": "credential_analysis_plus_kba",
            "kba_questions_required": 5,
            "kba_correct_required": 4,
            "tamper_evident_seal": True,
            "notary_physical_location": "Indiana",
            "signer_location": "anywhere",
            "allowed_document_types": ["all"],
            "max_signers_per_session": None,
        },
        "prohibited_documents": [],
        "notes": "Indiana requires 10-year recording retention. Standard RON compliance.",
    },
    "US-CA": {
        "jurisdiction": "US-CA",
        "state_name": "California",
        "ron_enabled": False,
        "statute": "Pending legislation",
        "requirements": {
            "audio_video_required": True,
            "recording_retention_years": None,
            "identity_proofing": "personal_knowledge_or_credible_witness",
            "tamper_evident_seal": True,
            "notary_physical_location": "California",
            "signer_location": "in_person_or_pending",
        },
        "prohibited_documents": [],
        "notes": "California has NOT yet authorized permanent RON. Limited emergency provisions only. High-risk jurisdiction for remote notarization.",
    },
    "US-NY": {
        "jurisdiction": "US-NY",
        "state_name": "New York",
        "ron_enabled": True,
        "statute": "NY Exec Law §135-c",
        "requirements": {
            "audio_video_required": True,
            "recording_retention_years": 10,
            "identity_proofing": "credential_analysis_plus_kba",
            "kba_questions_required": 5,
            "kba_correct_required": 4,
            "tamper_evident_seal": True,
            "notary_physical_location": "New York",
            "signer_location": "anywhere",
            "allowed_document_types": ["all"],
            "max_signers_per_session": None,
        },
        "prohibited_documents": [],
        "notes": "New York RON effective 2023. 10-year retention required.",
    },
}


async def seed_fraud_intelligence(db):
    """Seed fraud patterns and RON rules if not already present."""
    existing = await db.fraud_patterns.count_documents({})
    if existing == 0:
        now = datetime.now(timezone.utc).isoformat()
        for p in DEFAULT_FRAUD_PATTERNS:
            p["created_at"] = now
            p["updated_at"] = now
        await db.fraud_patterns.insert_many(DEFAULT_FRAUD_PATTERNS)

    existing_ron = await db.ron_rules.count_documents({})
    if existing_ron == 0:
        now = datetime.now(timezone.utc).isoformat()
        docs = []
        for code, rule in DEFAULT_RON_RULES.items():
            rule["created_at"] = now
            rule["updated_at"] = now
            docs.append(rule)
        await db.ron_rules.insert_many(docs)


async def get_fraud_context(db, document_type: str = "general", jurisdiction: str = "US-General") -> str:
    """Build fraud context string for ANAN agent prompt injection."""
    # Get active fraud patterns relevant to this doc type
    query = {"active": True, "$or": [
        {"document_types": "all"},
        {"document_types": document_type},
    ]}
    patterns = []
    async for p in db.fraud_patterns.find(query, {"_id": 0}).limit(10):
        patterns.append(p)

    # Get RON rules for jurisdiction
    ron = await db.ron_rules.find_one({"jurisdiction": jurisdiction}, {"_id": 0})

    context_parts = []

    if patterns:
        context_parts.append("ACTIVE FRAUD ALERTS:")
        for p in patterns:
            context_parts.append(f"- [{p['severity'].upper()}] {p['title']}: {p['description'][:150]}")
            context_parts.append(f"  Indicators: {', '.join(p.get('indicators', []))}")

    if ron:
        context_parts.append(f"\nRON COMPLIANCE RULES ({ron.get('state_name', jurisdiction)}):")
        context_parts.append(f"- RON Enabled: {ron['ron_enabled']}")
        context_parts.append(f"- Statute: {ron.get('statute', 'N/A')}")
        reqs = ron.get("requirements", {})
        if reqs.get("audio_video_required"):
            context_parts.append("- Audio/Video recording REQUIRED")
        if reqs.get("recording_retention_years"):
            context_parts.append(f"- Recording retention: {reqs['recording_retention_years']} years")
        if reqs.get("identity_proofing"):
            context_parts.append(f"- Identity proofing: {reqs['identity_proofing']}")
        if ron.get("prohibited_documents"):
            context_parts.append(f"- PROHIBITED doc types: {', '.join(ron['prohibited_documents'])}")
        if ron.get("notes"):
            context_parts.append(f"- Notes: {ron['notes']}")
        if not ron["ron_enabled"]:
            context_parts.append("- WARNING: This jurisdiction has NOT authorized permanent RON. Flag as HIGH RISK.")

    return "\n".join(context_parts) if context_parts else ""
