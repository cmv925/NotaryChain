from fastapi import APIRouter, HTTPException, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional
from models_notary import (
    NotaryProfile, NotaryProfileCreate,
    NotarizationRequest, NotarizationRequestCreate,
    NotarySession, NotaryAction, IdentityVerification
)
from models import User
from routes.auth_routes import get_current_user
from services.hedera_service import hedera_service
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notary", tags=["notary"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database

# Notary Profile Management
@router.post("/profile", response_model=NotaryProfile)
async def create_notary_profile(
    profile_data: NotaryProfileCreate,
    current_user: User = Depends(get_current_user)
):
    # Check if profile already exists
    existing = await db.notary_profiles.find_one({"user_id": current_user.id})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Notary profile already exists"
        )
    
    profile = NotaryProfile(
        user_id=current_user.id,
        **profile_data.dict()
    )
    
    await db.notary_profiles.insert_one(profile.dict())
    return profile

@router.get("/profile", response_model=NotaryProfile)
async def get_notary_profile(current_user: User = Depends(get_current_user)):
    profile = await db.notary_profiles.find_one({"user_id": current_user.id})
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notary profile not found"
        )
    return NotaryProfile(**profile)

@router.get("/profiles", response_model=List[NotaryProfile])
async def get_available_notaries(
    license_state: Optional[str] = None,
    ron_certified: Optional[bool] = None
):
    query = {"status": "approved"}
    if license_state:
        query["license_state"] = license_state
    if ron_certified is not None:
        query["ron_certified"] = ron_certified
    
    profiles = await db.notary_profiles.find(query).to_list(100)
    return [NotaryProfile(**p) for p in profiles]

# Notarization Request Management
@router.post("/requests", response_model=NotarizationRequest)
async def create_notarization_request(
    request_data: NotarizationRequestCreate,
    current_user: User = Depends(get_current_user)
):
    request = NotarizationRequest(
        user_id=current_user.id,
        **request_data.dict()
    )
    
    # Create HCS topic for this notarization session
    hcs_topic_id = None
    hcs_topic_result = None
    try:
        topic_memo = f"Notarization: {request_data.document_type}"
        hcs_topic_result = await hedera_service.create_topic(memo=topic_memo)
        if hcs_topic_result.get("success"):
            hcs_topic_id = hcs_topic_result["topic_id"]
            logger.info(f"Created HCS topic {hcs_topic_id} for notarization {request.id}")
            
            # Submit initial event to topic
            await hedera_service.submit_message(hcs_topic_id, {
                "type": "REQUEST_CREATED",
                "request_id": request.id,
                "user_id": current_user.id,
                "document_type": request_data.document_type
            })
    except Exception as e:
        logger.error(f"Failed to create HCS topic for notarization: {e}")
    
    # Add HCS topic to request
    request_dict = request.dict()
    request_dict["hcs_topic_id"] = hcs_topic_id
    request_dict["hcs_topic_explorer"] = hcs_topic_result.get("explorer_url") if hcs_topic_result else None
    
    await db.notarization_requests.insert_one(request_dict)
    
    # Return augmented response
    return NotarizationRequest(**{**request.dict(), "hcs_topic_id": hcs_topic_id})


@router.get("/requests/my", response_model=List[NotarizationRequest])
async def get_my_requests(
    current_user: User = Depends(get_current_user),
    status: Optional[str] = None
):
    query = {"user_id": current_user.id}
    if status:
        query["status"] = status
    
    requests = await db.notarization_requests.find(query).sort("created_at", -1).to_list(100)
    return [NotarizationRequest(**r) for r in requests]

# Note: More specific routes must come BEFORE the generic {request_id} route
@router.get("/requests/pending", response_model=List[NotarizationRequest])
async def get_pending_requests(current_user: User = Depends(get_current_user)):
    # Check if user is a notary
    notary = await db.notary_profiles.find_one({"user_id": current_user.id})
    if not notary:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a certified notary"
        )
    
    # Get unassigned requests
    requests = await db.notarization_requests.find({
        "status": "pending",
        "notary_id": None
    }).sort("created_at", -1).to_list(50)
    
    return [NotarizationRequest(**r) for r in requests]

