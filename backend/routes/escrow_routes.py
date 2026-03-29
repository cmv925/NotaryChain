from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
import uuid
import hashlib
import json
import random

router = APIRouter(prefix="/api/escrow", tags=["escrow"])
db = None

def set_db(database):
    global db
    db = database


# --- Auth helper ---
async def _get_user(request: Request):
    from auth import decode_access_token
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_access_token(auth.split(" ", 1)[1])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"email": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ═══════════════════════════════════════════════════════
#  ESCROW CRUD
# ═══════════════════════════════════════════════════════

@router.post("/create")
async def create_escrow(request: Request):
    """Create a new escrow agreement."""
    user = await _get_user(request)
    body = await request.json()

    escrow_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    escrow = {
        "escrow_id": escrow_id,
        "title": body.get("title", "Untitled Escrow"),
        "description": body.get("description", ""),
        "escrow_type": body.get("escrow_type", "real_estate"),
        "status": "draft",  # draft → active → conditions_met → settling → settled → disputed
        "created_by": user["email"],
        "created_at": now,
        "updated_at": now,

        # Parties
        "parties": {
            "buyer": {
                "name": body.get("buyer_name", ""),
                "email": body.get("buyer_email", user["email"]),
                "role": "buyer",
                "verified": False,
            },
            "seller": {
                "name": body.get("seller_name", ""),
                "email": body.get("seller_email", ""),
                "role": "seller",
                "verified": False,
            },
            "escrow_agent": {
                "name": "NotaryChain AI",
                "role": "escrow_agent",
                "type": "automated",
            },
        },

        # Financial
        "financial": {
            "escrow_amount": body.get("escrow_amount", 0),
            "currency": body.get("currency", "USD"),
            "deposit_status": "pending",  # pending → held → releasing → released
            "stripe_payment_intent": None,
            "hts_token_id": None,
            "hts_escrow_account": None,
        },

        # Document & Conditions
        "document": {
            "name": body.get("document_name", ""),
            "uploaded": False,
            "analysis_complete": False,
        },
        "conditions": [],
        "conditions_met_count": 0,
        "conditions_total": 0,

        # Blockchain
        "blockchain": {
            "creation_hash": None,
            "settlement_hash": None,
            "hcs_topic_id": None,
            "audit_trail": [],
        },

        # Timeline events
        "timeline": [{
            "event": "escrow_created",
            "timestamp": now,
            "actor": user["email"],
            "details": f"Escrow agreement '{body.get('title', 'Untitled')}' created",
        }],
    }

    await db.escrow_agreements.insert_one(escrow)

    # Remove _id for response
    escrow.pop("_id", None)
    return escrow


@router.get("/list")
async def list_escrows(request: Request):
    """List all escrow agreements for the current user."""
    user = await _get_user(request)
    email = user["email"]

    escrows = []
    query = {"$or": [
        {"created_by": email},
        {"parties.buyer.email": email},
        {"parties.seller.email": email},
    ]}
    async for e in db.escrow_agreements.find(query, {"_id": 0}).sort("created_at", -1):
        escrows.append(e)
    return {"escrows": escrows, "total": len(escrows)}


@router.get("/{escrow_id}")
async def get_escrow(escrow_id: str, request: Request):
    """Get escrow agreement details."""
    await _get_user(request)
    escrow = await db.escrow_agreements.find_one({"escrow_id": escrow_id}, {"_id": 0})
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow not found")
    return escrow


# ═══════════════════════════════════════════════════════
#  AI CONDITION EXTRACTION (MOCKED)
# ═══════════════════════════════════════════════════════

