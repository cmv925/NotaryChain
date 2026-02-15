"""
Video Conferencing API Routes for RON Sessions
"""

from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

from models import User
from routes.auth_routes import get_current_user
from services.daily_service import daily_service

router = APIRouter(prefix="/api/video", tags=["video-conferencing"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


class CreateRoomRequest(BaseModel):
    notary_request_id: str
    expires_minutes: int = 60


class JoinRoomRequest(BaseModel):
    room_id: str


@router.get("/status")
async def video_status():
    """Check video conferencing service status"""
    return daily_service.get_status()


@router.post("/rooms")
async def create_video_room(
    request: CreateRoomRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Create a video room for a notarization session.
    Called when starting a RON session.
    """
    # Verify notary request exists (check both possible collection names)
    notary_request = await db.notarization_requests.find_one({
        "id": request.notary_request_id
    })
    
    if not notary_request:
        # Also try notary_requests collection
        notary_request = await db.notary_requests.find_one({
            "id": request.notary_request_id
        })
    
    if not notary_request:
        raise HTTPException(status_code=404, detail="Notary request not found")
    
    # Create video room
    session_id = f"{request.notary_request_id}-{uuid.uuid4().hex[:8]}"
    room_result = await daily_service.create_room(
        session_id=session_id,
        expires_minutes=request.expires_minutes,
        enable_recording=True,
        enable_screenshare=True
    )
    
    if not room_result.get("success"):
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to create video room: {room_result.get('error')}"
        )
    
    # Create meeting token for the user (owner if they're the notary)
    is_notary = notary_request.get("notary_id") == current_user.id
    token_result = await daily_service.create_meeting_token(
        room_name=room_result["room_name"],
        user_name=current_user.full_name,
        user_id=current_user.id,
        is_owner=is_notary,
        expires_minutes=request.expires_minutes
    )
    
    # Store video session in database
    video_session = {
        "id": str(uuid.uuid4()),
        "notary_request_id": request.notary_request_id,
        "room_name": room_result["room_name"],
        "room_url": room_result["room_url"],
        "created_by": current_user.id,
        "expires_at": room_result["expires_at"],
        "recording_enabled": room_result.get("recording_enabled", True),
        "status": "active",
        "created_at": datetime.now(timezone.utc),
        "participants": [{
            "user_id": current_user.id,
            "user_name": current_user.full_name,
            "role": "notary" if is_notary else "signer",
            "joined_at": datetime.now(timezone.utc)
        }]
    }
    
    await db.video_sessions.insert_one(video_session)
    
    # Update notary request with video session
    await db.notarization_requests.update_one(
        {"id": request.notary_request_id},
        {
            "$set": {
                "video_session_id": video_session["id"],
                "video_room_url": room_result["room_url"],
                "status": "in_session",
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {
        "success": True,
        "video_session_id": video_session["id"],
        "room_name": room_result["room_name"],
        "room_url": room_result["room_url"],
        "token": token_result.get("token"),
        "expires_at": room_result["expires_at"],
        "is_mock": room_result.get("mock", False)
    }


@router.post("/rooms/{room_id}/join")
async def join_video_room(
    room_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get a meeting token to join an existing video room.
    """
    # Find video session
    video_session = await db.video_sessions.find_one({"id": room_id})
    
    if not video_session:
        raise HTTPException(status_code=404, detail="Video session not found")
    
    if video_session.get("status") != "active":
        raise HTTPException(status_code=400, detail="Video session is not active")
    
    # Check if user is authorized (owner, notary, or signer)
    notary_request = await db.notarization_requests.find_one({
        "id": video_session["notary_request_id"]
    })
    
    is_authorized = (
        current_user.id == video_session["created_by"] or
        current_user.id == notary_request.get("user_id") or
        current_user.id == notary_request.get("notary_id")
    )
    
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Not authorized to join this session")
    
    # Create meeting token
    is_notary = notary_request.get("notary_id") == current_user.id
    token_result = await daily_service.create_meeting_token(
        room_name=video_session["room_name"],
        user_name=current_user.full_name,
        user_id=current_user.id,
        is_owner=is_notary
    )
    
    # Add participant to session
    await db.video_sessions.update_one(
        {"id": room_id},
        {
            "$push": {
                "participants": {
                    "user_id": current_user.id,
                    "user_name": current_user.full_name,
                    "role": "notary" if is_notary else "signer",
                    "joined_at": datetime.now(timezone.utc)
                }
            }
        }
    )
    
    return {
        "success": True,
        "room_url": video_session["room_url"],
        "token": token_result.get("token"),
        "is_mock": token_result.get("mock", False)
    }


@router.post("/rooms/{room_id}/end")
async def end_video_room(
    room_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    End a video session and clean up resources.
    """
    video_session = await db.video_sessions.find_one({"id": room_id})
    
    if not video_session:
        raise HTTPException(status_code=404, detail="Video session not found")
    
    # Only creator or notary can end session
    notary_request = await db.notarization_requests.find_one({
        "id": video_session["notary_request_id"]
    })
    
    is_authorized = (
        current_user.id == video_session["created_by"] or
        current_user.id == notary_request.get("notary_id")
    )
    
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Only notary or session creator can end session")
    
    # Delete room from Daily.co
    await daily_service.delete_room(video_session["room_name"])
    
    # Update session status
    await db.video_sessions.update_one(
        {"id": room_id},
        {
            "$set": {
                "status": "ended",
                "ended_at": datetime.now(timezone.utc),
                "ended_by": current_user.id
            }
        }
    )
    
    # Update notary request
    await db.notarization_requests.update_one(
        {"id": video_session["notary_request_id"]},
        {
            "$set": {
                "status": "session_completed",
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {
        "success": True,
        "message": "Video session ended"
    }


@router.get("/rooms/{room_id}")
async def get_video_room(
    room_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get video session details"""
    video_session = await db.video_sessions.find_one(
        {"id": room_id},
        {"_id": 0}
    )
    
    if not video_session:
        raise HTTPException(status_code=404, detail="Video session not found")
    
    return video_session


@router.get("/sessions/my")
async def get_my_video_sessions(
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """Get user's video sessions"""
    sessions = await db.video_sessions.find(
        {
            "$or": [
                {"created_by": current_user.id},
                {"participants.user_id": current_user.id}
            ]
        },
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {
        "count": len(sessions),
        "sessions": sessions
    }
