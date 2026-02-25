"""
RON (Remote Online Notarization) Compliance Service
State-by-state rules database and validation engine for Remote Online Notarization
"""

import logging
from typing import Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ---- RON Status Categories ----
# "full" = Full RON authorized, "limited" = Limited/restricted, "pending" = Legislation pending, "prohibited" = Not allowed

RON_STATE_RULES = {
    "AL": {"name": "Alabama", "status": "full", "effective_date": "2020-01-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "Act 2019-504"},
    "AK": {"name": "Alaska", "status": "full", "effective_date": "2022-01-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "SB 143"},
    "AZ": {"name": "Arizona", "status": "full", "effective_date": "2020-07-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "HB 2362"},
    "AR": {"name": "Arkansas", "status": "full", "effective_date": "2020-06-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "HB 1770"},
    "CA": {"name": "California", "status": "limited", "effective_date": "2030-01-01", "id_requirements": ["knowledge_based", "credential_analysis", "biometric"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 5, "allowed_doc_types": ["power_of_attorney", "affidavit", "general"], "restricted_doc_types": ["real_estate", "trust", "will"], "notes": "SB 696 - Limited RON, real estate excluded until 2030"},
    "CO": {"name": "Colorado", "status": "full", "effective_date": "2020-07-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "SB 19-033"},
    "CT": {"name": "Connecticut", "status": "full", "effective_date": "2023-07-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "Public Act 23-98"},
    "DE": {"name": "Delaware", "status": "full", "effective_date": "2023-01-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "SB 262"},
    "FL": {"name": "Florida", "status": "full", "effective_date": "2020-01-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "HB 409 - Early RON adopter"},
    "GA": {"name": "Georgia", "status": "full", "effective_date": "2022-01-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "SB 334"},
    "HI": {"name": "Hawaii", "status": "full", "effective_date": "2023-07-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "HB 1275"},
    "ID": {"name": "Idaho", "status": "full", "effective_date": "2020-07-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "HB 410"},
    "IL": {"name": "Illinois", "status": "full", "effective_date": "2022-01-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "SB 2664"},
    "IN": {"name": "Indiana", "status": "full", "effective_date": "2019-07-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "SEA 372"},
    "IA": {"name": "Iowa", "status": "full", "effective_date": "2020-07-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "HF 2525"},
    "KS": {"name": "Kansas", "status": "full", "effective_date": "2021-07-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "HB 2085"},
    "KY": {"name": "Kentucky", "status": "full", "effective_date": "2020-06-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "SB 114"},
    "LA": {"name": "Louisiana", "status": "limited", "effective_date": "2024-01-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 2, "recording_required": True, "journal_required": True, "max_signers_per_session": 5, "allowed_doc_types": ["affidavit", "power_of_attorney", "general"], "restricted_doc_types": ["real_estate"], "notes": "Limited RON - real estate requires in-person"},
    "ME": {"name": "Maine", "status": "full", "effective_date": "2023-10-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "LD 1156"},
    "MD": {"name": "Maryland", "status": "full", "effective_date": "2020-10-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "HB 1430"},
    "MA": {"name": "Massachusetts", "status": "full", "effective_date": "2023-07-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "S.2967"},
    "MI": {"name": "Michigan", "status": "full", "effective_date": "2021-06-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "SB 566"},
    "MN": {"name": "Minnesota", "status": "full", "effective_date": "2019-01-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "HF 1952 - Early adopter"},
    "MS": {"name": "Mississippi", "status": "full", "effective_date": "2022-07-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "SB 2828"},
    "MO": {"name": "Missouri", "status": "full", "effective_date": "2020-08-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "SB 631"},
    "MT": {"name": "Montana", "status": "full", "effective_date": "2019-10-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "SB 198"},
    "NE": {"name": "Nebraska", "status": "full", "effective_date": "2020-07-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "LB 186"},
    "NV": {"name": "Nevada", "status": "full", "effective_date": "2021-01-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "AB 413"},
    "NH": {"name": "New Hampshire", "status": "full", "effective_date": "2022-01-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "HB 309"},
    "NJ": {"name": "New Jersey", "status": "full", "effective_date": "2022-03-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "A4244"},
    "NM": {"name": "New Mexico", "status": "full", "effective_date": "2023-07-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "HB 132"},
    "NY": {"name": "New York", "status": "full", "effective_date": "2023-01-31", "id_requirements": ["knowledge_based", "credential_analysis", "biometric"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 6, "allowed_doc_types": ["all"], "notes": "S1780C - Requires biometric verification"},
    "NC": {"name": "North Carolina", "status": "full", "effective_date": "2023-07-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "SB 518"},
    "ND": {"name": "North Dakota", "status": "full", "effective_date": "2019-08-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "SB 2256"},
    "OH": {"name": "Ohio", "status": "full", "effective_date": "2019-09-20", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "SB 263"},
    "OK": {"name": "Oklahoma", "status": "full", "effective_date": "2020-11-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "SB 1321"},
    "OR": {"name": "Oregon", "status": "full", "effective_date": "2022-01-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "SB 749"},
    "PA": {"name": "Pennsylvania", "status": "full", "effective_date": "2020-10-29", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "SB 1097"},
    "RI": {"name": "Rhode Island", "status": "full", "effective_date": "2023-07-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "H 5538"},
    "SC": {"name": "South Carolina", "status": "prohibited", "effective_date": None, "id_requirements": [], "witnesses_required": 0, "recording_required": False, "journal_required": False, "max_signers_per_session": 0, "allowed_doc_types": [], "notes": "No RON legislation enacted"},
    "SD": {"name": "South Dakota", "status": "full", "effective_date": "2020-07-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "HB 1099"},
    "TN": {"name": "Tennessee", "status": "full", "effective_date": "2020-01-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "HB 1509"},
    "TX": {"name": "Texas", "status": "full", "effective_date": "2018-01-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "SB 2128 - One of the first RON states"},
    "UT": {"name": "Utah", "status": "full", "effective_date": "2019-05-14", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "SB 249"},
    "VT": {"name": "Vermont", "status": "full", "effective_date": "2023-07-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "S.56"},
    "VA": {"name": "Virginia", "status": "full", "effective_date": "2012-07-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "HB 2318 - First state to authorize RON"},
    "WA": {"name": "Washington", "status": "full", "effective_date": "2020-06-11", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "SB 5641"},
    "WV": {"name": "West Virginia", "status": "full", "effective_date": "2022-06-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "HB 4133"},
    "WI": {"name": "Wisconsin", "status": "full", "effective_date": "2020-08-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "SB 415"},
    "WY": {"name": "Wyoming", "status": "full", "effective_date": "2021-07-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "SF 27"},
    "DC": {"name": "District of Columbia", "status": "full", "effective_date": "2023-03-01", "id_requirements": ["knowledge_based", "credential_analysis"], "witnesses_required": 0, "recording_required": True, "journal_required": True, "max_signers_per_session": 10, "allowed_doc_types": ["all"], "notes": "B25-0066"},
}


def get_state_rules(state_code: str) -> Optional[dict]:
    """Get RON rules for a specific state"""
    rules = RON_STATE_RULES.get(state_code.upper())
    if rules:
        return {"state_code": state_code.upper(), **rules}
    return None


def get_all_states() -> list:
    """Get all state rules"""
    return [{"state_code": code, **rules} for code, rules in sorted(RON_STATE_RULES.items())]


def get_compliance_stats() -> dict:
    """Get summary statistics of RON compliance across states"""
    total = len(RON_STATE_RULES)
    full = sum(1 for r in RON_STATE_RULES.values() if r["status"] == "full")
    limited = sum(1 for r in RON_STATE_RULES.values() if r["status"] == "limited")
    pending = sum(1 for r in RON_STATE_RULES.values() if r["status"] == "pending")
    prohibited = sum(1 for r in RON_STATE_RULES.values() if r["status"] == "prohibited")

    return {
        "total_jurisdictions": total,
        "full_ron": full,
        "limited_ron": limited,
        "pending_legislation": pending,
        "prohibited": prohibited,
        "coverage_pct": round((full + limited) / total * 100, 1),
    }


def validate_ron_request(state_code: str, document_type: str, signer_count: int = 1) -> dict:
    """Validate a RON request against the state's rules.
    Returns { compliant: bool, warnings: [], errors: [], requirements: {} }
    """
    result = {
        "compliant": True,
        "state_code": state_code.upper(),
        "warnings": [],
        "errors": [],
        "requirements": {},
    }

    rules = RON_STATE_RULES.get(state_code.upper())
    if not rules:
        result["compliant"] = False
        result["errors"].append(f"Unknown state code: {state_code}")
        return result

    result["requirements"] = {
        "state_name": rules["name"],
        "ron_status": rules["status"],
        "id_requirements": rules["id_requirements"],
        "witnesses_required": rules["witnesses_required"],
        "recording_required": rules["recording_required"],
        "journal_required": rules["journal_required"],
        "max_signers": rules["max_signers_per_session"],
    }

    # Check if RON is allowed
    if rules["status"] == "prohibited":
        result["compliant"] = False
        result["errors"].append(f"Remote Online Notarization is not authorized in {rules['name']}. In-person notarization required.")
        return result

    # Check doc type restrictions
    restricted = rules.get("restricted_doc_types", [])
    allowed = rules.get("allowed_doc_types", ["all"])
    doc_type_normalized = document_type.lower().replace(" ", "_")

    if doc_type_normalized in restricted:
        result["compliant"] = False
        result["errors"].append(f"Document type '{document_type}' is restricted for RON in {rules['name']}. {rules.get('notes', '')}")
    elif "all" not in allowed and doc_type_normalized not in allowed:
        result["warnings"].append(f"Document type '{document_type}' may not be explicitly covered under {rules['name']}'s RON rules.")

    # Check signer count
    max_signers = rules.get("max_signers_per_session", 10)
    if signer_count > max_signers:
        result["compliant"] = False
        result["errors"].append(f"Too many signers ({signer_count}). {rules['name']} allows maximum {max_signers} per RON session.")

    # Limited status warning
    if rules["status"] == "limited":
        result["warnings"].append(f"{rules['name']} has limited RON authorization. {rules.get('notes', '')} Additional restrictions may apply.")

    # Biometric requirement
    if "biometric" in rules.get("id_requirements", []):
        result["warnings"].append(f"{rules['name']} requires biometric verification during RON sessions.")

    # Witnesses
    if rules["witnesses_required"] > 0:
        result["requirements"]["witnesses_message"] = f"{rules['witnesses_required']} witness(es) required for RON in {rules['name']}"

    if result["errors"]:
        result["compliant"] = False

    return result
