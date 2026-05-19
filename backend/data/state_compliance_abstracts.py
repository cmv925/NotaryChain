"""
State Compliance Abstracts — TX / NY / CA / VA

Each "abstract" is a structured summary of a US state's Remote Online
Notarization (RON) statute, capturing the gates NotaryChain enforces.
Used by:
  • Public landing pages at /compliance/:state
  • Comparison table /compliance
  • Admin tracking of RONSP-equivalent registrations per state
  • Future "Compliance-as-a-Service" API (per-state pre-seal gate evaluator)

Source: Each state's published RON statute (text URLs below). These
abstracts are condensed compliance summaries — not legal advice.
"""

STATE_ABSTRACTS = {
    "FL": {
        "code": "FL",
        "name": "Florida",
        "statute": "F.S. §117.201–.305 (Online Notary Public Act)",
        "statute_url": "http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0100-0199/0117/0117.html",
        "ron_status": "live",  # live | pilot | enacted_pending | proposed
        "effective_date": "2020-01-01",
        "platform_status": "live",  # NotaryChain operational status in this state
        "registration": {
            "required": True,
            "name": "Florida RONSP (Remote Online Notary Service Provider)",
            "filing_url": "https://flgov.com/notary/",
            "renewal_years": 4,
        },
        "key_gates": [
            {"id": "audio_video", "label": "Live audio + video recording", "min": "720p / 16kHz / ≥ 30s"},
            {"id": "kba", "label": "Knowledge-Based Authentication", "min": "5 questions, ≥4 correct, ≤2 attempts"},
            {"id": "id_check", "label": "Government ID verification", "min": "Credential analysis required"},
            {"id": "witnesses", "label": "Witnesses (online wills only)", "min": "2 witnesses, 1 supervisory"},
            {"id": "retention", "label": "Recording retention", "min": "10 years (S3 Object Lock)"},
            {"id": "journal", "label": "Notary journal", "min": "F.S. §117.245 — 10-year retention"},
            {"id": "principal_location", "label": "Principal location capture", "min": "GPS at signature"},
        ],
        "highlights": [
            "First major US state to authorize RON for online wills (2020).",
            "10-year retention of A/V recording is the longest of any US state.",
            "Out-of-state principals permitted if notary is in FL.",
        ],
    },
    "TX": {
        "code": "TX",
        "name": "Texas",
        "statute": "Tex. Gov't Code §406.101–.116 (Online Notary Public Act)",
        "statute_url": "https://statutes.capitol.texas.gov/Docs/GV/htm/GV.406.htm",
        "ron_status": "live",
        "effective_date": "2018-07-01",
        "platform_status": "abstract_published",  # abstract published, pipeline NOT yet wired
        "registration": {
            "required": True,
            "name": "Texas Online Notary Public commission",
            "filing_url": "https://www.sos.state.tx.us/statdoc/onlinenotary.shtml",
            "renewal_years": 4,
        },
        "key_gates": [
            {"id": "audio_video", "label": "Live audio + video recording", "min": "720p / clear audio"},
            {"id": "kba", "label": "Knowledge-Based Authentication", "min": "5 questions, ≥4 correct"},
            {"id": "id_check", "label": "Credential analysis", "min": "Required for unknown principals"},
            {"id": "retention", "label": "Recording retention", "min": "5 years"},
            {"id": "journal", "label": "Electronic journal", "min": "Required, 10-year retention"},
            {"id": "tamper_evident", "label": "Tamper-evident technology", "min": "Required on completed cert"},
        ],
        "highlights": [
            "First US state to authorize RON (2018).",
            "Notary must be physically in Texas; signer may be anywhere.",
            "Recording retention is 5 years vs FL's 10.",
        ],
    },
    "NY": {
        "code": "NY",
        "name": "New York",
        "statute": "N.Y. Exec. Law §135-c (Electronic Notarization)",
        "statute_url": "https://www.nysenate.gov/legislation/laws/EXC/135-C",
        "ron_status": "live",
        "effective_date": "2023-01-25",
        "platform_status": "abstract_published",
        "registration": {
            "required": True,
            "name": "Electronic Notary registration (NY DOS)",
            "filing_url": "https://dos.ny.gov/electronic-notary",
            "renewal_years": 4,
        },
        "key_gates": [
            {"id": "audio_video", "label": "Live two-way A/V", "min": "Continuous, recorded"},
            {"id": "identity_proofing", "label": "Identity proofing", "min": "Multi-factor: KBA + credential analysis OR personal knowledge"},
            {"id": "id_check", "label": "Credential analysis", "min": "Required if not personally known"},
            {"id": "retention", "label": "Recording retention", "min": "10 years"},
            {"id": "journal", "label": "Electronic journal", "min": "Required, 10-year retention"},
            {"id": "principal_location", "label": "Principal location", "min": "Must be in US or US territory"},
            {"id": "ny_residency", "label": "Notary residency", "min": "Notary must be physically in NY"},
        ],
        "highlights": [
            "One of the strictest US RON regimes — requires multi-factor identity proofing.",
            "Effective January 25, 2023 after a 3-year regulatory delay post-statute.",
            "Bar on wills, codicils, and testamentary trusts — NY does NOT permit RON for these.",
        ],
        "restrictions": ["Wills", "Codicils", "Testamentary trusts", "Life estate deeds"],
    },
    "CA": {
        "code": "CA",
        "name": "California",
        "statute": "AB 2017 / SB 696 — pending implementation",
        "statute_url": "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240SB696",
        "ron_status": "enacted_pending",  # statute passed, secretary of state implementing
        "effective_date": "2024-01-01",  # statute effective date; implementation by 2025/2026
        "platform_status": "abstract_published",
        "registration": {
            "required": True,
            "name": "California Online Notary Public commission",
            "filing_url": "https://www.sos.ca.gov/notary",
            "renewal_years": 4,
            "implementation_status": "Final regulations expected H2 2026 per CA SOS; out-of-state platforms must register.",
        },
        "key_gates": [
            {"id": "audio_video", "label": "Live A/V conference", "min": "Real-time, recorded, encrypted"},
            {"id": "kba", "label": "Knowledge-Based Authentication", "min": "Federal/state public-record-sourced questions"},
            {"id": "id_check", "label": "Credential analysis", "min": "Required"},
            {"id": "retention", "label": "Recording retention", "min": "Minimum 5 years (CA SOS proposed rule)"},
            {"id": "journal", "label": "Electronic journal", "min": "Required, signature + thumbprint capture"},
            {"id": "thumbprint", "label": "Biometric thumbprint", "min": "Required for real-property + power-of-attorney"},
        ],
        "highlights": [
            "CA was historically the last large state without RON — SB 696 changes that.",
            "Unique requirement: BIOMETRIC THUMBPRINT capture for real-property and POA notarizations.",
            "Implementation regulations still in finalization phase (Q1 2026).",
        ],
        "restrictions": ["Wills (statute under review)", "Some family-law instruments"],
    },
    "VA": {
        "code": "VA",
        "name": "Virginia",
        "statute": "Va. Code §47.1–2 et seq. (Notaries Public Act, RON provisions)",
        "statute_url": "https://law.lis.virginia.gov/vacode/title47.1/",
        "ron_status": "live",
        "effective_date": "2012-07-01",
        "platform_status": "abstract_published",
        "registration": {
            "required": True,
            "name": "Electronic Notary Public commission",
            "filing_url": "https://www.commonwealth.virginia.gov/official-documents/notary-commissions/",
            "renewal_years": 4,
        },
        "key_gates": [
            {"id": "audio_video", "label": "Live A/V conference", "min": "Real-time, recorded"},
            {"id": "id_check", "label": "Identity verification", "min": "KBA + credential analysis OR personal knowledge"},
            {"id": "kba", "label": "Knowledge-Based Authentication", "min": "Required if not personally known"},
            {"id": "retention", "label": "Recording retention", "min": "5 years"},
            {"id": "journal", "label": "Electronic journal", "min": "Required"},
            {"id": "tamper_evident", "label": "Tamper-evident PKI signature", "min": "Required on certificate"},
        ],
        "highlights": [
            "First US state to authorize RON (2012) — the original pioneer.",
            "Most permissive on signer location: can be anywhere in the world.",
            "Strong reciprocity — many states accept VA-notarized documents.",
        ],
    },
}


def get_state(code: str):
    return STATE_ABSTRACTS.get(code.upper())


def list_states():
    return list(STATE_ABSTRACTS.values())


def comparison_matrix():
    """Side-by-side gate matrix for the public comparison page."""
    gate_ids = ["audio_video", "kba", "id_check", "retention", "journal", "witnesses", "thumbprint", "principal_location", "tamper_evident", "identity_proofing"]
    rows = []
    for gid in gate_ids:
        cells = {"gate_id": gid, "states": {}}
        for code, st in STATE_ABSTRACTS.items():
            match = next((g for g in st["key_gates"] if g["id"] == gid), None)
            cells["states"][code] = match["min"] if match else None
        rows.append(cells)
    return rows
