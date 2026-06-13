"""
Smart Clause Library — curated, category-grouped legal clauses with optional
state-specific variants. Powers the Smart Document Studio "Insert Clause" feature.

Each clause: id, category, title, body, optional `states` map for state-specific text,
and `tags`. The library is intentionally curated/vetted for consistency.
"""
from typing import Optional, List, Dict, Any

CLAUSE_CATEGORIES = {
    "governing_law": "Governing Law & Jurisdiction",
    "dispute": "Dispute Resolution",
    "confidentiality": "Confidentiality",
    "payment": "Payment & Late Fees",
    "liability": "Liability & Indemnification",
    "termination": "Termination",
    "boilerplate": "Standard Boilerplate",
}

CLAUSES: List[Dict[str, Any]] = [
    {
        "id": "governing_law_generic",
        "category": "governing_law",
        "title": "Governing Law",
        "body": "This Agreement shall be governed by and construed in accordance with the laws of the State of [STATE], without regard to its conflict of laws principles.",
        "states": {
            "FL": "This Agreement shall be governed by and construed in accordance with the laws of the State of Florida, without regard to its conflict of laws principles. Venue for any action shall lie in the county in which the Property or principal obligation is situated.",
            "TX": "This Agreement shall be governed by and construed in accordance with the laws of the State of Texas, without regard to its conflict of laws principles. Exclusive venue shall lie in the county where the Agreement is performed.",
            "CA": "This Agreement shall be governed by the laws of the State of California, without regard to conflict of laws principles. The parties consent to the exclusive jurisdiction of the state and federal courts located in California.",
            "NY": "This Agreement shall be governed by the laws of the State of New York, without regard to conflict of laws principles, and the parties consent to the exclusive jurisdiction of the state and federal courts sitting in New York County.",
        },
        "tags": ["enforceability", "jurisdiction"],
    },
    {
        "id": "arbitration",
        "category": "dispute",
        "title": "Binding Arbitration",
        "body": "Any dispute, claim, or controversy arising out of or relating to this Agreement shall be settled by binding arbitration administered by the American Arbitration Association under its Commercial Arbitration Rules. Judgment on the award rendered may be entered in any court having jurisdiction.",
        "tags": ["dispute", "arbitration"],
    },
    {
        "id": "mediation_first",
        "category": "dispute",
        "title": "Mediation Before Litigation",
        "body": "Before initiating any legal action, the parties agree to first attempt in good faith to resolve any dispute through confidential mediation with a mutually agreed mediator, with costs shared equally.",
        "tags": ["dispute", "mediation"],
    },
    {
        "id": "confidentiality_mutual",
        "category": "confidentiality",
        "title": "Mutual Confidentiality",
        "body": "Each party shall hold in strict confidence all non-public information disclosed by the other party and shall not use or disclose such information except as necessary to perform under this Agreement. This obligation survives termination for a period of three (3) years.",
        "tags": ["confidentiality", "nda"],
    },
    {
        "id": "late_payment",
        "category": "payment",
        "title": "Late Payment Penalty",
        "body": "Any payment not received within [N] days of its due date shall accrue a late charge of one and one-half percent (1.5%) per month, or the maximum rate permitted by applicable law, whichever is lower, on the outstanding balance until paid in full.",
        "states": {
            "FL": "Any payment not received within [N] days of its due date shall accrue a late charge of 1.5% per month, not to exceed the maximum rate permitted under Florida law, on the outstanding balance until paid in full.",
        },
        "tags": ["payment", "penalty"],
    },
    {
        "id": "limitation_liability",
        "category": "liability",
        "title": "Limitation of Liability",
        "body": "In no event shall either party be liable to the other for any indirect, incidental, special, consequential, or punitive damages, regardless of the theory of liability, even if advised of the possibility of such damages. Each party's total aggregate liability shall not exceed the total amounts paid under this Agreement.",
        "tags": ["liability"],
    },
    {
        "id": "indemnification",
        "category": "liability",
        "title": "Indemnification",
        "body": "Each party shall indemnify, defend, and hold harmless the other party and its officers, agents, and employees from and against any and all claims, damages, losses, and expenses (including reasonable attorneys' fees) arising out of or resulting from that party's breach of this Agreement or negligent acts or omissions.",
        "tags": ["liability", "indemnity"],
    },
    {
        "id": "termination_for_cause",
        "category": "termination",
        "title": "Termination for Cause",
        "body": "Either party may terminate this Agreement upon written notice if the other party materially breaches this Agreement and fails to cure such breach within thirty (30) days after receiving written notice describing the breach in reasonable detail.",
        "tags": ["termination"],
    },
    {
        "id": "termination_convenience",
        "category": "termination",
        "title": "Termination for Convenience",
        "body": "Either party may terminate this Agreement for any reason upon thirty (30) days' prior written notice to the other party. Upon termination, the parties shall settle all outstanding obligations accrued through the effective date of termination.",
        "tags": ["termination"],
    },
    {
        "id": "force_majeure",
        "category": "boilerplate",
        "title": "Force Majeure",
        "body": "Neither party shall be liable for any failure or delay in performance due to causes beyond its reasonable control, including acts of God, war, terrorism, labor disputes, governmental action, pandemic, or failure of suppliers or telecommunications, provided the affected party gives prompt notice and resumes performance as soon as practicable.",
        "tags": ["boilerplate"],
    },
    {
        "id": "severability",
        "category": "boilerplate",
        "title": "Severability",
        "body": "If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect, and the invalid provision shall be modified to the minimum extent necessary to make it valid and enforceable.",
        "tags": ["boilerplate"],
    },
    {
        "id": "entire_agreement",
        "category": "boilerplate",
        "title": "Entire Agreement",
        "body": "This Agreement constitutes the entire agreement between the parties and supersedes all prior or contemporaneous understandings, agreements, representations, and warranties, whether written or oral, relating to its subject matter.",
        "tags": ["boilerplate"],
    },
    {
        "id": "notices",
        "category": "boilerplate",
        "title": "Notices",
        "body": "All notices under this Agreement shall be in writing and delivered by personal delivery, certified mail (return receipt requested), or nationally recognized overnight courier to the addresses set forth above, and shall be deemed given upon receipt.",
        "tags": ["boilerplate"],
    },
    {
        "id": "electronic_signature",
        "category": "boilerplate",
        "title": "Electronic Signatures & Counterparts",
        "body": "This Agreement may be executed in counterparts, each of which is deemed an original and all of which together constitute one instrument. Electronic and digitally notarized signatures shall have the same force and effect as original handwritten signatures.",
        "tags": ["boilerplate", "execution"],
    },
]

# US states with curated state-specific variants available.
SUPPORTED_STATES = {"FL": "Florida", "TX": "Texas", "CA": "California", "NY": "New York"}


def list_clauses(state: Optional[str] = None, category: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return clauses, resolving the state-specific body when a state variant exists."""
    state = (state or "").upper() or None
    out = []
    for c in CLAUSES:
        if category and c["category"] != category:
            continue
        body = c["body"]
        is_state_specific = False
        if state and c.get("states", {}).get(state):
            body = c["states"][state]
            is_state_specific = True
        out.append({
            "id": c["id"],
            "category": c["category"],
            "category_label": CLAUSE_CATEGORIES.get(c["category"], c["category"]),
            "title": c["title"],
            "body": body,
            "tags": c.get("tags", []),
            "state_specific": is_state_specific,
            "has_state_variants": bool(c.get("states")),
        })
    return out
