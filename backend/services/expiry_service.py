"""
Document Expiry Service
Periodically checks for documents nearing expiry and sends notifications.
Thresholds: 30 days, 7 days, 1 day, and expired.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

db = None
notification_service = None
email_service_instance = None

CHECK_INTERVAL_SECONDS = 3600  # Check every hour
THRESHOLDS = [
    {"days": 30, "label": "30 days", "level": "info"},
    {"days": 7, "label": "7 days", "level": "warning"},
    {"days": 1, "label": "1 day", "level": "urgent"},
    {"days": 0, "label": "expired", "level": "critical"},
]


def set_dependencies(database, notif_svc, email_svc):
    global db, notification_service, email_service_instance
    db = database
    notification_service = notif_svc
    email_service_instance = email_svc


async def _check_expiring_documents():
    """Scan documents with expiry dates and notify users at threshold boundaries."""
    if db is None:
        return

    now = datetime.now(timezone.utc)

    for threshold in THRESHOLDS:
        days = threshold["days"]
        label = threshold["label"]
        level = threshold["level"]

        if days > 0:
            window_start = now + timedelta(days=days - 1)
            window_end = now + timedelta(days=days + 1)
        else:
            window_start = None
            window_end = now

        # Build query for notarization requests with expires_at in the window
        query = {"expires_at": {"$exists": True, "$ne": None}}
        if days > 0:
            query["expires_at"]["$gte"] = window_start.isoformat()
            query["expires_at"]["$lte"] = window_end.isoformat()
        else:
            query["expires_at"]["$lte"] = window_end.isoformat()

        # Check notification_sent flag to avoid duplicates
        notif_key = f"expiry_notified_{label.replace(' ', '_')}"
        query[notif_key] = {"$ne": True}

        docs = await db.notarization_requests.find(
            query, {"_id": 0}
        ).to_list(200)

        for doc in docs:
            user_id = doc.get("user_id")
            doc_name = doc.get("document_name", "Document")
            doc_id = doc.get("id")

            if not user_id:
                continue

            # Create in-app notification
            if notification_service:
                if days > 0:
                    title = f"Document Expiring in {label}"
                    message = f'Your document "{doc_name}" will expire in {label}. Please take action.'
                else:
                    title = "Document Expired"
                    message = f'Your document "{doc_name}" has expired.'

                await notification_service.create_notification(
                    user_id=user_id,
                    title=title,
                    message=message,
                    notif_type=level,
                    link="/dashboard",
                    metadata={"document_id": doc_id, "expiry_threshold": label},
                )

            # Send email notification
            if email_service_instance:
                user = await db.users.find_one({"id": user_id}, {"_id": 0, "email": 1, "full_name": 1})
                if user:
                    try:
                        await email_service_instance.send_expiry_notification_email(
                            email=user["email"],
                            full_name=user.get("full_name", "User"),
                            document_name=doc_name,
                            expiry_label=label,
                            is_expired=(days == 0),
                        )
                    except Exception as e:
                        logger.warning(f"Failed to send expiry email for doc {doc_id}: {e}")

            # Mark as notified for this threshold
            await db.notarization_requests.update_one(
                {"id": doc_id},
                {"$set": {notif_key: True}},
            )

        if docs:
            logger.info(f"Expiry check: sent {len(docs)} notifications for threshold '{label}'")


async def run_expiry_checker():
    """Background loop that checks for expiring documents periodically."""
    logger.info("Document expiry checker started")
    while True:
        try:
            await _check_expiring_documents()
        except Exception as e:
            logger.error(f"Expiry checker error: {e}")
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
