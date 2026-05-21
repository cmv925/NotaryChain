"""
Comprehensive analytics builders for the admin dashboard.

Each helper takes (db, start_date, date_range) and returns one section of
the dashboard payload. Keeping them small and pure makes them individually
unit-testable and reduces the cyclomatic complexity of the route handler.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase


# ─── 1. User growth ──────────────────────────────────────────────────────────
async def build_user_growth(
    db: AsyncIOMotorDatabase, start_date: datetime, date_range: List[str]
) -> List[Dict[str, Any]]:
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "new_users": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    raw = await db.users.aggregate(pipeline).to_list(365)
    by_date = {d["_id"]: d["new_users"] for d in raw}

    cumulative = await db.users.count_documents({"created_at": {"$lt": start_date}})
    growth = []
    for date in date_range:
        new_count = by_date.get(date, 0)
        cumulative += new_count
        growth.append({"date": date, "new_users": new_count, "total_users": cumulative})
    return growth


# ─── 2. Revenue trends (Stripe + crypto) ─────────────────────────────────────
async def _daily_sum(
    db: AsyncIOMotorDatabase,
    collection: str,
    match: Dict[str, Any],
    sum_field: str,
    divisor: float = 1.0,
) -> Dict[str, float]:
    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "amount": {"$sum": f"${sum_field}"},
        }},
        {"$sort": {"_id": 1}},
    ]
    raw = await db[collection].aggregate(pipeline).to_list(365)
    return {d["_id"]: d["amount"] / divisor for d in raw}


async def build_revenue_trends(
    db: AsyncIOMotorDatabase, start_date: datetime, date_range: List[str]
) -> List[Dict[str, Any]]:
    stripe_map = await _daily_sum(
        db, "payments",
        {"status": "paid", "created_at": {"$gte": start_date}},
        "amount", divisor=100,  # cents → dollars
    )
    crypto_map = await _daily_sum(
        db, "crypto_payments",
        {"status": "confirmed", "created_at": {"$gte": start_date}},
        "usd_amount",
    )

    trends = []
    for date in date_range:
        s = stripe_map.get(date, 0)
        c = crypto_map.get(date, 0)
        trends.append({
            "date": date,
            "stripe": round(s, 2),
            "crypto": round(c, 2),
            "total": round(s + c, 2),
        })
    return trends


# ─── 3. Notarization volume ──────────────────────────────────────────────────
async def build_notarization_volume(
    db: AsyncIOMotorDatabase, start_date: datetime, date_range: List[str]
) -> List[Dict[str, Any]]:
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "count": {"$sum": 1},
            "completed": {"$sum": {"$cond": [{"$eq": ["$status", "completed"]}, 1, 0]}},
        }},
        {"$sort": {"_id": 1}},
    ]
    raw = await db.notarization_requests.aggregate(pipeline).to_list(365)
    by_date = {d["_id"]: {"count": d["count"], "completed": d["completed"]} for d in raw}

    return [
        {
            "date": date,
            "total": by_date.get(date, {}).get("count", 0),
            "completed": by_date.get(date, {}).get("completed", 0),
            "pending": by_date.get(date, {}).get("count", 0) - by_date.get(date, {}).get("completed", 0),
        }
        for date in date_range
    ]


# ─── 4. Transaction activity ─────────────────────────────────────────────────
async def build_transaction_activity(
    db: AsyncIOMotorDatabase, start_date: datetime, date_range: List[str]
) -> List[Dict[str, Any]]:
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    raw = await db.transactions.aggregate(pipeline).to_list(365)
    by_date = {d["_id"]: d["count"] for d in raw}
    return [{"date": date, "transactions": by_date.get(date, 0)} for date in date_range]


# ─── 5. Payment distribution (pie chart) ─────────────────────────────────────
_CRYPTO_COLORS = {"btc": "#F7931A", "eth": "#627EEA"}


async def build_payment_distribution(
    db: AsyncIOMotorDatabase,
    start_date: datetime,
    total_stripe: float,
) -> List[Dict[str, Any]]:
    crypto_by_type = await db.crypto_payments.aggregate([
        {"$match": {"status": "confirmed", "created_at": {"$gte": start_date}}},
        {"$group": {"_id": "$crypto_type", "amount": {"$sum": "$usd_amount"}, "count": {"$sum": 1}}},
    ]).to_list(10)

    out = [{"name": "Stripe (Card)", "value": round(total_stripe, 2), "color": "#635BFF"}]
    for ct in crypto_by_type:
        key = ct["_id"]
        out.append({
            "name": key.upper() if key else "Other Crypto",
            "value": round(ct["amount"], 2),
            "color": _CRYPTO_COLORS.get(key, "#2775CA"),
        })
    return out


# ─── 6. Top notaries leaderboard ─────────────────────────────────────────────
async def build_top_notaries(
    db: AsyncIOMotorDatabase, limit: int = 10
) -> List[Dict[str, Any]]:
    pipeline = [
        {"$match": {"status": "completed", "notary_id": {"$ne": None}}},
        {"$group": {"_id": "$notary_id", "completed_count": {"$sum": 1}}},
        {"$sort": {"completed_count": -1}},
        {"$limit": limit},
    ]
    raw = await db.notarization_requests.aggregate(pipeline).to_list(limit)

    result = []
    for n in raw:
        profile = await db.notary_profiles.find_one({"user_id": n["_id"]})
        user = await db.users.find_one({"id": n["_id"]})
        if not (profile or user):
            continue
        result.append({
            "notary_id": n["_id"],
            "name": (profile or {}).get("full_name") or (user or {}).get("full_name") or "Unknown",
            "email": (user or {}).get("email", "N/A"),
            "completed_notarizations": n["completed_count"],
        })
    return result


# ─── 7. Document & transaction type distributions ───────────────────────────
async def _group_count(
    db: AsyncIOMotorDatabase,
    collection: str,
    field: str,
    start_date: datetime,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {"_id": f"${field}", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit},
    ]
    return await db[collection].aggregate(pipeline).to_list(limit)


async def build_document_types(
    db: AsyncIOMotorDatabase, start_date: datetime
) -> List[Dict[str, Any]]:
    raw = await _group_count(db, "notarization_requests", "document_type", start_date)
    return [{"name": d["_id"] or "Unspecified", "count": d["count"]} for d in raw]


async def build_transaction_types(
    db: AsyncIOMotorDatabase, start_date: datetime
) -> List[Dict[str, Any]]:
    raw = await _group_count(db, "transactions", "transaction_type", start_date)
    return [
        {"name": (t["_id"] or "custom").replace("_", " ").title(), "count": t["count"]}
        for t in raw
    ]


# ─── 8. Summary roll-up ──────────────────────────────────────────────────────
def build_summary(
    days: int,
    user_growth: List[Dict[str, Any]],
    revenue_trends: List[Dict[str, Any]],
    notarization_volume: List[Dict[str, Any]],
    transaction_activity: List[Dict[str, Any]],
) -> Dict[str, Any]:
    total_stripe = sum(r["stripe"] for r in revenue_trends)
    total_crypto = sum(r["crypto"] for r in revenue_trends)
    return {
        "period_days": days,
        "total_revenue": round(total_stripe + total_crypto, 2),
        "stripe_revenue": round(total_stripe, 2),
        "crypto_revenue": round(total_crypto, 2),
        "new_users": sum(u["new_users"] for u in user_growth),
        "total_notarizations": sum(n["total"] for n in notarization_volume),
        "completed_notarizations": sum(n["completed"] for n in notarization_volume),
        "total_transactions": sum(t["transactions"] for t in transaction_activity),
    }
