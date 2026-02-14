from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid

class NotaryProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    license_number: str
    license_state: str
    commission_expiry: str
    ron_certified: bool = False
    specializations: List[str] = []
    hourly_rate: float = 0.0
    bio: str = ""
    status: str = "pending"  # pending, approved, suspended
    created_at: datetime = Field(default_factory=datetime.utcnow)

class NotaryProfileCreate(BaseModel):
    license_number: str
    license_state: str
    commission_expiry: str
    ron_certified: bool = False
    specializations: List[str] = []
    hourly_rate: float = 0.0
    bio: str = ""

class NotarizationRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    notary_id: Optional[str] = None
    document_name: str
    document_type: str  # power_of_attorney, real_estate, affidavit, etc.
    notarization_type: str  # traditional, ron, mobile
    status: str = "pending"  # pending, assigned, in_progress, reviewing, completed, cancelled
    scheduled_time: Optional[datetime] = None
    signers: List[dict] = []  # [{name, email, verified}]
    notes: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

class NotarizationRequestCreate(BaseModel):
    document_name: str
    document_type: str
    notarization_type: str
    scheduled_time: Optional[str] = None
    signers: List[dict] = []
    notes: str = ""

class NotarySession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request_id: str
    notary_id: str
    user_id: str
    session_type: str  # video, in_person
    status: str = "scheduled"  # scheduled, active, completed, cancelled
    start_time: datetime = Field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = None
    recording_url: Optional[str] = None
    verification_status: dict = {}  # {identity_verified, biometric_verified, document_verified}
    notes: str = ""

class IdentityVerification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    user_id: str
    verification_type: str  # facial, voiceprint, liveness
    status: str = "pending"  # pending, passed, failed
    confidence_score: float = 0.0
    verification_data: dict = {}
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class NotaryAction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request_id: str
    notary_id: str
    action_type: str  # assign, start_session, verify_identity, approve, reject
    notes: str = ""
    timestamp: datetime = Field(default_factory=datetime.utcnow)