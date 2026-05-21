"""
Notary Marketplace Routes
Browse notaries, reviews, ratings, and profiles.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging

from models import User
from routes.auth_routes import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/marketplace", tags=["marketplace"])

db: AsyncIOMotorDatabase = None


def set_db(database):
    global db
    db = database


class CreateReviewRequest(BaseModel):
    notary_id: str
    request_id: str
    rating: int  # 1-5
    comment: str = ""


class UpdateReviewRequest(BaseModel):
    rating: Optional[int] = None
    comment: Optional[str] = None


@router.get("/notaries")
async def search_notaries(
    state: Optional[str] = None,
    specialization: Optional[str] = None,
    min_rating: Optional[float] = None,
    ron_certified: Optional[bool] = None,
    search: Optional[str] = None,
    sort_by: str = Query(default="rating", regex="^(rating|experience|rate)$"),
    limit: int = Query(default=20, le=50),
    skip: int = 0,
):
    """Search and browse approved notaries in the marketplace."""
    query = {"status": "approved"}

    if state:
        query["license_state"] = state.upper()
    if specialization:
        query["specializations"] = {"$in": [specialization]}
    if ron_certified is not None:
        query["ron_certified"] = ron_certified
    if search:
        import re
        safe_search = re.escape(search)
        query["$or"] = [
            {"full_legal_name": {"$regex": safe_search, "$options": "i"}},
            {"bio": {"$regex": safe_search, "$options": "i"}},
            {"license_state": {"$regex": safe_search, "$options": "i"}},
        ]

    notaries = await db.notary_profiles.find(
        query, {"_id": 0}
    ).to_list(500)

    # Enrich with user info and ratings
    results = []
    for n in notaries:
        user = await db.users.find_one(
            {"id": n["user_id"]}, {"_id": 0, "full_name": 1, "email": 1}
        )

        # Get review stats
        reviews = await db.notary_reviews.find(
            {"notary_id": n["user_id"]}, {"_id": 0, "rating": 1}
        ).to_list(500)

        avg_rating = sum(r["rating"] for r in reviews) / len(reviews) if reviews else 0
        review_count = len(reviews)

        if min_rating and avg_rating < min_rating:
            continue

        # Count completed notarizations
        completed = await db.notarization_requests.count_documents({
            "notary_id": n["user_id"], "status": "completed"
        })

        results.append({
            "notary_id": n["user_id"],
            "name": user.get("full_name", "") if user else n.get("full_legal_name", ""),
            "license_state": n.get("license_state", ""),
            "license_number": n.get("license_number", ""),
            "ron_certified": n.get("ron_certified", False),
            "specializations": n.get("specializations", []),
            "hourly_rate": n.get("hourly_rate", 0),
            "bio": n.get("bio", ""),
            "years_experience": n.get("years_experience", 0),
            "avg_rating": round(avg_rating, 1),
            "review_count": review_count,
            "completed_notarizations": completed,
        })

    # Sort
    if sort_by == "rating":
        results.sort(key=lambda x: x["avg_rating"], reverse=True)
    elif sort_by == "experience":
        results.sort(key=lambda x: x["years_experience"], reverse=True)
    elif sort_by == "rate":
        results.sort(key=lambda x: x["hourly_rate"])

    return {"notaries": results[skip:skip + limit], "total": len(results)}


@router.get("/notaries/{notary_id}")
async def get_notary_profile(notary_id: str):
    """Get a notary's public profile with reviews."""
    profile = await db.notary_profiles.find_one(
        {"user_id": notary_id, "status": "approved"}, {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Notary not found")

    user = await db.users.find_one(
        {"id": notary_id}, {"_id": 0, "full_name": 1}
    )

    reviews = await db.notary_reviews.find(
        {"notary_id": notary_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)

    avg_rating = sum(r["rating"] for r in reviews) / len(reviews) if reviews else 0
    completed = await db.notarization_requests.count_documents({
        "notary_id": notary_id, "status": "completed"
    })

    return {
        "notary_id": notary_id,
        "name": user.get("full_name", "") if user else profile.get("full_legal_name", ""),
        "license_state": profile.get("license_state", ""),
        "license_number": profile.get("license_number", ""),
        "ron_certified": profile.get("ron_certified", False),
        "specializations": profile.get("specializations", []),
        "hourly_rate": profile.get("hourly_rate", 0),
        "bio": profile.get("bio", ""),
        "years_experience": profile.get("years_experience", 0),
        "avg_rating": round(avg_rating, 1),
        "review_count": len(reviews),
        "completed_notarizations": completed,
        "reviews": reviews,
    }


# === Reviews ===

@router.post("/reviews")
async def create_review(
    body: CreateReviewRequest,
    current_user: User = Depends(get_current_user),
):
    """Leave a review for a notary after a completed notarization."""
    if body.rating < 1 or body.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be 1-5")

    # Verify the request exists and is completed
    req = await db.notarization_requests.find_one({
        "id": body.request_id,
        "user_id": current_user.id,
        "notary_id": body.notary_id,
        "status": "completed",
    })
    if not req:
        raise HTTPException(status_code=400, detail="No completed notarization found for this notary")

    # Check for duplicate review
    existing = await db.notary_reviews.find_one({
        "user_id": current_user.id,
        "request_id": body.request_id,
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already reviewed this notarization")

    review = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "user_name": current_user.full_name or current_user.email.split("@")[0],
        "notary_id": body.notary_id,
        "request_id": body.request_id,
        "rating": body.rating,
        "comment": body.comment,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.notary_reviews.insert_one(review)
    review.pop("_id", None)
    return review


@router.get("/reviews/notary/{notary_id}")
async def get_notary_reviews(
    notary_id: str,
    limit: int = Query(default=20, le=50),
):
    """Get reviews for a specific notary."""
    reviews = await db.notary_reviews.find(
        {"notary_id": notary_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)

    avg_rating = sum(r["rating"] for r in reviews) / len(reviews) if reviews else 0

    return {
        "reviews": reviews,
        "total": len(reviews),
        "avg_rating": round(avg_rating, 1),
    }


@router.delete("/reviews/{review_id}")
async def delete_review(
    review_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete own review."""
    result = await db.notary_reviews.delete_one({
        "id": review_id, "user_id": current_user.id
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Review not found")
    return {"message": "Review deleted"}



# ─────────────────────────────────────────────────────────────────────────────
# Dynamic Pricing — transparent breakdown so prospects see *why* a price is
# what it is (state surcharge × doc complexity × urgency × rating premium).
# ─────────────────────────────────────────────────────────────────────────────

# Calibrated against published average notary fees + RON adoption / supply.
STATE_MULTIPLIER = {
    "NY": 1.20, "CA": 1.15, "FL": 1.00, "TX": 1.00, "VA": 1.00,
}

DOC_MULTIPLIER = {
    "real_estate":       1.50,
    "deed":              1.50,
    "mortgage":          1.45,
    "lien_release":      1.30,
    "power_of_attorney": 1.30,
    "will":              1.30,
    "trust":             1.30,
    "affidavit":         1.00,
    "acknowledgment":    1.00,
    "general":           1.00,
}

URGENCY_MULTIPLIER = {
    "standard":    1.00,
    "same_day":    1.30,
    "after_hours": 1.25,
    "weekend":     1.20,
    "rush":        1.40,
}

DEFAULT_BASE_RATE_USD = 25.0


def _rating_premium(avg_rating: float, review_count: int) -> float:
    """≥4.5 stars w/ 5+ reviews → +10% premium; ≥4.8 → +15%."""
    if review_count < 5:
        return 1.00
    if avg_rating >= 4.8:
        return 1.15
    if avg_rating >= 4.5:
        return 1.10
    return 1.00


class QuoteRequest(BaseModel):
    notary_id: str
    state_code: str
    document_type: str
    urgency: str = "standard"  # standard | same_day | after_hours | weekend | rush


@router.post("/quote")
async def get_dynamic_quote(req: QuoteRequest):
    """Return a transparent price breakdown for a notary + ceremony combo.
    Public (no auth) so prospects can see prices before signing up.
    """
    # Notary could be referenced by either profile-id or user-id (existing
    # list endpoint exposes `notary_id` = user_id), so resolve both.
    profile = await db.notary_profiles.find_one(
        {"$or": [{"id": req.notary_id}, {"user_id": req.notary_id}], "status": "approved"},
        {"_id": 0}
    )
    if not profile:
        raise HTTPException(404, "Notary not found or not yet approved")

    base = float(profile.get("hourly_rate") or 0) or DEFAULT_BASE_RATE_USD

    # Pull rating for premium calc
    reviews = await db.notary_reviews.find(
        {"notary_id": profile["user_id"]}, {"_id": 0, "rating": 1}
    ).to_list(500)
    avg = round(sum(r["rating"] for r in reviews) / len(reviews), 2) if reviews else 0.0
    count = len(reviews)

    state_m = STATE_MULTIPLIER.get(req.state_code.upper(), 1.0)
    doc_m = DOC_MULTIPLIER.get((req.document_type or "general").lower(), 1.0)
    urg_m = URGENCY_MULTIPLIER.get((req.urgency or "standard").lower(), 1.0)
    rating_m = _rating_premium(avg, count)
    total = round(base * state_m * doc_m * urg_m * rating_m, 2)

    return {
        "notary_id": profile["user_id"],
        "state_code": req.state_code.upper(),
        "document_type": req.document_type,
        "urgency": req.urgency,
        "base_usd": round(base, 2),
        "state_multiplier": state_m,
        "document_multiplier": doc_m,
        "urgency_multiplier": urg_m,
        "rating_premium": rating_m,
        "total_usd": total,
        "breakdown": [
            {"label": "Base rate", "value": round(base, 2), "multiplier": 1.0},
            {"label": f"{req.state_code.upper()} state surcharge", "value": round(base * (state_m - 1), 2), "multiplier": state_m},
            {"label": f"{req.document_type} complexity", "value": round(base * state_m * (doc_m - 1), 2), "multiplier": doc_m},
            {"label": f"{req.urgency} urgency", "value": round(base * state_m * doc_m * (urg_m - 1), 2), "multiplier": urg_m},
            {"label": "Rating premium" if rating_m > 1 else "Rating premium (none — needs 5+ reviews at ≥4.5★)", "value": round(base * state_m * doc_m * urg_m * (rating_m - 1), 2), "multiplier": rating_m},
        ],
        "valid_for_minutes": 30,
        "issued_at": datetime.now(timezone.utc).isoformat(),
    }