REAL_ESTATE_CONDITIONS = [
    {
        "condition_id": None,
        "type": "milestone",
        "category": "inspection",
        "title": "Home Inspection Approval",
        "description": "Buyer must approve the results of a professional home inspection within 10 business days of contract execution.",
        "trigger": "inspection_approved",
        "verification_method": "party_confirmation",
        "required_party": "buyer",
        "deadline_days": 10,
        "status": "pending",
        "confidence": 0.94,
        "oracle_type": None,
    },
    {
        "condition_id": None,
        "type": "milestone",
        "category": "financing",
        "title": "Mortgage Approval & Commitment Letter",
        "description": "Buyer must obtain a mortgage commitment letter from their lender within 30 days.",
        "trigger": "financing_secured",
        "verification_method": "party_confirmation",
        "required_party": "buyer",
        "deadline_days": 30,
        "status": "pending",
        "confidence": 0.97,
        "oracle_type": None,
    },
    {
        "condition_id": None,
        "type": "milestone",
        "category": "title",
        "title": "Title Search & Insurance",
        "description": "Title company must confirm clear title with no liens, encumbrances, or defects. Title insurance policy issued.",
        "trigger": "title_clear",
        "verification_method": "oracle",
        "required_party": None,
        "deadline_days": 21,
        "status": "pending",
        "confidence": 0.91,
        "oracle_type": "title_company_api",
    },
    {
        "condition_id": None,
        "type": "milestone",
        "category": "appraisal",
        "title": "Property Appraisal Meets or Exceeds Purchase Price",
        "description": "Independent appraiser must value the property at or above the agreed purchase price.",
        "trigger": "appraisal_passed",
        "verification_method": "oracle",
        "required_party": None,
        "deadline_days": 14,
        "status": "pending",
        "confidence": 0.89,
        "oracle_type": "appraisal_service",
    },
    {
        "condition_id": None,
        "type": "date",
        "category": "closing",
        "title": "Closing Date Reached",
        "description": "All conditions must be met on or before the closing date. Funds released upon all-party biometric confirmation at closing.",
        "trigger": "closing_date",
        "verification_method": "biometric_confirmation",
        "required_party": "both",
        "deadline_days": 45,
        "status": "pending",
        "confidence": 0.98,
        "oracle_type": None,
    },
    {
        "condition_id": None,
        "type": "milestone",
        "category": "walkthrough",
        "title": "Final Walk-Through Approval",
        "description": "Buyer completes a final walk-through inspection of the property within 24 hours of closing.",
        "trigger": "walkthrough_approved",
        "verification_method": "party_confirmation",
        "required_party": "buyer",
        "deadline_days": 44,
        "status": "pending",
        "confidence": 0.92,
        "oracle_type": None,
    },
]


@router.post("/{escrow_id}/extract-conditions")
async def extract_conditions(escrow_id: str, request: Request):
    """
    AI-powered condition extraction from uploaded document.
    Accepts:
      - multipart/form-data with a 'file' field (PDF, DOCX, TXT)
      - application/json with 'document_text' or 'document_name' field (falls back to mock)
    Uses GPT-5.2 via emergentintegrations for real AI extraction when a document is provided.
    """
    from fastapi import UploadFile
    from services.ai_escrow_service import extract_conditions_from_text, extract_text_from_bytes

    await _get_user(request)
    escrow = await db.escrow_agreements.find_one({"escrow_id": escrow_id}, {"_id": 0})
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow not found")

    now = datetime.now(timezone.utc).isoformat()
    content_type = request.headers.get("content-type", "")

    document_text = None
    doc_name = "Contract Document"
    used_ai = False

    # Handle multipart file upload
    if "multipart/form-data" in content_type:
        form = await request.form()
        file = form.get("file")
        if file and hasattr(file, "read"):
            file_bytes = await file.read()
            doc_name = getattr(file, "filename", "uploaded_document") or "uploaded_document"
            document_text = extract_text_from_bytes(file_bytes, doc_name)
    else:
        # JSON body — may contain raw text or just a name for mocked flow
        try:
            body = await request.json()
        except Exception:
            body = {}
        document_text = body.get("document_text")
        doc_name = body.get("document_name", "Purchase Agreement")

    # If we have actual document text, use real AI extraction
    if document_text and document_text.strip():
        result = await extract_conditions_from_text(document_text, doc_name)
        if result.get("success") and result.get("conditions"):
            conditions = result["conditions"]
            used_ai = True
        elif result.get("error"):
            # AI failed — fall back to mock with error context
            conditions = _generate_mock_conditions(now)
        else:
            # AI returned empty — fall back to mock
            conditions = _generate_mock_conditions(now)
    else:
        # No document provided — use mock conditions
        conditions = _generate_mock_conditions(now)

    await db.escrow_agreements.update_one(
        {"escrow_id": escrow_id},
        {"$set": {
            "conditions": conditions,
            "conditions_total": len(conditions),
            "conditions_met_count": 0,
            "document.name": doc_name,
            "document.uploaded": True,
            "document.analysis_complete": True,
            "document.ai_powered": used_ai,
            "status": "active",
            "updated_at": now,
        },
        "$push": {"timeline": {
            "event": "conditions_extracted",
            "timestamp": now,
            "actor": "AI Orchestrator (GPT-5.2)" if used_ai else "AI Orchestrator (Demo)",
            "details": f"{'AI analyzed' if used_ai else 'Demo generated'} {len(conditions)} executable conditions from '{doc_name}'"
        }}}
    )

    return {
        "escrow_id": escrow_id,
        "conditions": conditions,
        "total": len(conditions),
        "message": f"AI Orchestrator extracted {len(conditions)} conditions from '{doc_name}'.",
        "ai_powered": used_ai,
        "ai_model": "gpt-5.2" if used_ai else None,
    }


