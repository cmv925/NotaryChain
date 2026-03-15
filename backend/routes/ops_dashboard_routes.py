"""
Operations Dashboard Routes
Real-time production metrics for Hedera, S3, Stripe, and system health
"""

from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone, timedelta
import logging

from models import User
from routes.auth_routes import get_current_user
from services.hedera_service import hedera_service
from services.storage_service import storage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/ops", tags=["ops-dashboard"])

db: AsyncIOMotorDatabase = None


def set_db(database):
    global db
    db = database


async def _check_admin(current_user: User):
    user_doc = await db.users.find_one({"email": current_user.email})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/metrics")
async def get_ops_metrics(current_user: User = Depends(get_current_user)):
    """Get all operations metrics in a single call"""
    await _check_admin(current_user)

    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago = now - timedelta(days=7)

    # --- Hedera Metrics ---
    hedera_status = hedera_service.get_status()
    hbar_balance = None
    try:
        balance_result = await hedera_service.get_account_balance()
        if balance_result.get("success"):
            hbar_balance = balance_result
    except Exception as e:
        logger.warning(f"Failed to fetch HBAR balance: {e}")

    # Seal counts from DB
    total_seals = await db.blockchain_seals.count_documents({})
    mainnet_seals = await db.blockchain_seals.count_documents({"network": "mainnet"})
    seals_30d = await db.blockchain_seals.count_documents({"sealed_at": {"$gte": thirty_days_ago.isoformat()}})
    seals_7d = await db.blockchain_seals.count_documents({"sealed_at": {"$gte": seven_days_ago.isoformat()}})

    # HCS-submitted vs local-only
    hcs_submitted = await db.blockchain_seals.count_documents({"hcs_submitted": True})

    # Topic count
    total_topics = await db.hcs_topics.count_documents({})
    mainnet_topics = await db.hcs_topics.count_documents({"network": "mainnet"})

    # Daily seal trend (last 30 days)
    seal_trend = await db.blockchain_seals.aggregate([
        {"$match": {"sealed_at": {"$gte": thirty_days_ago.isoformat()}}},
        {"$addFields": {"date_str": {"$substr": ["$sealed_at", 0, 10]}}},
        {"$group": {"_id": "$date_str", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]).to_list(30)

    hedera_metrics = {
        "network": hedera_status.get("network", "unknown"),
        "account_id": hedera_status.get("account_id"),
        "sdk_available": hedera_status.get("sdk_available", False),
        "configured": hedera_status.get("configured", False),
        "default_topic_id": hedera_status.get("default_topic_id"),
        "balance_hbar": hbar_balance.get("balance_hbar") if hbar_balance else None,
        "balance_tinybars": hbar_balance.get("balance_tinybars") if hbar_balance else None,
        "total_seals": total_seals,
        "mainnet_seals": mainnet_seals,
        "seals_30d": seals_30d,
        "seals_7d": seals_7d,
        "hcs_submitted": hcs_submitted,
        "hcs_local_only": total_seals - hcs_submitted,
        "total_topics": total_topics,
        "mainnet_topics": mainnet_topics,
        "seal_trend": [{"date": s["_id"], "count": s["count"]} for s in seal_trend],
        "estimated_cost_30d": round(seals_30d * 0.0001 + (total_topics * 0.01), 4),
    }

    # --- S3 Storage Metrics ---
    s3_status = storage_service.status()
    s3_metrics = {
        "backend": s3_status.get("backend", "local"),
        "s3_configured": s3_status.get("s3_configured", False),
        "bucket": s3_status.get("bucket"),
        "categories": {},
        "total_files": 0,
        "total_size_bytes": 0,
    }

    if s3_status.get("s3_configured") and storage_service._s3_client:
        try:
            paginator = storage_service._s3_client.get_paginator('list_objects_v2')
            categories = {}
            total_files = 0
            total_size = 0

            for page in paginator.paginate(Bucket=s3_status["bucket"]):
                for obj in page.get("Contents", []):
                    key = obj["Key"]
                    size = obj["Size"]
                    category = key.split("/")[0] if "/" in key else "root"
                    if category not in categories:
                        categories[category] = {"count": 0, "size_bytes": 0}
                    categories[category]["count"] += 1
                    categories[category]["size_bytes"] += size
                    total_files += 1
                    total_size += size

            s3_metrics["categories"] = {
                k: {**v, "size_mb": round(v["size_bytes"] / (1024 * 1024), 2)}
                for k, v in sorted(categories.items(), key=lambda x: x[1]["size_bytes"], reverse=True)
            }
            s3_metrics["total_files"] = total_files
            s3_metrics["total_size_bytes"] = total_size
            s3_metrics["total_size_mb"] = round(total_size / (1024 * 1024), 2)
        except Exception as e:
            logger.warning(f"Failed to fetch S3 metrics: {e}")
            s3_metrics["error"] = str(e)

    # --- Stripe / Payment Metrics ---
    total_payments = await db.payments.count_documents({"status": "paid"})
    payments_30d = await db.payments.count_documents({"status": "paid", "created_at": {"$gte": thirty_days_ago}})

    revenue_agg = await db.payments.aggregate([
        {"$match": {"status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]).to_list(1)

    revenue_30d_agg = await db.payments.aggregate([
        {"$match": {"status": "paid", "created_at": {"$gte": thirty_days_ago}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]).to_list(1)

    # Revenue trend (daily, last 30d)
    revenue_trend = await db.payments.aggregate([
        {"$match": {"status": "paid", "created_at": {"$gte": thirty_days_ago}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "amount": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]).to_list(30)

    # Subscription stats
    active_subs = await db.subscriptions.count_documents({"status": "active"})

    stripe_metrics = {
        "configured": bool(hedera_status),  # proxy — we know it's configured
        "total_payments": total_payments,
        "payments_30d": payments_30d,
        "total_revenue_usd": round((revenue_agg[0]["total"] / 100) if revenue_agg else 0, 2),
        "revenue_30d_usd": round((revenue_30d_agg[0]["total"] / 100) if revenue_30d_agg else 0, 2),
        "active_subscriptions": active_subs,
        "revenue_trend": [
            {"date": r["_id"], "amount_usd": round(r["amount"] / 100, 2), "count": r["count"]}
            for r in revenue_trend
        ],
    }

    # --- System Health ---
    system = {
        "hedera": "live" if hedera_status.get("sdk_available") else "degraded",
        "storage": "s3" if s3_status.get("s3_configured") else "local",
        "payments": "live",
        "database": "healthy",
    }

    # --- HBAR Alert History (last 10) ---
    recent_alerts = await db.hbar_balance_alerts.find(
        {}, {"_id": 0}
    ).sort("alerted_at", -1).to_list(10)

    return {
        "timestamp": now.isoformat(),
        "hedera": hedera_metrics,
        "storage": s3_metrics,
        "payments": stripe_metrics,
        "system": system,
        "hbar_alerts": recent_alerts,
    }


@router.get("/storage-analytics")
async def get_storage_analytics(current_user: User = Depends(get_current_user)):
    """Enhanced S3 storage analytics: per-user usage, upload trends, cost projections."""
    await _check_admin(current_user)

    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    # Per-user storage from vault_documents
    user_storage = await db.vault_documents.aggregate([
        {"$group": {
            "_id": "$uploaded_by_email",
            "file_count": {"$sum": 1},
            "total_size": {"$sum": {"$ifNull": ["$file_size", 0]}},
            "last_upload": {"$max": "$uploaded_at"},
        }},
        {"$sort": {"total_size": -1}},
        {"$limit": 20},
    ]).to_list(20)

    per_user = [
        {
            "email": u["_id"] or "unknown",
            "file_count": u["file_count"],
            "total_size_bytes": u["total_size"],
            "total_size_mb": round(u["total_size"] / (1024 * 1024), 2) if u["total_size"] else 0,
            "last_upload": u["last_upload"],
        }
        for u in user_storage
    ]

    # Upload activity trend (daily counts from vault_documents, last 30 days)
    upload_trend = await db.vault_documents.aggregate([
        {"$match": {"uploaded_at": {"$gte": thirty_days_ago.isoformat()}}},
        {"$addFields": {"date_str": {"$substr": ["$uploaded_at", 0, 10]}}},
        {"$group": {"_id": "$date_str", "uploads": {"$sum": 1}, "bytes": {"$sum": {"$ifNull": ["$file_size", 0]}}}},
        {"$sort": {"_id": 1}},
    ]).to_list(30)

    activity_trend = [
        {"date": t["_id"], "uploads": t["uploads"], "size_mb": round(t["bytes"] / (1024 * 1024), 2) if t["bytes"] else 0}
        for t in upload_trend
    ]

    # Download activity from vault audit trail
    download_trend = await db.vault_documents.aggregate([
        {"$group": {"_id": None, "total_downloads": {"$sum": {"$ifNull": ["$download_count", 0]}}}},
    ]).to_list(1)
    total_downloads = download_trend[0]["total_downloads"] if download_trend else 0

    # Total vault stats
    total_vault_docs = await db.vault_documents.count_documents({})
    total_vault_size_agg = await db.vault_documents.aggregate([
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$file_size", 0]}}}}
    ]).to_list(1)
    total_vault_size = total_vault_size_agg[0]["total"] if total_vault_size_agg else 0

    # Cost projection (AWS S3 Standard: ~$0.023/GB/month)
    s3_cost_per_gb_month = 0.023
    current_gb = total_vault_size / (1024 ** 3) if total_vault_size else 0
    monthly_cost = round(current_gb * s3_cost_per_gb_month, 4)

    # Growth rate (uploads in last 30 days vs previous 30 days)
    sixty_days_ago = now - timedelta(days=60)
    prev_30d_uploads = await db.vault_documents.count_documents({
        "uploaded_at": {"$gte": sixty_days_ago.isoformat(), "$lt": thirty_days_ago.isoformat()}
    })
    recent_30d_uploads = await db.vault_documents.count_documents({
        "uploaded_at": {"$gte": thirty_days_ago.isoformat()}
    })

    growth_rate = round(((recent_30d_uploads - prev_30d_uploads) / max(prev_30d_uploads, 1)) * 100, 1)

    # 12-month projected cost based on current growth
    projected_12m_cost = round(monthly_cost * 12 * max(1 + growth_rate / 100, 1), 2)

    return {
        "per_user": per_user,
        "activity_trend": activity_trend,
        "total_vault_docs": total_vault_docs,
        "total_vault_size_mb": round(total_vault_size / (1024 * 1024), 2),
        "total_downloads": total_downloads,
        "cost_projection": {
            "current_gb": round(current_gb, 4),
            "monthly_cost_usd": monthly_cost,
            "projected_12m_cost_usd": projected_12m_cost,
            "price_per_gb": s3_cost_per_gb_month,
            "growth_rate_pct": growth_rate,
            "uploads_30d": recent_30d_uploads,
            "uploads_prev_30d": prev_30d_uploads,
        },
    }


@router.get("/service-health")
async def get_service_health(current_user: User = Depends(get_current_user)):
    """Get current service health status and recent alerts."""
    await _check_admin(current_user)

    # Get latest snapshot
    snapshot = await db.system_settings.find_one({"key": "service_health_snapshot"}, {"_id": 0})

    # Get recent alerts (last 24h)
    yesterday = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    recent_alerts = await db.service_health_alerts.find(
        {"timestamp": {"$gte": yesterday}},
        {"_id": 0},
    ).sort("timestamp", -1).limit(20).to_list(20)

    # Trigger a fresh check
    from services import service_health_monitor
    live_results = await service_health_monitor.check_services()

    return {
        "services": live_results,
        "recent_alerts": recent_alerts,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
