"""
Notarization Package Service
Creates immutable verification packages that bundle:
- AI Document Analysis results
- Biometric verification data
- Video session metadata
- All signatures and timestamps
Then seals the entire package on Hedera blockchain
"""

import hashlib
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import logging
import uuid

logger = logging.getLogger(__name__)


class NotarizationPackageService:
    """
    Service for creating comprehensive, immutable notarization packages
    that are sealed on Hedera blockchain for permanent verification.
    """
    
    VERSION = "1.0.0"
    
    def __init__(self, db, hedera_service):
        self.db = db
        self.hedera = hedera_service
    
    async def compile_package(
        self,
        request_id: str,
        include_video_metadata: bool = True
    ) -> Dict[str, Any]:
        """
        Compile all verification data for a notarization request into a single package.
        
        Args:
            request_id: The notarization request ID
            include_video_metadata: Whether to include video session details
            
        Returns:
            Complete notarization package ready for blockchain sealing
        """
        # Get the notarization request
        request = await self.db.notarization_requests.find_one({"id": request_id})
        if not request:
            raise ValueError(f"Notarization request {request_id} not found")
        
        # Get user info
        user = await self.db.users.find_one(
            {"id": request.get("user_id")},
            {"_id": 0, "hashed_password": 0}
        )
        
        # Get notary info if assigned
        notary_profile = None
        notary_user = None
        if request.get("notary_id"):
            notary_profile = await self.db.notary_profiles.find_one(
                {"user_id": request.get("notary_id")},
                {"_id": 0}
            )
            notary_user = await self.db.users.find_one(
                {"id": request.get("notary_id")},
                {"_id": 0, "hashed_password": 0}
            )
        
        # Get AI document analysis
        document_analyses = await self.db.ai_analyses.find(
            {"session_id": request_id}
        ).to_list(50)
        
        # Clean analyses for serialization
        cleaned_analyses = []
        for analysis in document_analyses:
            analysis.pop("_id", None)
            # Convert datetime objects
            if isinstance(analysis.get("created_at"), datetime):
                analysis["created_at"] = analysis["created_at"].isoformat()
            cleaned_analyses.append(analysis)
        
        # Get biometric verifications
        biometric_records = await self.db.biometric_verifications.find(
            {"session_id": request_id}
        ).to_list(50)
        
        cleaned_biometrics = []
        for bio in biometric_records:
            bio.pop("_id", None)
            if isinstance(bio.get("timestamp"), datetime):
                bio["timestamp"] = bio["timestamp"].isoformat()
            if isinstance(bio.get("created_at"), datetime):
                bio["created_at"] = bio["created_at"].isoformat()
            cleaned_biometrics.append(bio)
        
        # Get video session data
        video_sessions = []
        if include_video_metadata:
            sessions = await self.db.video_sessions.find(
                {"request_id": request_id}
            ).to_list(10)
            
            for session in sessions:
                session.pop("_id", None)
                # Convert datetime objects
                for field in ["created_at", "start_time", "end_time"]:
                    if isinstance(session.get(field), datetime):
                        session[field] = session[field].isoformat()
                video_sessions.append(session)
        
        # Get notary actions/audit trail
        notary_actions = await self.db.notary_actions.find(
            {"request_id": request_id}
        ).sort("timestamp", 1).to_list(100)
        
        cleaned_actions = []
        for action in notary_actions:
            action.pop("_id", None)
            if isinstance(action.get("timestamp"), datetime):
                action["timestamp"] = action["timestamp"].isoformat()
            cleaned_actions.append(action)
        
        # Get blockchain seals for this request
        blockchain_seals = await self.db.blockchain_seals.find(
            {"notary_request_id": request_id}
        ).to_list(50)
        
        cleaned_seals = []
        for seal in blockchain_seals:
            seal.pop("_id", None)
            if isinstance(seal.get("sealed_at"), datetime):
                seal["sealed_at"] = seal["sealed_at"].isoformat()
            cleaned_seals.append(seal)
        
        # Build the comprehensive package
        package_timestamp = datetime.now(timezone.utc)
        
        package = {
            "package_version": self.VERSION,
            "package_id": str(uuid.uuid4()),
            "package_type": "NOTARIZATION_CERTIFICATE",
            "created_at": package_timestamp.isoformat(),
            
            # Request metadata
            "notarization_request": {
                "id": request.get("id"),
                "document_name": request.get("document_name"),
                "document_type": request.get("document_type"),
                "notarization_type": request.get("notarization_type"),
                "status": request.get("status"),
                "created_at": request.get("created_at").isoformat() if isinstance(request.get("created_at"), datetime) else request.get("created_at"),
                "completed_at": request.get("completed_at").isoformat() if isinstance(request.get("completed_at"), datetime) else request.get("completed_at"),
                "hcs_topic_id": request.get("hcs_topic_id"),
                "signers": request.get("signers", []),
                "notes": request.get("notes", "")
            },
            
            # Participant information
            "participants": {
                "requester": {
                    "id": user.get("id") if user else None,
                    "email": user.get("email") if user else None,
                    "full_name": user.get("full_name") if user else None
                },
                "notary": {
                    "id": notary_user.get("id") if notary_user else None,
                    "email": notary_user.get("email") if notary_user else None,
                    "full_name": notary_profile.get("full_legal_name") if notary_profile else None,
                    "license_number": notary_profile.get("license_number") if notary_profile else None,
                    "license_state": notary_profile.get("license_state") if notary_profile else None,
                    "commission_expiry": notary_profile.get("commission_expiry") if notary_profile else None,
                    "ron_certified": notary_profile.get("ron_certified") if notary_profile else None
                } if notary_profile else None
            },
            
            # AI Document Analysis Results
            "document_analysis": {
                "total_analyses": len(cleaned_analyses),
                "analyses": cleaned_analyses
            },
            
            # Biometric Verification Results
            "biometric_verification": {
                "total_verifications": len(cleaned_biometrics),
                "verifications": cleaned_biometrics,
                "summary": self._summarize_biometrics(cleaned_biometrics)
            },
            
            # Video Session Data
            "video_sessions": {
                "total_sessions": len(video_sessions),
                "sessions": video_sessions,
                "summary": self._summarize_video_sessions(video_sessions)
            },
            
            # Notary Actions / Audit Trail
            "audit_trail": {
                "total_actions": len(cleaned_actions),
                "actions": cleaned_actions
            },
            
            # Blockchain Seals
            "blockchain_seals": {
                "total_seals": len(cleaned_seals),
                "seals": cleaned_seals
            },
            
            # Package integrity
            "integrity": {}  # Will be populated with hashes
        }
        
        # Calculate package hash
        package_content = json.dumps(package, sort_keys=True)
        package_hash = hashlib.sha256(package_content.encode()).hexdigest()
        
        # Calculate component hashes for verification
        package["integrity"] = {
            "package_hash": package_hash,
            "document_analysis_hash": self._hash_component(cleaned_analyses),
            "biometric_hash": self._hash_component(cleaned_biometrics),
            "video_sessions_hash": self._hash_component(video_sessions),
            "audit_trail_hash": self._hash_component(cleaned_actions),
            "algorithm": "SHA-256"
        }
        
        return package
    
    async def seal_package(
        self,
        request_id: str,
        notary_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Compile and seal a notarization package on Hedera blockchain.
        
        Args:
            request_id: The notarization request ID
            notary_id: The notary performing the seal (optional)
            
        Returns:
            Sealed package with blockchain transaction details
        """
        # Compile the package
        package = await self.compile_package(request_id)
        
        # Get the HCS topic for this request
        request = await self.db.notarization_requests.find_one({"id": request_id})
        topic_id = request.get("hcs_topic_id") if request else None
        
        # Create seal payload for blockchain
        seal_payload = {
            "type": "NOTARIZATION_PACKAGE_SEAL",
            "version": self.VERSION,
            "package_id": package["package_id"],
            "request_id": request_id,
            "package_hash": package["integrity"]["package_hash"],
            "component_hashes": {
                "document_analysis": package["integrity"]["document_analysis_hash"],
                "biometric": package["integrity"]["biometric_hash"],
                "video_sessions": package["integrity"]["video_sessions_hash"],
                "audit_trail": package["integrity"]["audit_trail_hash"]
            },
            "sealed_by_notary": notary_id,
            "sealed_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Submit to HCS topic if available
        hcs_result = None
        if topic_id and self.hedera._sdk_available:
            hcs_result = await self.hedera.submit_message(topic_id, seal_payload)
        
        # Also seal the package hash on blockchain
        blockchain_result = await self.hedera.seal_document(
            document_hash=package["integrity"]["package_hash"],
            document_name=f"NotarizationPackage-{request_id}",
            user_id=request.get("user_id") if request else "system",
            notary_id=notary_id,
            session_topic_id=topic_id,
            metadata={
                "package_type": "NOTARIZATION_CERTIFICATE",
                "package_id": package["package_id"],
                "component_count": {
                    "analyses": package["document_analysis"]["total_analyses"],
                    "biometrics": package["biometric_verification"]["total_verifications"],
                    "video_sessions": package["video_sessions"]["total_sessions"],
                    "actions": package["audit_trail"]["total_actions"]
                }
            }
        )
        
        # Store the sealed package in database
        sealed_package = {
            "id": package["package_id"],
            "request_id": request_id,
            "package": package,
            "blockchain_seal": blockchain_result,
            "hcs_submission": hcs_result,
            "sealed_at": datetime.now(timezone.utc),
            "sealed_by": notary_id
        }
        
        await self.db.notarization_packages.insert_one(sealed_package)
        
        # Update the request with package reference
        await self.db.notarization_requests.update_one(
            {"id": request_id},
            {"$set": {
                "package_id": package["package_id"],
                "package_hash": package["integrity"]["package_hash"],
                "package_sealed_at": datetime.now(timezone.utc)
            }}
        )
        
        logger.info(f"Notarization package sealed: {package['package_id']} for request {request_id}")
        
        return {
            "success": True,
            "package_id": package["package_id"],
            "package_hash": package["integrity"]["package_hash"],
            "blockchain_transaction": blockchain_result.get("transaction_id") if blockchain_result else None,
            "hcs_sequence": hcs_result.get("sequence_number") if hcs_result else None,
            "hcs_topic_id": topic_id,
            "explorer_url": blockchain_result.get("explorer_url") if blockchain_result else None,
            "sealed_at": sealed_package["sealed_at"].isoformat()
        }
    
    async def get_package(self, package_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a sealed notarization package"""
        package = await self.db.notarization_packages.find_one(
            {"id": package_id},
            {"_id": 0}
        )
        if package and isinstance(package.get("sealed_at"), datetime):
            package["sealed_at"] = package["sealed_at"].isoformat()
        return package
    
    async def verify_package(self, package_id: str) -> Dict[str, Any]:
        """
        Verify the integrity of a sealed notarization package.
        Recalculates hashes and compares with stored values.
        """
        stored = await self.db.notarization_packages.find_one({"id": package_id})
        if not stored:
            return {"verified": False, "error": "Package not found"}
        
        package = stored.get("package", {})
        stored_hash = package.get("integrity", {}).get("package_hash")
        
        # Recalculate package hash (excluding integrity section)
        package_copy = {k: v for k, v in package.items() if k != "integrity"}
        package_copy["integrity"] = {}
        recalculated_hash = hashlib.sha256(
            json.dumps(package_copy, sort_keys=True).encode()
        ).hexdigest()
        
        hash_match = stored_hash == recalculated_hash
        
        # Check blockchain verification
        blockchain_seal = stored.get("blockchain_seal", {})
        
        return {
            "verified": hash_match,
            "package_id": package_id,
            "stored_hash": stored_hash,
            "recalculated_hash": recalculated_hash,
            "hash_match": hash_match,
            "blockchain_transaction": blockchain_seal.get("transaction_id"),
            "hcs_topic_id": package.get("notarization_request", {}).get("hcs_topic_id"),
            "sealed_at": stored.get("sealed_at").isoformat() if isinstance(stored.get("sealed_at"), datetime) else stored.get("sealed_at"),
            "verification_timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    def _hash_component(self, data: Any) -> str:
        """Generate SHA-256 hash of a component"""
        return hashlib.sha256(
            json.dumps(data, sort_keys=True, default=str).encode()
        ).hexdigest()
    
    def _summarize_biometrics(self, biometrics: List[Dict]) -> Dict[str, Any]:
        """Generate summary of biometric verifications"""
        if not biometrics:
            return {"status": "none", "message": "No biometric verifications performed"}
        
        passed = sum(1 for b in biometrics if b.get("status") == "passed")
        failed = sum(1 for b in biometrics if b.get("status") == "failed")
        
        avg_confidence = 0
        if biometrics:
            scores = [b.get("confidence_score", 0) for b in biometrics if b.get("confidence_score")]
            avg_confidence = sum(scores) / len(scores) if scores else 0
        
        return {
            "total": len(biometrics),
            "passed": passed,
            "failed": failed,
            "average_confidence": round(avg_confidence, 2),
            "status": "verified" if passed > 0 and failed == 0 else "partial" if passed > 0 else "failed"
        }
    
    def _summarize_video_sessions(self, sessions: List[Dict]) -> Dict[str, Any]:
        """Generate summary of video sessions"""
        if not sessions:
            return {"status": "none", "message": "No video sessions recorded"}
        
        completed = sum(1 for s in sessions if s.get("status") == "completed")
        total_duration = 0
        
        for session in sessions:
            if session.get("start_time") and session.get("end_time"):
                try:
                    start = datetime.fromisoformat(session["start_time"].replace("Z", "+00:00"))
                    end = datetime.fromisoformat(session["end_time"].replace("Z", "+00:00"))
                    total_duration += (end - start).total_seconds()
                except (ValueError, TypeError):
                    pass
        
        return {
            "total_sessions": len(sessions),
            "completed_sessions": completed,
            "total_duration_seconds": int(total_duration),
            "total_duration_minutes": round(total_duration / 60, 1),
            "status": "completed" if completed > 0 else "pending"
        }


# Factory function to create service instance
def create_package_service(db, hedera_service):
    return NotarizationPackageService(db, hedera_service)
