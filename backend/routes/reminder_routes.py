"""
Smart Reminders & Calendar Routes
Calendar export (.ics), reminder preferences, manual trigger.
"""

from fastapi import APIRouter, HTTPException, Depends, Response
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import logging

from models import User
from routes.auth_routes import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reminders", tags=["reminders"])

db: AsyncIOMotorDatabase = None


def set_db(database):
    global db
    db = database


class ReminderPreferences(BaseModel):
    overdue_tasks: bool = True
    upcoming_bookings: bool = True
    pending_approvals: bool = True
    email_notifications: bool = False


@router.get("/preferences")
async def get_preferences(current_user: User = Depends(get_current_user)):
    """Get user's reminder preferences."""
    prefs = await db.reminder_preferences.find_one(
        {"user_id": current_user.id}, {"_id": 0}
    )
    return prefs or {
        "user_id": current_user.id,
        "overdue_tasks": True,
        "upcoming_bookings": True,
        "pending_approvals": True,
        "email_notifications": False,
    }


@router.put("/preferences")
async def update_preferences(
    body: ReminderPreferences,
    current_user: User = Depends(get_current_user),
):
    """Update user's reminder preferences."""
    data = body.dict()
    data["user_id"] = current_user.id
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.reminder_preferences.update_one(
        {"user_id": current_user.id},
        {"$set": data},
        upsert=True,
    )
    return {"success": True}


@router.get("/calendar/bookings.ics")
async def export_bookings_ics(current_user: User = Depends(get_current_user)):
    """Export user's bookings as .ics calendar file."""
    bookings = await db.bookings.find(
        {"$or": [{"user_id": current_user.id}, {"notary_id": current_user.id}]},
        {"_id": 0},
    ).sort("start_time", 1).to_list(100)

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//NotaryChain//Bookings//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ]

    for b in bookings:
        start = b.get("start_time", "")
        end = b.get("end_time", "")
        if isinstance(start, datetime):
            start = start.strftime("%Y%m%dT%H%M%SZ")
        elif isinstance(start, str):
            try:
                start = datetime.fromisoformat(start.replace("Z", "+00:00")).strftime("%Y%m%dT%H%M%SZ")
            except Exception:
                continue
        else:
            continue

        if isinstance(end, datetime):
            end = end.strftime("%Y%m%dT%H%M%SZ")
        elif isinstance(end, str):
            try:
                end = datetime.fromisoformat(end.replace("Z", "+00:00")).strftime("%Y%m%dT%H%M%SZ")
            except Exception:
                end = start

        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{b.get('id', '')}@notarychain",
            f"DTSTART:{start}",
            f"DTEND:{end}",
            f"SUMMARY:Notary Booking - {b.get('status', 'scheduled')}",
            f"STATUS:{b.get('status', 'CONFIRMED').upper()}",
            "END:VEVENT",
        ])

    lines.append("END:VCALENDAR")
    ics_content = "\r\n".join(lines)

    return Response(
        content=ics_content,
        media_type="text/calendar",
        headers={"Content-Disposition": "attachment; filename=bookings.ics"},
    )


@router.get("/calendar/tasks.ics")
async def export_tasks_ics(current_user: User = Depends(get_current_user)):
    """Export user's transaction tasks as .ics calendar file."""
    # Find user's transactions
    participations = await db.transaction_participants.find(
        {"user_id": current_user.id}, {"_id": 0, "transaction_id": 1}
    ).to_list(50)
    tx_ids = [p["transaction_id"] for p in participations]

    tasks = await db.transaction_tasks.find(
        {"transaction_id": {"$in": tx_ids}, "due_date": {"$ne": None}},
        {"_id": 0},
    ).to_list(200)

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//NotaryChain//Tasks//EN",
        "CALSCALE:GREGORIAN",
    ]

    for t in tasks:
        due = t.get("due_date", "")
        if isinstance(due, datetime):
            due_str = due.strftime("%Y%m%dT%H%M%SZ")
        elif isinstance(due, str):
            try:
                due_str = datetime.fromisoformat(due.replace("Z", "+00:00")).strftime("%Y%m%dT%H%M%SZ")
            except Exception:
                continue
        else:
            continue

        lines.extend([
            "BEGIN:VTODO",
            f"UID:{t.get('id', '')}@notarychain",
            f"DUE:{due_str}",
            f"SUMMARY:{t.get('name', 'Task')}",
            f"DESCRIPTION:{t.get('description', '')[:200]}",
            f"STATUS:{'COMPLETED' if t.get('status') == 'completed' else 'NEEDS-ACTION'}",
            "END:VTODO",
        ])

    lines.append("END:VCALENDAR")
    return Response(
        content="\r\n".join(lines),
        media_type="text/calendar",
        headers={"Content-Disposition": "attachment; filename=tasks.ics"},
    )
