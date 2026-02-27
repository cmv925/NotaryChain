"""
Smart Reminders Service
Scheduled checks for overdue tasks, upcoming bookings, pending signatures.
Generates .ics calendar exports.
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

db = None
notification_service = None

CHECK_INTERVAL_SECONDS = 1800  # 30 minutes


def set_dependencies(database, notif_svc):
    global db, notification_service
    db = database
    notification_service = notif_svc


async def _check_overdue_tasks():
    """Find transaction tasks that are overdue and notify assigned users."""
    if db is None:
        return
    now = datetime.now(timezone.utc)
    overdue = await db.transaction_tasks.find({
        "status": {"$in": ["pending", "in_progress"]},
        "due_date": {"$lt": now},
        "reminder_sent_overdue": {"$ne": True},
    }, {"_id": 0}).to_list(50)

    for task in overdue:
        tx = await db.transactions.find_one({"id": task["transaction_id"]}, {"_id": 0, "name": 1})
        tx_name = tx.get("name", "Transaction") if tx else "Transaction"
        participants = await db.transaction_participants.find(
            {"transaction_id": task["transaction_id"]}, {"_id": 0, "user_id": 1}
        ).to_list(20)

        for p in participants:
            if notification_service and p.get("user_id"):
                await notification_service.create_notification(
                    user_id=p["user_id"],
                    title="Overdue Task",
                    message=f'Task "{task["name"]}" in "{tx_name}" is overdue.',
                    notif_type="warning",
                    link=f'/transaction/{task["transaction_id"]}',
                    metadata={"task_id": task.get("id"), "transaction_id": task["transaction_id"]},
                )

        await db.transaction_tasks.update_one(
            {"id": task["id"]}, {"$set": {"reminder_sent_overdue": True}}
        )

    if overdue:
        logger.info(f"Reminders: notified {len(overdue)} overdue tasks")


async def _check_upcoming_bookings():
    """Notify users about bookings within the next 24 hours."""
    if db is None:
        return
    now = datetime.now(timezone.utc)
    window = now + timedelta(hours=24)

    upcoming = await db.bookings.find({
        "status": {"$in": ["confirmed", "pending"]},
        "start_time": {"$gte": now, "$lte": window},
        "reminder_sent_24h": {"$ne": True},
    }, {"_id": 0}).to_list(50)

    for booking in upcoming:
        for uid in [booking.get("user_id"), booking.get("notary_id")]:
            if uid and notification_service:
                await notification_service.create_notification(
                    user_id=uid,
                    title="Upcoming Booking",
                    message=f'You have a booking starting at {booking.get("start_time", "")}.',
                    notif_type="info",
                    link="/my-bookings",
                    metadata={"booking_id": booking.get("id")},
                )

        await db.bookings.update_one(
            {"id": booking["id"]}, {"$set": {"reminder_sent_24h": True}}
        )

    if upcoming:
        logger.info(f"Reminders: notified {len(upcoming)} upcoming bookings")


async def _check_pending_approvals():
    """Notify users who have pending approval requests."""
    if db is None:
        return
    now = datetime.now(timezone.utc)
    stale_cutoff = now - timedelta(hours=12)

    pending = await db.approval_requests.find({
        "status": "pending",
        "created_at": {"$lt": stale_cutoff.isoformat()},
        "reminder_sent": {"$ne": True},
    }, {"_id": 0}).to_list(50)

    for req in pending:
        approver_id = req.get("approver_id")
        if approver_id and notification_service:
            await notification_service.create_notification(
                user_id=approver_id,
                title="Pending Approval",
                message=f'You have a pending approval for "{req.get("document_name", "a document")}".',
                notif_type="action",
                link="/approvals",
                metadata={"approval_id": req.get("id")},
            )
            await db.approval_requests.update_one(
                {"id": req["id"]}, {"$set": {"reminder_sent": True}}
            )

    if pending:
        logger.info(f"Reminders: notified {len(pending)} pending approvals")


async def run_reminder_checks():
    """Main loop: runs all reminder checks periodically."""
    logger.info("Smart reminder checker started")
    while True:
        try:
            await _check_overdue_tasks()
            await _check_upcoming_bookings()
            await _check_pending_approvals()
        except Exception as e:
            logger.error(f"Reminder check error: {e}")
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