@router.get("/requests/assigned", response_model=List[NotarizationRequest])
async def get_assigned_requests(current_user: User = Depends(get_current_user)):
    # Check if user is a notary
    notary = await db.notary_profiles.find_one({"user_id": current_user.id})
    if not notary:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a certified notary"
        )
    
    requests = await db.notarization_requests.find({
        "notary_id": current_user.id,
        "status": {"$in": ["assigned", "in_progress", "reviewing"]}
    }).sort("scheduled_time", 1).to_list(100)
    
    return [NotarizationRequest(**r) for r in requests]

@router.get("/requests/{request_id}", response_model=NotarizationRequest)
async def get_request_by_id(
    request_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a single notarization request by ID"""
    request = await db.notarization_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notarization request not found"
        )
    
    # Check authorization - user must be the requester or assigned notary
    if request.get("user_id") != current_user.id and request.get("notary_id") != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this request"
        )
    
    return NotarizationRequest(**request)

@router.post("/requests/{request_id}/assign")
async def assign_request(
    request_id: str,
    current_user: User = Depends(get_current_user)
):
    # Check if user is a notary
    notary = await db.notary_profiles.find_one({"user_id": current_user.id})
    if not notary:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a certified notary"
        )
    
    # Update request
    result = await db.notarization_requests.update_one(
        {"id": request_id, "status": "pending"},
        {"$set": {"notary_id": current_user.id, "status": "assigned"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request not available"
        )
    
    # Log action
    action = NotaryAction(
        request_id=request_id,
        notary_id=current_user.id,
        action_type="assign",
        notes="Notary assigned to request"
    )
    await db.notary_actions.insert_one(action.dict())
    
    return {"success": True, "message": "Request assigned successfully"}

@router.post("/requests/{request_id}/start-session")
async def start_session(
    request_id: str,
    current_user: User = Depends(get_current_user)
):
    # Get request
    request = await db.notarization_requests.find_one({
        "id": request_id,
        "notary_id": current_user.id
    })
    
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found"
        )
    
    # Create session
    session = NotarySession(
        request_id=request_id,
        notary_id=current_user.id,
        user_id=request["user_id"],
        session_type="video",
        status="active"
    )
    
    await db.notary_sessions.insert_one(session.dict())
    
    # Update request status
    await db.notarization_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "in_progress"}}
    )
    
    return {"success": True, "session_id": session.id}

@router.post("/sessions/{session_id}/verify")
async def verify_identity(
    session_id: str,
    verification_type: str,
    current_user: User = Depends(get_current_user)
):
    # Create verification record
    verification = IdentityVerification(
        session_id=session_id,
        user_id=current_user.id,
        verification_type=verification_type,
        status="passed",  # Mock verification
        confidence_score=0.95
    )
    
    await db.identity_verifications.insert_one(verification.dict())
    
    return {"success": True, "verification_id": verification.id}

@router.post("/requests/{request_id}/complete")
async def complete_notarization(
    request_id: str,
    notes: str = "",
    current_user: User = Depends(get_current_user)
):
    # Update request
    result = await db.notarization_requests.update_one(
        {"id": request_id, "notary_id": current_user.id},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.utcnow()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found"
        )
    
    # Log action
    action = NotaryAction(
        request_id=request_id,
        notary_id=current_user.id,
        action_type="approve",
        notes=notes
    )
    await db.notary_actions.insert_one(action.dict())
    
    return {"success": True, "message": "Notarization completed"}

@router.get("/stats")
async def get_notary_stats(current_user: User = Depends(get_current_user)):
    # Check if user is a notary
    notary = await db.notary_profiles.find_one({"user_id": current_user.id})
    if not notary:
        return {"is_notary": False}
    
    total_completed = await db.notarization_requests.count_documents({
        "notary_id": current_user.id,
        "status": "completed"
    })
    
    pending_count = await db.notarization_requests.count_documents({
        "notary_id": current_user.id,
        "status": {"$in": ["assigned", "in_progress", "reviewing"]}
    })
    
    return {
        "is_notary": True,
        "total_completed": total_completed,
        "pending_count": pending_count,
        "profile": NotaryProfile(**notary)
    }