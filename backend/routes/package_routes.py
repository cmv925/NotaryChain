"""
Notarization Package API Routes
Endpoints for creating, sealing, and verifying notarization packages on blockchain
"""

from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
from datetime import datetime, timezone

from models import User
from routes.auth_routes import get_current_user
from services.notarization_package import NotarizationPackageService
from services.hedera_service import hedera_service

router = APIRouter(prefix="/api/packages", tags=["notarization-packages"])

db: AsyncIOMotorDatabase = None
package_service: NotarizationPackageService = None

def set_db(database):
    global db, package_service
    db = database
    package_service = NotarizationPackageService(db, hedera_service)


@router.post("/compile/{request_id}")
async def compile_package(
    request_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Compile all verification data for a notarization request into a package.
    Does not seal on blockchain - use /seal endpoint for that.
    """
    try:
        # Verify user has access to this request
        request = await db.notarization_requests.find_one({"id": request_id})
        if not request:
            raise HTTPException(status_code=404, detail="Notarization request not found")
        
        # Check authorization (user must be requester, assigned notary, or admin)
        user_doc = await db.users.find_one({"id": current_user.id})
        is_admin = user_doc and user_doc.get("role") == "admin"
        is_requester = request.get("user_id") == current_user.id
        is_notary = request.get("notary_id") == current_user.id
        
        if not (is_admin or is_requester or is_notary):
            raise HTTPException(status_code=403, detail="Not authorized to access this request")
        
        package = await package_service.compile_package(request_id)
        
        return {
            "success": True,
            "package": package
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compile package: {str(e)}")


@router.post("/seal/{request_id}")
async def seal_package(
    request_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Compile and seal a notarization package on Hedera blockchain.
    This creates an immutable record of all verification data.
    
    Only the assigned notary or admin can seal a package.
    """
    try:
        # Verify request exists
        request = await db.notarization_requests.find_one({"id": request_id})
        if not request:
            raise HTTPException(status_code=404, detail="Notarization request not found")
        
        # Check authorization (must be assigned notary or admin)
        user_doc = await db.users.find_one({"id": current_user.id})
        is_admin = user_doc and user_doc.get("role") == "admin"
        is_notary = request.get("notary_id") == current_user.id
        
        if not (is_admin or is_notary):
            raise HTTPException(
                status_code=403, 
                detail="Only the assigned notary or admin can seal a package"
            )
        
        # Check if already sealed
        existing = await db.notarization_packages.find_one({"request_id": request_id})
        if existing:
            return {
                "success": True,
                "already_sealed": True,
                "package_id": existing.get("id"),
                "message": "Package was already sealed"
            }
        
        # Seal the package
        result = await package_service.seal_package(
            request_id=request_id,
            notary_id=current_user.id
        )
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to seal package: {str(e)}")


@router.get("/{package_id}")
async def get_package(
    package_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve a sealed notarization package by ID.
    """
    package = await package_service.get_package(package_id)
    
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    
    # Check authorization
    request_id = package.get("request_id")
    request = await db.notarization_requests.find_one({"id": request_id})
    
    if request:
        user_doc = await db.users.find_one({"id": current_user.id})
        is_admin = user_doc and user_doc.get("role") == "admin"
        is_requester = request.get("user_id") == current_user.id
        is_notary = request.get("notary_id") == current_user.id
        
        if not (is_admin or is_requester or is_notary):
            raise HTTPException(status_code=403, detail="Not authorized to access this package")
    
    return {
        "success": True,
        "package": package
    }


@router.get("/{package_id}/verify")
async def verify_package(
    package_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Verify the integrity of a sealed notarization package.
    Recalculates all hashes and compares with blockchain record.
    """
    result = await package_service.verify_package(package_id)
    
    if not result.get("verified") and result.get("error") == "Package not found":
        raise HTTPException(status_code=404, detail="Package not found")
    
    return result


@router.get("/request/{request_id}")
async def get_package_by_request(
    request_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get the sealed package for a notarization request.
    """
    # Verify authorization
    request = await db.notarization_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Notarization request not found")
    
    user_doc = await db.users.find_one({"id": current_user.id})
    is_admin = user_doc and user_doc.get("role") == "admin"
    is_requester = request.get("user_id") == current_user.id
    is_notary = request.get("notary_id") == current_user.id
    
    if not (is_admin or is_requester or is_notary):
        raise HTTPException(status_code=403, detail="Not authorized to access this request")
    
    # Find package for this request
    package = await db.notarization_packages.find_one(
        {"request_id": request_id},
        {"_id": 0}
    )
    
    if not package:
        return {
            "success": True,
            "sealed": False,
            "message": "No sealed package exists for this request yet"
        }
    
    # Format dates
    if isinstance(package.get("sealed_at"), datetime):
        package["sealed_at"] = package["sealed_at"].isoformat()
    
    return {
        "success": True,
        "sealed": True,
        "package_id": package.get("id"),
        "package_hash": package.get("package", {}).get("integrity", {}).get("package_hash"),
        "blockchain_transaction": package.get("blockchain_seal", {}).get("transaction_id"),
        "hcs_topic_id": package.get("package", {}).get("notarization_request", {}).get("hcs_topic_id"),
        "sealed_at": package.get("sealed_at"),
        "explorer_url": package.get("blockchain_seal", {}).get("explorer_url")
    }


@router.get("/request/{request_id}/certificate")
async def get_notarization_certificate(
    request_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get a formatted certificate for a completed notarization.
    Includes all verification data and blockchain proof.
    """
    # Verify authorization
    request = await db.notarization_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Notarization request not found")
    
    user_doc = await db.users.find_one({"id": current_user.id})
    is_admin = user_doc and user_doc.get("role") == "admin"
    is_requester = request.get("user_id") == current_user.id
    is_notary = request.get("notary_id") == current_user.id
    
    if not (is_admin or is_requester or is_notary):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get the sealed package
    package_record = await db.notarization_packages.find_one(
        {"request_id": request_id},
        {"_id": 0}
    )
    
    if not package_record:
        raise HTTPException(
            status_code=404, 
            detail="No sealed package found. Complete the notarization first."
        )
    
    package = package_record.get("package", {})
    blockchain_seal = package_record.get("blockchain_seal", {})
    
    # Build certificate data
    certificate = {
        "certificate_type": "DIGITAL_NOTARIZATION_CERTIFICATE",
        "certificate_id": package.get("package_id"),
        "issued_at": package_record.get("sealed_at").isoformat() if isinstance(package_record.get("sealed_at"), datetime) else package_record.get("sealed_at"),
        
        # Document Information
        "document": {
            "name": package.get("notarization_request", {}).get("document_name"),
            "type": package.get("notarization_request", {}).get("document_type"),
            "notarization_type": package.get("notarization_request", {}).get("notarization_type")
        },
        
        # Participants
        "requester": package.get("participants", {}).get("requester"),
        "notary": package.get("participants", {}).get("notary"),
        
        # Verification Summary
        "verifications": {
            "document_analysis": {
                "performed": package.get("document_analysis", {}).get("total_analyses", 0) > 0,
                "count": package.get("document_analysis", {}).get("total_analyses", 0)
            },
            "biometric": package.get("biometric_verification", {}).get("summary", {}),
            "video_session": package.get("video_sessions", {}).get("summary", {})
        },
        
        # Blockchain Proof
        "blockchain_proof": {
            "network": "Hedera Hashgraph (Testnet)",
            "package_hash": package.get("integrity", {}).get("package_hash"),
            "transaction_id": blockchain_seal.get("transaction_id"),
            "hcs_topic_id": package.get("notarization_request", {}).get("hcs_topic_id"),
            "explorer_url": blockchain_seal.get("explorer_url"),
            "algorithm": "SHA-256"
        },
        
        # Integrity Hashes
        "component_hashes": {
            "document_analysis": package.get("integrity", {}).get("document_analysis_hash"),
            "biometric": package.get("integrity", {}).get("biometric_hash"),
            "video_sessions": package.get("integrity", {}).get("video_sessions_hash"),
            "audit_trail": package.get("integrity", {}).get("audit_trail_hash")
        },
        
        # Legal Statement
        "legal_statement": (
            "This digital certificate attests that the above-referenced document was notarized "
            "in accordance with applicable laws and regulations. All verification data, including "
            "AI document analysis, biometric identity verification, and video session recordings, "
            "have been cryptographically hashed and permanently recorded on the Hedera blockchain. "
            "The integrity of this certificate can be verified using the provided package hash."
        )
    }
    
    return certificate
