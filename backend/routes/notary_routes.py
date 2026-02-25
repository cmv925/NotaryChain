from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File, Form, BackgroundTasks
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
from services.email_service import email_service
from routes.notification_routes import create_notification
from datetime import datetime, timezone
import logging
import uuid
import base64
import os

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
    background_tasks: BackgroundTasks,
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
    
    # Send application submitted email
    background_tasks.add_task(
        email_service.send_application_submitted_email,
        email=current_user.email,
        full_name=current_user.full_name or profile_data.full_name or current_user.email.split('@')[0]
    )
    logger.info(f"Application submitted email queued for {current_user.email}")
    
    return profile


@router.post("/profile/credentials")
async def upload_credentials(
    credential_type: str = Form(...),  # commission_certificate, government_id, e_signature, etc.
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload credential documents for notary verification"""
    # Check if profile exists
    profile = await db.notary_profiles.find_one({"user_id": current_user.id})
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notary profile not found. Create profile first."
        )
    
    valid_types = ["commission_certificate", "government_id", "e_signature", "background_check", "ron_certificate"]
    if credential_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid credential type. Must be one of: {', '.join(valid_types)}"
        )
    
    # Read file and store as base64 (in production, use cloud storage)
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 5MB."
        )
    
    # Store document metadata
    doc_id = str(uuid.uuid4())
    credential_doc = {
        "id": doc_id,
        "notary_profile_id": profile["id"],
        "user_id": current_user.id,
        "credential_type": credential_type,
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(content),
        "data": base64.b64encode(content).decode('utf-8'),
        "uploaded_at": datetime.now(timezone.utc)
    }
    
    await db.notary_credentials.insert_one(credential_doc)
    
    # Update profile credentials field - ensure credentials object exists first
    credential_url_field = f"{credential_type}_url"
    
    # First ensure the credentials object exists
    if not profile.get("credentials"):
        await db.notary_profiles.update_one(
            {"id": profile["id"]},
            {"$set": {"credentials": {}}}
        )
    
    # Now update the specific credential URL
    await db.notary_profiles.update_one(
        {"id": profile["id"]},
        {"$set": {
            f"credentials.{credential_url_field}": f"/api/notary/credentials/{doc_id}",
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {
        "success": True,
        "credential_id": doc_id,
        "credential_type": credential_type,
        "filename": file.filename
    }


@router.get("/profile/credentials")
async def get_my_credentials(current_user: User = Depends(get_current_user)):
    """Get list of uploaded credentials for current user's notary profile"""
    profile = await db.notary_profiles.find_one({"user_id": current_user.id})
    if not profile:
        raise HTTPException(status_code=404, detail="Notary profile not found")
    
    credentials = await db.notary_credentials.find(
        {"user_id": current_user.id},
        {"_id": 0, "data": 0}  # Exclude binary data from list
    ).to_list(20)
    
    # Format dates
    for cred in credentials:
        if isinstance(cred.get("uploaded_at"), datetime):
            cred["uploaded_at"] = cred["uploaded_at"].isoformat()
    
    return {
        "profile_id": profile["id"],
        "status": profile.get("status", "pending"),
        "credentials": credentials
    }


@router.get("/profile/status")
async def get_application_status(current_user: User = Depends(get_current_user)):
    """Get detailed status of notary application"""
    profile = await db.notary_profiles.find_one(
        {"user_id": current_user.id},
        {"_id": 0}
    )
    
    if not profile:
        return {
            "has_profile": False,
            "status": None,
            "message": "No notary application found. Apply to become a notary."
        }
    
    # Get credential upload status - use inclusion projection only
    credentials = await db.notary_credentials.find(
        {"user_id": current_user.id},
        {"credential_type": 1}
    ).to_list(10)
    
    credential_types = [c["credential_type"] for c in credentials]
    required_docs = ["commission_certificate", "government_id"]
    missing_docs = [doc for doc in required_docs if doc not in credential_types]
    
    # Format dates
    for field in ["created_at", "updated_at", "reviewed_at", "approved_at"]:
        if field in profile and isinstance(profile[field], datetime):
            profile[field] = profile[field].isoformat()
    
    return {
        "has_profile": True,
        "status": profile.get("status", "pending"),
        "profile": profile,
        "credentials_uploaded": credential_types,
        "missing_required_docs": missing_docs,
        "review_notes": profile.get("review_notes"),
        "rejection_reason": profile.get("rejection_reason"),
        "message": _get_status_message(profile.get("status"), missing_docs)
    }


def _get_status_message(status: str, missing_docs: list) -> str:
    """Generate user-friendly status message"""
    if status == "pending":
        if missing_docs:
            return f"Please upload required documents: {', '.join(missing_docs)}"
        return "Your application is pending review. We'll notify you once reviewed."
    elif status == "under_review":
        return "Your application is currently being reviewed by our team."
    elif status == "approved":
        return "Congratulations! Your notary application has been approved."
    elif status == "rejected":
        return "Your application was not approved. Please see rejection reason for details."
    elif status == "suspended":
        return "Your notary privileges have been suspended. Contact support for details."
    return "Unknown status"

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
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    # Check if user is a notary
    notary = await db.notary_profiles.find_one({"user_id": current_user.id})
    if not notary:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a certified notary"
        )
    
    # Get the request first to access HCS topic
    request = await db.notarization_requests.find_one({"id": request_id, "status": "pending"})
    if not request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request not available"
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
    
    # Log to HCS topic if available
    if request.get("hcs_topic_id"):
        try:
            await hedera_service.submit_message(request["hcs_topic_id"], {
                "type": "NOTARY_ASSIGNED",
                "request_id": request_id,
                "notary_id": current_user.id
            })
        except Exception as e:
            logger.error(f"Failed to log assign to HCS: {e}")
    
    # Send email notification to user
    user = await db.users.find_one({"id": request.get("user_id")}, {"_id": 0, "email": 1, "full_name": 1})
    if user:
        notary_name = current_user.full_name or notary.get("full_name", "Certified Notary")
        background_tasks.add_task(
            email_service.send_request_assigned_email,
            email=user.get("email"),
            full_name=user.get("full_name", "User"),
            request_id=request_id,
            notary_name=notary_name,
            document_type=request.get("document_type", "Document")
        )
        logger.info(f"Assignment email queued for {user.get('email')}")

    # In-app notification
    background_tasks.add_task(
        create_notification,
        user_id=request.get("user_id"),
        title="Notary Assigned",
        message=f"A certified notary has been assigned to your {request.get('document_type', 'document')} request.",
        notif_type="info",
        link=f"/session/{request_id}"
    )
    
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
    
    # Log to HCS topic if available
    if request.get("hcs_topic_id"):
        try:
            await hedera_service.submit_message(request["hcs_topic_id"], {
                "type": "SESSION_STARTED",
                "request_id": request_id,
                "session_id": session.id,
                "notary_id": current_user.id
            })
        except Exception as e:
            logger.error(f"Failed to log session start to HCS: {e}")
    
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
    background_tasks: BackgroundTasks,
    notes: str = "",
    seal_package: bool = True,
    current_user: User = Depends(get_current_user)
):
    """
    Complete a notarization request.
    Optionally seals all verification data (AI analysis, biometrics, video) 
    into an immutable package on Hedera blockchain.
    """
    # Import package service
    from services.notarization_package import NotarizationPackageService
    
    # Get request first for HCS topic
    request = await db.notarization_requests.find_one({
        "id": request_id,
        "notary_id": current_user.id
    })
    
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found"
        )
    
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
    
    # Log to HCS topic if available
    if request.get("hcs_topic_id"):
        try:
            await hedera_service.submit_message(request["hcs_topic_id"], {
                "type": "NOTARIZATION_COMPLETED",
                "request_id": request_id,
                "notary_id": current_user.id,
                "notes": notes,
                "completed_at": datetime.utcnow().isoformat()
            })
        except Exception as e:
            logger.error(f"Failed to log completion to HCS: {e}")
    
    # Seal the notarization package on blockchain
    package_result = None
    if seal_package:
        try:
            package_service = NotarizationPackageService(db, hedera_service)
            package_result = await package_service.seal_package(
                request_id=request_id,
                notary_id=current_user.id
            )
            logger.info(f"Notarization package sealed: {package_result.get('package_id')}")
        except Exception as e:
            logger.error(f"Failed to seal notarization package: {e}")
            package_result = {"error": str(e)}
    
    # Send completion email to user
    user = await db.users.find_one({"id": request.get("user_id")}, {"_id": 0, "email": 1, "full_name": 1})
    if user:
        seal_hash = package_result.get("blockchain_seal", {}).get("content_hash") if package_result else None
        background_tasks.add_task(
            email_service.send_notarization_complete_email,
            email=user.get("email"),
            full_name=user.get("full_name", "User"),
            request_id=request_id,
            document_type=request.get("document_type", "Document"),
            seal_hash=seal_hash,
            hcs_topic_id=request.get("hcs_topic_id")
        )
        logger.info(f"Completion email queued for {user.get('email')}")

    # In-app notification
    background_tasks.add_task(
        create_notification,
        user_id=request.get("user_id"),
        title="Notarization Complete",
        message=f"Your {request.get('document_type', 'document')} has been notarized and sealed on the blockchain.",
        notif_type="success",
        link=f"/certificate/{request_id}"
    )
    
    return {
        "success": True, 
        "message": "Notarization completed",
        "package": package_result
    }

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