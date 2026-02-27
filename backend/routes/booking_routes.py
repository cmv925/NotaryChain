"""
Notary Booking Calendar Routes
Availability management, slot generation, and booking CRUD.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta, time
import uuid
import logging

from models import User
from models_notary import NotarizationRequest
from routes.auth_routes import get_current_user
from services.hedera_service import hedera_service
from services.notification_service import create_notification, broadcast_event
from services.email_service import email_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/bookings", tags=["bookings"])

db: AsyncIOMotorDatabase = None


def set_db(database):
    global db
    db = database


# === Models ===

class AvailabilitySlot(BaseModel):
    day_of_week: int  # 0=Monday, 6=Sunday
    start_time: str   # "09:00"
    end_time: str      # "17:00"


class SetAvailabilityRequest(BaseModel):
    weekly_slots: List[AvailabilitySlot]
    slot_duration_minutes: int = 60
    break_between_minutes: int = 15
    timezone_str: str = "America/New_York"


class BlockDateRequest(BaseModel):
    date: str  # "2026-03-15"
    reason: str = ""


class CreateBookingRequest(BaseModel):
    notary_id: str
    date: str          # "2026-03-15"
    start_time: str    # "10:00"
    end_time: str      # "11:00"
    document_name: str
    document_type: str
    notarization_type: str = "ron"
    notes: str = ""


# === Notary Availability Management ===

@router.put("/availability")
async def set_availability(
    body: SetAvailabilityRequest,
    current_user: User = Depends(get_current_user),
):
    """Set or update notary's weekly availability schedule."""
    # Verify user is an approved notary
    profile = await db.notary_profiles.find_one(
        {"user_id": current_user.id, "status": "approved"}
    )
    if not profile:
        raise HTTPException(status_code=403, detail="Only approved notaries can set availability")

    schedule = {
        "notary_id": current_user.id,
        "weekly_slots": [s.dict() for s in body.weekly_slots],
        "slot_duration_minutes": body.slot_duration_minutes,
        "break_between_minutes": body.break_between_minutes,
        "timezone_str": body.timezone_str,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.notary_availability.update_one(
        {"notary_id": current_user.id},
        {"$set": schedule, "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"message": "Availability updated", "schedule": schedule}


@router.get("/availability")
async def get_my_availability(
    current_user: User = Depends(get_current_user),
):
    """Get notary's own availability schedule."""
    schedule = await db.notary_availability.find_one(
        {"notary_id": current_user.id}, {"_id": 0}
    )
    blocked = await db.notary_blocked_dates.find(
        {"notary_id": current_user.id}, {"_id": 0}
    ).to_list(100)

    return {
        "schedule": schedule,
        "blocked_dates": blocked,
    }


@router.get("/availability/{notary_id}")
async def get_notary_availability(notary_id: str):
    """Public: Get a notary's availability schedule."""
    schedule = await db.notary_availability.find_one(
        {"notary_id": notary_id}, {"_id": 0}
    )
    if not schedule:
        return {"schedule": None, "blocked_dates": []}

    blocked = await db.notary_blocked_dates.find(
        {"notary_id": notary_id}, {"_id": 0, "date": 1}
    ).to_list(100)

    return {
        "schedule": schedule,
        "blocked_dates": [b["date"] for b in blocked],
    }


# === Blocked Dates ===

@router.post("/blocked-dates")
async def block_date(
    body: BlockDateRequest,
    current_user: User = Depends(get_current_user),
):
    """Block a specific date from bookings."""
    block = {
        "id": str(uuid.uuid4()),
        "notary_id": current_user.id,
        "date": body.date,
        "reason": body.reason,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notary_blocked_dates.insert_one(block)
    block.pop("_id", None)
    return block


@router.delete("/blocked-dates/{block_id}")
async def unblock_date(
    block_id: str,
    current_user: User = Depends(get_current_user),
):
    """Remove a blocked date."""
    result = await db.notary_blocked_dates.delete_one(
        {"id": block_id, "notary_id": current_user.id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Blocked date not found")
    return {"message": "Date unblocked"}


# === Slot Generation ===

@router.get("/slots/{notary_id}")
async def get_available_slots(
    notary_id: str,
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
):
    """Get available booking slots for a notary on a specific date."""
    schedule = await db.notary_availability.find_one(
        {"notary_id": notary_id}, {"_id": 0}
    )
    if not schedule:
        return {"slots": [], "message": "Notary has not set availability"}

    # Parse the date
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # Check if date is blocked
    blocked = await db.notary_blocked_dates.find_one(
        {"notary_id": notary_id, "date": date}
    )
    if blocked:
        return {"slots": [], "message": "This date is blocked by the notary"}

    # Check if date is in the past
    today = datetime.now(timezone.utc).date()
    if target_date < today:
        return {"slots": [], "message": "Cannot book in the past"}

    # Find matching day_of_week slots
    day_of_week = target_date.weekday()  # 0=Monday
    day_slots = [s for s in schedule.get("weekly_slots", []) if s["day_of_week"] == day_of_week]

    if not day_slots:
        return {"slots": [], "message": "Notary not available on this day"}

    duration = schedule.get("slot_duration_minutes", 60)
    gap = schedule.get("break_between_minutes", 15)

    # Generate time slots
    available_slots = []
    for day_slot in day_slots:
        start_h, start_m = map(int, day_slot["start_time"].split(":"))
        end_h, end_m = map(int, day_slot["end_time"].split(":"))

        slot_start = datetime.combine(target_date, time(start_h, start_m))
        day_end = datetime.combine(target_date, time(end_h, end_m))

        while slot_start + timedelta(minutes=duration) <= day_end:
            slot_end = slot_start + timedelta(minutes=duration)
            available_slots.append({
                "start_time": slot_start.strftime("%H:%M"),
                "end_time": slot_end.strftime("%H:%M"),
            })
            slot_start = slot_end + timedelta(minutes=gap)

    # Remove already booked slots
    existing_bookings = await db.bookings.find({
        "notary_id": notary_id,
        "date": date,
        "status": {"$in": ["pending", "confirmed"]},
    }, {"_id": 0, "start_time": 1, "end_time": 1}).to_list(100)

    booked_times = set()
    for b in existing_bookings:
        booked_times.add(b["start_time"])

    available_slots = [s for s in available_slots if s["start_time"] not in booked_times]

    # If today, remove past slots
    if target_date == today:
        now_time = datetime.now(timezone.utc).strftime("%H:%M")
        available_slots = [s for s in available_slots if s["start_time"] > now_time]

    return {"date": date, "notary_id": notary_id, "slots": available_slots}


# === Booking CRUD ===

@router.post("")
async def create_booking(
    body: CreateBookingRequest,
    current_user: User = Depends(get_current_user),
):
    """Book a slot with a notary. Creates booking + notarization request."""
    # Verify notary exists and is approved
    notary_profile = await db.notary_profiles.find_one(
        {"user_id": body.notary_id, "status": "approved"}
    )
    if not notary_profile:
        raise HTTPException(status_code=404, detail="Notary not found")

    # Verify slot is still available
    existing = await db.bookings.find_one({
        "notary_id": body.notary_id,
        "date": body.date,
        "start_time": body.start_time,
        "status": {"$in": ["pending", "confirmed"]},
    })
    if existing:
        raise HTTPException(status_code=409, detail="This slot is already booked")

    # Create the notarization request
    notar_req = NotarizationRequest(
        user_id=current_user.id,
        document_name=body.document_name,
        document_type=body.document_type,
        notarization_type=body.notarization_type,
        notary_id=body.notary_id,
        status="assigned",
        notes=f"Booked session for {body.date} {body.start_time}-{body.end_time}. {body.notes}",
    )

    # Create HCS topic
    hcs_topic_id = None
    hcs_explorer = None
    try:
        result = await hedera_service.create_topic(
            memo=f"Booking: {body.document_type}"
        )
        if result.get("success"):
            hcs_topic_id = result["topic_id"]
            hcs_explorer = result.get("explorer_url")
    except Exception:
        pass

    req_dict = notar_req.dict()
    req_dict["hcs_topic_id"] = hcs_topic_id
    req_dict["hcs_topic_explorer"] = hcs_explorer
    await db.notarization_requests.insert_one(req_dict)
    req_dict.pop("_id", None)

    # Create the booking record
    booking = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "user_name": current_user.full_name or current_user.email.split("@")[0],
        "user_email": current_user.email,
        "notary_id": body.notary_id,
        "request_id": req_dict["id"],
        "date": body.date,
        "start_time": body.start_time,
        "end_time": body.end_time,
        "document_name": body.document_name,
        "document_type": body.document_type,
        "notarization_type": body.notarization_type,
        "notes": body.notes,
        "status": "pending",  # pending -> confirmed -> completed / cancelled
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.bookings.insert_one(booking)
    booking.pop("_id", None)

    # Notify the notary
    try:
        notary_user = await db.users.find_one({"id": body.notary_id}, {"_id": 0, "email": 1, "full_name": 1})
        await create_notification(
            user_id=body.notary_id,
            title="New Booking Request",
            message=f'{current_user.full_name or current_user.email} booked {body.date} {body.start_time} for "{body.document_name}"',
            notif_type="info",
            link="/notary/dashboard",
            metadata={"booking_id": booking["id"]},
        )
        if notary_user:
            await email_service.send_booking_notification_email(
                email=notary_user["email"],
                notary_name=notary_user.get("full_name", "Notary"),
                user_name=current_user.full_name or current_user.email,
                date=body.date,
                time_slot=f"{body.start_time} - {body.end_time}",
                document_name=body.document_name,
                is_new=True,
            )
    except Exception as e:
        logger.warning(f"Booking notification failed: {e}")

    return {"booking": booking, "request": req_dict}


@router.get("/my")
async def get_my_bookings(
    current_user: User = Depends(get_current_user),
    status: Optional[str] = None,
):
    """Get current user's bookings (as client)."""
    query = {"user_id": current_user.id}
    if status:
        query["status"] = status

    bookings = await db.bookings.find(query, {"_id": 0}).sort("date", -1).to_list(50)

    # Enrich with notary name
    for b in bookings:
        notary = await db.users.find_one({"id": b["notary_id"]}, {"_id": 0, "full_name": 1})
        b["notary_name"] = notary.get("full_name", "Unknown") if notary else "Unknown"

    return {"bookings": bookings}


@router.get("/notary")
async def get_notary_bookings(
    current_user: User = Depends(get_current_user),
    status: Optional[str] = None,
):
    """Get bookings assigned to the current notary."""
    query = {"notary_id": current_user.id}
    if status:
        query["status"] = status

    bookings = await db.bookings.find(query, {"_id": 0}).sort("date", -1).to_list(50)
    return {"bookings": bookings}


@router.put("/{booking_id}/confirm")
async def confirm_booking(
    booking_id: str,
    current_user: User = Depends(get_current_user),
):
    """Notary confirms a booking."""
    booking = await db.bookings.find_one(
        {"id": booking_id, "notary_id": current_user.id}
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["status"] != "pending":
        raise HTTPException(status_code=400, detail="Booking is not pending")

    now = datetime.now(timezone.utc).isoformat()
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": "confirmed", "updated_at": now}},
    )

    # Notify the user
    try:
        await create_notification(
            user_id=booking["user_id"],
            title="Booking Confirmed",
            message=f'Your booking on {booking["date"]} at {booking["start_time"]} has been confirmed.',
            notif_type="info",
            link="/my-bookings",
            metadata={"booking_id": booking_id},
        )
        user = await db.users.find_one({"id": booking["user_id"]}, {"_id": 0, "email": 1, "full_name": 1})
        if user:
            await email_service.send_booking_notification_email(
                email=user["email"],
                notary_name=current_user.full_name or "Notary",
                user_name=user.get("full_name", "User"),
                date=booking["date"],
                time_slot=f'{booking["start_time"]} - {booking["end_time"]}',
                document_name=booking.get("document_name", ""),
                is_new=False,
            )
    except Exception as e:
        logger.warning(f"Confirm notification failed: {e}")

    return {"message": "Booking confirmed"}


@router.put("/{booking_id}/cancel")
async def cancel_booking(
    booking_id: str,
    current_user: User = Depends(get_current_user),
):
    """Cancel a booking (either user or notary can cancel)."""
    booking = await db.bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["user_id"] != current_user.id and booking["notary_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if booking["status"] in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Booking cannot be cancelled")

    now = datetime.now(timezone.utc).isoformat()
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": "cancelled", "cancelled_by": current_user.id, "updated_at": now}},
    )

    # Also cancel the linked notarization request
    if booking.get("request_id"):
        await db.notarization_requests.update_one(
            {"id": booking["request_id"]},
            {"$set": {"status": "cancelled"}},
        )

    # Notify the other party
    other_id = booking["notary_id"] if current_user.id == booking["user_id"] else booking["user_id"]
    try:
        await create_notification(
            user_id=other_id,
            title="Booking Cancelled",
            message=f'Booking on {booking["date"]} at {booking["start_time"]} has been cancelled.',
            notif_type="warning",
            link="/my-bookings",
            metadata={"booking_id": booking_id},
        )
    except Exception:
        pass

    return {"message": "Booking cancelled"}


@router.put("/{booking_id}/complete")
async def complete_booking(
    booking_id: str,
    current_user: User = Depends(get_current_user),
):
    """Notary marks a booking as completed."""
    booking = await db.bookings.find_one(
        {"id": booking_id, "notary_id": current_user.id}
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["status"] != "confirmed":
        raise HTTPException(status_code=400, detail="Only confirmed bookings can be completed")

    now = datetime.now(timezone.utc).isoformat()
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": "completed", "updated_at": now}},
    )

    # Also update the linked notarization request
    if booking.get("request_id"):
        await db.notarization_requests.update_one(
            {"id": booking["request_id"]},
            {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc)}},
        )

    try:
        await create_notification(
            user_id=booking["user_id"],
            title="Session Completed",
            message=f'Your notarization session on {booking["date"]} has been completed.',
            notif_type="info",
            link="/my-bookings",
        )
    except Exception:
        pass

    return {"message": "Booking completed"}