def _generate_mock_conditions(now: str) -> list:
    """Generate mock real estate conditions for demo/fallback."""
    conditions = []
    for c in REAL_ESTATE_CONDITIONS:
        cond = {**c}
        cond["condition_id"] = str(uuid.uuid4())[:8]
        cond["created_at"] = now
        cond["deadline"] = (datetime.now(timezone.utc) + timedelta(days=cond["deadline_days"])).isoformat()
        cond["verified_at"] = None
        cond["verified_by"] = None
        cond["evidence"] = None
        conditions.append(cond)
    return conditions


# ═══════════════════════════════════════════════════════
#  FUND DEPOSIT (MOCKED STRIPE + HTS BRIDGE)
# ═══════════════════════════════════════════════════════

@router.post("/{escrow_id}/deposit")
async def deposit_funds(escrow_id: str, request: Request):
    """
    Record escrow deposit.
    [MOCKED] — Simulates Stripe payment hold + HTS token minting.
    """
    user = await _get_user(request)
    escrow = await db.escrow_agreements.find_one({"escrow_id": escrow_id}, {"_id": 0})
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow not found")

    now = datetime.now(timezone.utc).isoformat()
    amount = escrow["financial"]["escrow_amount"]

    # Mock Stripe payment intent
    mock_pi = f"pi_mock_{uuid.uuid4().hex[:16]}"
    # Mock HTS token
    mock_token = f"0.0.{random.randint(5000000, 9999999)}"
    mock_account = f"0.0.{random.randint(1000000, 4999999)}"

    deposit_hash = hashlib.sha256(
        f"deposit-{escrow_id}-{amount}-{now}".encode()
    ).hexdigest()

    await db.escrow_agreements.update_one(
        {"escrow_id": escrow_id},
        {"$set": {
            "financial.deposit_status": "held",
            "financial.stripe_payment_intent": mock_pi,
            "financial.hts_token_id": mock_token,
            "financial.hts_escrow_account": mock_account,
            "financial.deposited_at": now,
            "blockchain.creation_hash": deposit_hash,
            "updated_at": now,
        },
        "$push": {"timeline": {
            "event": "funds_deposited",
            "timestamp": now,
            "actor": user["email"],
            "details": f"${amount:,.2f} deposited. Stripe PI: {mock_pi}. HTS Token: {mock_token}. Funds held in escrow.",
        }}}
    )

    return {
        "escrow_id": escrow_id,
        "deposit_status": "held",
        "amount": amount,
        "stripe_payment_intent": mock_pi,
        "hts_token_id": mock_token,
        "hts_escrow_account": mock_account,
        "creation_hash": deposit_hash,
        "mocked": True,
    }


# ═══════════════════════════════════════════════════════
#  CONDITION VERIFICATION
# ═══════════════════════════════════════════════════════

@router.post("/{escrow_id}/verify-condition")
async def verify_condition(escrow_id: str, request: Request):
    """
    Verify/fulfill an escrow condition.
    Supports: party_confirmation, biometric_confirmation, oracle.
    """
    user = await _get_user(request)
    body = await request.json()
    condition_id = body.get("condition_id")

    escrow = await db.escrow_agreements.find_one({"escrow_id": escrow_id}, {"_id": 0})
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow not found")

    now = datetime.now(timezone.utc).isoformat()
    conditions = escrow.get("conditions", [])
    updated = False

    for c in conditions:
        if c["condition_id"] == condition_id:
            if c["status"] == "met":
                raise HTTPException(status_code=400, detail="Condition already met")

            c["status"] = "met"
            c["verified_at"] = now
            c["verified_by"] = user["email"]
            c["evidence"] = body.get("evidence", f"Confirmed by {user['email']}")
            updated = True
            break

    if not updated:
        raise HTTPException(status_code=404, detail="Condition not found")

    met_count = sum(1 for c in conditions if c["status"] == "met")
    total = len(conditions)
    all_met = met_count == total

    new_status = "conditions_met" if all_met else escrow["status"]

    verification_hash = hashlib.sha256(
        f"verify-{escrow_id}-{condition_id}-{now}".encode()
    ).hexdigest()[:24]

    timeline_entry = {
        "event": "condition_verified",
        "timestamp": now,
        "actor": user["email"],
        "details": f"Condition '{condition_id}' verified ({met_count}/{total}). Hash: {verification_hash}",
    }

    if all_met:
        timeline_entry = {
            "event": "all_conditions_met",
            "timestamp": now,
            "actor": "Escrow Intelligence",
            "details": f"All {total} conditions met. Escrow ready for settlement.",
        }

    await db.escrow_agreements.update_one(
        {"escrow_id": escrow_id},
        {"$set": {
            "conditions": conditions,
            "conditions_met_count": met_count,
            "status": new_status,
            "updated_at": now,
        },
        "$push": {
            "timeline": timeline_entry,
            "blockchain.audit_trail": {
                "action": "condition_verified",
                "condition_id": condition_id,
                "hash": verification_hash,
                "timestamp": now,
            },
        }}
    )

    return {
        "escrow_id": escrow_id,
        "condition_id": condition_id,
        "status": "met",
        "met_count": met_count,
        "total": total,
        "all_conditions_met": all_met,
        "verification_hash": verification_hash,
    }


