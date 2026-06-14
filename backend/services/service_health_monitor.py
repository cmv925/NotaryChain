"""
Service Degradation Monitor
Background service that periodically checks the health of all critical integrations
(S3, Stripe, Hedera, MongoDB) and sends alerts when any service degrades.
"""

import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

db = None
notification_service = None
email_service_instance = None

CHECK_INTERVAL_SECONDS = 300  # 5 minutes
COOLDOWN_MINUTES = 60  # Don't re-alert same service within 60 min

_last_alerted = {}  # service_name -> last alert datetime
_prev_status = {}   # service_name -> last known status


def set_dependencies(database, notif_service=None, email_service=None):
    global db, notification_service, email_service_instance
    db = database
    notification_service = notif_service
    email_service_instance = email_service


async def _check_mongodb():
    """Check MongoDB connectivity."""
    try:
        await db.command("ping")
        return {"service": "MongoDB", "status": "healthy", "detail": "Connected"}
    except Exception as e:
        return {"service": "MongoDB", "status": "degraded", "detail": str(e)}


async def _check_s3():
    """Check AWS S3 connectivity."""
    if not os.environ.get("AWS_ACCESS_KEY_ID"):
        return {"service": "AWS S3", "status": "not_configured", "detail": "No credentials"}
    try:
        import boto3
        s3 = boto3.client(
            "s3",
            aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
            region_name=os.environ.get("AWS_REGION", "us-east-1"),
        )
        bucket = os.environ.get("AWS_S3_BUCKET")
        s3.head_bucket(Bucket=bucket)
        return {"service": "AWS S3", "status": "healthy", "detail": f"Bucket: {bucket}"}
    except Exception as e:
        return {"service": "AWS S3", "status": "degraded", "detail": str(e)[:120]}


async def _check_stripe():
    """Check Stripe API connectivity."""
    if not os.environ.get("STRIPE_API_KEY"):
        return {"service": "Stripe", "status": "not_configured", "detail": "No key"}
    try:
        import stripe
        stripe.api_key = os.environ.get("STRIPE_API_KEY")
        stripe.Account.retrieve()
        return {"service": "Stripe", "status": "healthy", "detail": "API reachable"}
    except Exception as e:
        return {"service": "Stripe", "status": "degraded", "detail": str(e)[:120]}


async def _check_hedera():
    """Check Hedera connectivity via account balance."""
    if not os.environ.get("HEDERA_ACCOUNT_ID"):
        return {"service": "Hedera", "status": "not_configured", "detail": "No credentials"}
    try:
        import httpx
        network = os.environ.get("HEDERA_NETWORK", "mainnet")
        account_id = os.environ.get("HEDERA_ACCOUNT_ID")
        base_url = "https://mainnet.mirrornode.hedera.com" if network == "mainnet" else "https://testnet.mirrornode.hedera.com"
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{base_url}/api/v1/accounts/{account_id}")
            if r.status_code == 200:
                return {"service": "Hedera", "status": "healthy", "detail": f"Account: {account_id}"}
            return {"service": "Hedera", "status": "degraded", "detail": f"HTTP {r.status_code}"}
    except Exception as e:
        return {"service": "Hedera", "status": "degraded", "detail": str(e)[:120]}


async def _run_health_checks():
    """Run all health checks and return results."""
    checks = await asyncio.gather(
        _check_mongodb(),
        _check_s3(),
        _check_stripe(),
        _check_hedera(),
        return_exceptions=True,
    )
    results = []
    for check in checks:
        if isinstance(check, Exception):
            results.append({"service": "Unknown", "status": "error", "detail": str(check)})
        else:
            results.append(check)
    return results


async def _send_degradation_alert(service_result):
    """Send alert when a service degrades."""
    service = service_result["service"]
    now = datetime.now(timezone.utc)

    # Check cooldown
    last = _last_alerted.get(service)
    if last and (now - last) < timedelta(minutes=COOLDOWN_MINUTES):
        return

    _last_alerted[service] = now

    # Log to DB
    await db.service_health_alerts.insert_one({
        "service": service,
        "status": service_result["status"],
        "detail": service_result["detail"],
        "timestamp": now.isoformat(),
    })

    logger.warning("SERVICE DEGRADED: %s — %s", service, service_result["detail"])

    # In-app notification to admins
    if notification_service:
        try:
            admins = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(50)
            for admin in admins:
                await notification_service.create_notification(
                    user_id=admin["id"],
                    title=f"Service Alert: {service} Degraded",
                    message=f"{service} is experiencing issues: {service_result['detail'][:200]}",
                    notif_type="critical",
                )
        except Exception as e:
            logger.error("Failed to send degradation notification: %s", e)

    # Email to admins
    if email_service_instance:
        try:
            admins = await db.users.find({"role": "admin"}, {"_id": 0, "email": 1}).to_list(50)
            for admin in admins:
                await email_service_instance.send_email(
                    to_email=admin["email"],
                    subject=f"[NotaryChain Alert] {service} Service Degraded",
                    html_content=f"""
                    <h2>Service Health Alert</h2>
                    <p><strong>{service}</strong> is currently <span style='color:red'>degraded</span>.</p>
                    <p>Details: {service_result['detail']}</p>
                    <p>Detected at: {now.strftime('%Y-%m-%d %H:%M UTC')}</p>
                    <p>Please check your {service} configuration and service status.</p>
                    """,
                )
        except Exception as e:
            logger.error("Failed to send degradation email: %s", e)


async def _send_recovery_alert(service_name):
    """Send recovery notification when a service comes back online."""
    now = datetime.now(timezone.utc)

    await db.service_health_alerts.insert_one({
        "service": service_name,
        "status": "recovered",
        "detail": "Service is back to healthy",
        "timestamp": now.isoformat(),
    })

    logger.info("SERVICE RECOVERED: %s", service_name)

    if notification_service:
        try:
            admins = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(50)
            for admin in admins:
                await notification_service.create_notification(
                    user_id=admin["id"],
                    title=f"Service Recovered: {service_name}",
                    message=f"{service_name} is back to healthy status.",
                    notif_type="info",
                )
        except Exception as e:
            logger.error("Failed to send recovery notification: %s", e)


async def check_services():
    """Run a single health check cycle."""
    if db is None:
        return []

    results = await _run_health_checks()
    now = datetime.now(timezone.utc)

    for result in results:
        service = result["service"]
        status = result["status"]
        prev = _prev_status.get(service)

        if status == "degraded":
            await _send_degradation_alert(result)
        elif status == "healthy" and prev == "degraded":
            await _send_recovery_alert(service)

        _prev_status[service] = status

    # Store latest health snapshot
    await db.system_settings.update_one(
        {"key": "service_health_snapshot"},
        {"$set": {
            "key": "service_health_snapshot",
            "services": results,
            "checked_at": now.isoformat(),
        }},
        upsert=True,
    )

    return results


async def run_service_monitor():
    """Background loop that monitors service health."""
    logger.info("Service degradation monitor started")
    await asyncio.sleep(15)  # Let services initialize
    while True:
        try:
            await check_services()
        except Exception as e:
            logger.error("Service monitor error: %s", e)
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
