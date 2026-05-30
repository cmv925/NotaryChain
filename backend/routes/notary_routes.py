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
from services.notification_service import create_notification, broadcast_event, get_notary_user_ids
from services.webhook_service import trigger_event as trigger_webhook
from services.storage_service import storage_service
from datetime import datetime, timezone
import logging
import uuid
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notary", tags=["notary"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


async def _provision_hcs_topic(request_id: str, user_id: str, document_type: str):
    """Background task: create the HCS topic + submit the creation event, then
    update the notarization request. Runs after the API response is returned so
    slow/cold Hedera calls never block (or 502) the request-creation path."""
    try:
        topic_memo = f"Notarization: {document_type}"
        hcs_topic_result = await hedera_service.create_topic(memo=topic_memo)
        if hcs_topic_result.get("success"):
            hcs_topic_id = hcs_topic_result["topic_id"]
            logger.info(f"Created HCS topic {hcs_topic_id} for notarization {request_id}")
            await hedera_service.submit_message(hcs_topic_id, {
                "type": "REQUEST_CREATED",
                "request_id": request_id,
                "user_id": user_id,
                "document_type": document_type,
            })
            await db.notarization_requests.update_one(
                {"id": request_id},
                {"$set": {
                    "hcs_topic_id": hcs_topic_id,
                    "hcs_topic_explorer": hcs_topic_result.get("explorer_url"),
                    "hcs_status": "provisioned",
                }},
            )
        else:
            await db.notarization_requests.update_one(
                {"id": request_id},
                {"$set": {"hcs_status": "failed"}},
            )
    except Exception as e:
        logger.error(f"Failed to provision HCS topic for notarization {request_id}: {e}")
        await db.notarization_requests.update_one(
            {"id": request_id},
            {"$set": {"hcs_status": "failed"}},
        )

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
    
    # Read file and store via S3/storage service
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 5MB."
        )
    
    # Upload to storage
    storage_meta = await storage_service.upload(content, file.filename, folder="credentials")

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
        "stored_path": storage_meta["path"],
        "storage_backend": storage_meta["storage_backend"],
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
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    # Identity gate: clients must complete identity verification before requesting notarization.
    user_doc = await db.users.find_one(
        {"id": current_user.id},
        {"role": 1, "identity_verified": 1},
    )
    role = (user_doc or {}).get("role", "user")
    if role == "user" and not (user_doc or {}).get("identity_verified"):
        raise HTTPException(
            status_code=403,
            detail="identity_verification_required",
        )

    # Normalize + validate state_code against the multi-state evaluator
    from services.multistate_evaluator import supported_state_codes
    state_code = (request_data.state_code or "").strip().upper() or None
    if state_code and state_code not in supported_state_codes():
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported state_code '{state_code}'. Supported: {supported_state_codes()}",
        )
    payload = request_data.dict()
    payload["state_code"] = state_code
    request = NotarizationRequest(
        user_id=current_user.id,
        **payload,
    )
    
    # HCS topic is provisioned asynchronously (see _provision_hcs_topic) so the
    # cold-path Hedera latency never blocks request creation. Stored as null until ready.
    request_dict = request.dict()
    request_dict["hcs_topic_id"] = None
    request_dict["hcs_topic_explorer"] = None
    request_dict["hcs_status"] = "provisioning"

    await db.notarization_requests.insert_one(request_dict)

    # Kick off the Hedera topic provisioning in the background.
    background_tasks.add_task(
        _provision_hcs_topic, request.id, current_user.id, request_data.document_type
    )

    # Broadcast to notaries that a new request is available
    try:
        notary_ids = await get_notary_user_ids()
        await broadcast_event("notary_queue_update", {
            "action": "new_request",
            "request_id": request.id,
            "document_type": request_data.document_type,
        }, target_user_ids=notary_ids)
    except Exception as e:
        logger.debug(f"Broadcast failed: {e}")

    # Return augmented response (hcs_topic_id resolves shortly via background task)
    return NotarizationRequest(**request.dict())


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

    # Broadcast request assigned to user and all notaries
    try:
        notary_ids = await get_notary_user_ids()
        await broadcast_event("request_assigned", {
            "request_id": request_id,
            "notary_id": current_user.id,
        }, target_user_ids=[request.get("user_id")] + notary_ids)
    except Exception as e:
        logger.debug(f"Broadcast failed: {e}")
    
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

    # ─── Multi-state pre-seal gate evaluator ──────────────────────
    # Auto-route to the right state evaluator. FL keeps its existing pipeline.
    # For TX/NY/CA/VA, block completion if any gate fails.
    state_code = (request.get("state_code") or "").upper()
    if state_code and state_code != "FL":
        try:
            from services.multistate_evaluator import evaluate_preseal, supported_state_codes
            if state_code in supported_state_codes():
                ev = await evaluate_preseal(
                    state_code=state_code,
                    ceremony_id=request_id,
                    user_id=request.get("user_id", current_user.id),
                    db=db,
                    document_type=request.get("document_type", "general"),
                )
                if not ev.get("ready"):
                    await db.notarization_requests.update_one(
                        {"id": request_id},
                        {"$set": {
                            "status": f"{state_code.lower()}_blocked",
                            "blocked_reasons": ev.get("blocked_reasons", []),
                            "blocked_evaluator": ev.get("schema_version"),
                            "blocked_at": datetime.now(timezone.utc).isoformat(),
                        }}
                    )
                    raise HTTPException(
                        status_code=status.HTTP_412_PRECONDITION_FAILED,
                        detail={
                            "error": "preseal_gate_failed",
                            "state_code": state_code,
                            "blocked_reasons": ev.get("blocked_reasons", []),
                            "gates": ev.get("gates", {}),
                        },
                    )
        except HTTPException:
            raise
        except Exception as e:
            # Fail CLOSED: if the evaluator itself errors out (DB outage, bug,
            # missing collection, etc.) we must NOT silently seal a non-FL
            # ceremony — that would defeat the entire pre-seal gate guarantee.
            logger.error(f"multistate evaluator error for ceremony {request_id}: {e}")
            await db.notarization_requests.update_one(
                {"id": request_id},
                {"$set": {
                    "status": f"{state_code.lower()}_evaluator_error",
                    "blocked_evaluator_error": str(e),
                    "blocked_at": datetime.now(timezone.utc).isoformat(),
                }}
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "error": "preseal_evaluator_unavailable",
                    "state_code": state_code,
                    "message": "Compliance evaluator failed — ceremony cannot be sealed until the evaluator is healthy. Please retry.",
                },
            )

    # Update request
    result = await db.notarization_requests.update_one(
        {"id": request_id, "notary_id": current_user.id},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc)
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
                "completed_at": datetime.now(timezone.utc).isoformat()
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
    
    # Send completion email to user with full session package
    user = await db.users.find_one({"id": request.get("user_id")}, {"_id": 0, "email": 1, "full_name": 1})
    if user:
        seal_hash = package_result.get("blockchain_seal", {}).get("content_hash") if package_result else None

        # Compile full package data for the email
        email_package_data = None
        if package_result and package_result.get("success"):
            try:
                package_service = NotarizationPackageService(db, hedera_service)
                full_package = await package_service.get_package(package_result.get("package_id"))
                if full_package:
                    pkg = full_package.get("package", {})
                    email_package_data = {
                        "package_id": package_result.get("package_id"),
                        "network": hedera_service.get_status().get("network", "mainnet"),
                        "blockchain_seal": full_package.get("blockchain_seal", {}),
                        "document_analysis": pkg.get("document_analysis", {}),
                        "biometric_verification": pkg.get("biometric_verification", {}),
                        "video_sessions": pkg.get("video_sessions", {}),
                        "participants": pkg.get("participants", {}),
                    }
            except Exception as e:
                logger.warning(f"Failed to compile email package data: {e}")

        background_tasks.add_task(
            email_service.send_notarization_complete_email,
            email=user.get("email"),
            full_name=user.get("full_name", "User"),
            request_id=request_id,
            document_type=request.get("document_type", "Document"),
            seal_hash=seal_hash,
            hcs_topic_id=request.get("hcs_topic_id"),
            package_data=email_package_data,
        )
        logger.info(f"Completion email with full package queued for {user.get('email')}")

    # In-app notification
    background_tasks.add_task(
        create_notification,
        user_id=request.get("user_id"),
        title="Notarization Complete",
        message=f"Your {request.get('document_type', 'document')} has been notarized and sealed on the blockchain.",
        notif_type="success",
        link=f"/certificate/{request_id}"
    )

    # Broadcast completion event to user and all notaries
    try:
        notary_ids = await get_notary_user_ids()
        await broadcast_event("request_completed", {
            "request_id": request_id,
            "document_type": request.get("document_type"),
        }, target_user_ids=[request.get("user_id")] + notary_ids)
    except Exception as e:
        logger.debug(f"Broadcast failed: {e}")

    # Trigger webhook for request owner
    try:
        import asyncio
        asyncio.create_task(trigger_webhook(request.get("user_id"), "request.completed", {
            "request_id": request_id,
            "document_type": request.get("document_type"),
            "status": "completed",
        }))
    except Exception as e:
        logger.debug(f"Webhook trigger failed: {e}")
    
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