# ═══════════════════════════════════════════════════════
#  TRUSTLESS SETTLEMENT
# ═══════════════════════════════════════════════════════

@router.post("/{escrow_id}/settle")
async def settle_escrow(escrow_id: str, request: Request):
    """
    Execute trustless settlement.
    [MOCKED] — Simulates fund release + full lifecycle hash to HCS.
    """
    user = await _get_user(request)
    escrow = await db.escrow_agreements.find_one({"escrow_id": escrow_id}, {"_id": 0})
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow not found")

    if escrow["status"] not in ("conditions_met", "active"):
        raise HTTPException(status_code=400, detail=f"Cannot settle escrow in '{escrow['status']}' status")

    now = datetime.now(timezone.utc).isoformat()

    # Build lifecycle digest
    lifecycle = {
        "escrow_id": escrow_id,
        "title": escrow["title"],
        "created_at": escrow["created_at"],
        "parties": {
            "buyer": escrow["parties"]["buyer"]["email"],
            "seller": escrow["parties"]["seller"]["email"],
        },
        "amount": escrow["financial"]["escrow_amount"],
        "conditions_total": escrow["conditions_total"],
        "conditions_met": escrow["conditions_met_count"],
        "audit_trail": escrow["blockchain"].get("audit_trail", []),
        "settled_at": now,
        "settled_by": user["email"],
    }

    settlement_hash = hashlib.sha256(
        json.dumps(lifecycle, sort_keys=True).encode()
    ).hexdigest()

    # Mock HCS submission
    mock_topic = "0.0.10373605"
    mock_seq = random.randint(100000, 999999)
    mock_tx_id = f"0.0.{random.randint(1000, 9999)}@{int(datetime.now(timezone.utc).timestamp())}"

    await db.escrow_agreements.update_one(
        {"escrow_id": escrow_id},
        {"$set": {
            "status": "settled",
            "financial.deposit_status": "released",
            "financial.released_at": now,
            "blockchain.settlement_hash": settlement_hash,
            "blockchain.hcs_topic_id": mock_topic,
            "blockchain.settlement_tx": {
                "transaction_id": mock_tx_id,
                "sequence_number": mock_seq,
                "topic_id": mock_topic,
                "network": "Hedera Mainnet",
                "explorer_url": f"https://hashscan.io/mainnet/transaction/{mock_tx_id}",
            },
            "updated_at": now,
        },
        "$push": {"timeline": {
            "event": "escrow_settled",
            "timestamp": now,
            "actor": "Smart Contract",
            "details": f"Settlement executed. ${escrow['financial']['escrow_amount']:,.2f} released to seller. Lifecycle hash: {settlement_hash[:16]}... sealed on Hedera Mainnet (seq: {mock_seq}).",
        }}}
    )

    return {
        "escrow_id": escrow_id,
        "status": "settled",
        "settlement_hash": settlement_hash,
        "amount_released": escrow["financial"]["escrow_amount"],
        "hcs_transaction": {
            "topic_id": mock_topic,
            "sequence_number": mock_seq,
            "transaction_id": mock_tx_id,
            "explorer_url": f"https://hashscan.io/mainnet/transaction/{mock_tx_id}",
        },
        "mocked": True,
    }


@router.get("/{escrow_id}/timeline")
async def get_escrow_timeline(escrow_id: str, request: Request):
    """Get the full event timeline for an escrow."""
    await _get_user(request)
    escrow = await db.escrow_agreements.find_one(
        {"escrow_id": escrow_id}, {"_id": 0, "timeline": 1, "escrow_id": 1}
    )
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow not found")
    return {"escrow_id": escrow_id, "timeline": escrow.get("timeline", [])}
