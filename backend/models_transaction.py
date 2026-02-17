"""
Transaction Orchestrator Models
Defines Transaction Blueprints, Transactions, Participants, Tasks, and Messages
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import uuid


# ============ ENUMS ============

class TransactionType(str, Enum):
    REAL_ESTATE_CLOSING = "real_estate_closing"
    BUSINESS_CONTRACT = "business_contract"
    ESTATE_SETTLEMENT = "estate_settlement"
    TRUST_SETTLEMENT = "trust_settlement"
    MERGER_ACQUISITION = "merger_acquisition"
    LOAN_CLOSING = "loan_closing"
    CUSTOM = "custom"


class TransactionStatus(str, Enum):
    DRAFT = "draft"
    PENDING_PARTICIPANTS = "pending_participants"
    IN_PROGRESS = "in_progress"
    PENDING_REVIEW = "pending_review"
    PENDING_SETTLEMENT = "pending_settlement"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ON_HOLD = "on_hold"


class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    AWAITING_REVIEW = "awaiting_review"
    COMPLETED = "completed"
    BLOCKED = "blocked"
    SKIPPED = "skipped"
    OVERDUE = "overdue"


class ParticipantRole(str, Enum):
    OWNER = "owner"  # Transaction creator
    BUYER = "buyer"
    SELLER = "seller"
    AGENT = "agent"
    LENDER = "lender"
    TITLE_COMPANY = "title_company"
    ATTORNEY = "attorney"
    NOTARY = "notary"
    EXECUTOR = "executor"
    BENEFICIARY = "beneficiary"
    WITNESS = "witness"
    SIGNER = "signer"
    REVIEWER = "reviewer"
    CUSTOM = "custom"


class ParticipantStatus(str, Enum):
    INVITED = "invited"
    JOINED = "joined"
    ACTIVE = "active"
    COMPLETED = "completed"
    DECLINED = "declined"
    REMOVED = "removed"


# ============ BLUEPRINT MODELS ============

class BlueprintStep(BaseModel):
    """A step within a transaction blueprint"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    order: int
    required_roles: List[str] = []  # Which roles must complete this step
    dependencies: List[str] = []  # IDs of steps that must be completed first
    estimated_duration_hours: int = 24
    is_required: bool = True
    requires_document: bool = False
    requires_signature: bool = False
    requires_notarization: bool = False
    requires_payment: bool = False
    ai_validation_rules: List[str] = []  # Rules for AI to validate


class TransactionBlueprint(BaseModel):
    """Template for a type of transaction"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    transaction_type: TransactionType
    version: str = "1.0"
    is_active: bool = True
    is_system: bool = False  # System blueprints can't be deleted
    
    # Workflow definition
    steps: List[BlueprintStep] = []
    required_roles: List[str] = []
    required_documents: List[str] = []
    
    # Estimated timeline
    estimated_total_days: int = 30
    
    # AI orchestration settings
    ai_enabled: bool = True
    auto_reminders: bool = True
    deadline_enforcement: bool = True
    
    # Metadata
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None


class BlueprintCreate(BaseModel):
    """Create a new blueprint"""
    name: str
    description: str
    transaction_type: TransactionType
    steps: List[dict] = []
    required_roles: List[str] = []
    required_documents: List[str] = []
    estimated_total_days: int = 30
    ai_enabled: bool = True


# ============ TRANSACTION MODELS ============

class TransactionParticipant(BaseModel):
    """A participant in a transaction"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    transaction_id: str
    user_id: Optional[str] = None  # None if external/invited
    email: EmailStr
    name: str
    role: ParticipantRole
    custom_role_name: Optional[str] = None  # For custom roles
    status: ParticipantStatus = ParticipantStatus.INVITED
    
    # Permissions
    can_view_all_documents: bool = False
    can_upload_documents: bool = True
    can_send_messages: bool = True
    can_complete_tasks: bool = True
    
    # Tracking
    invite_sent_at: Optional[datetime] = None
    joined_at: Optional[datetime] = None
    last_active_at: Optional[datetime] = None
    tasks_completed: int = 0
    
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TransactionTask(BaseModel):
    """An individual task within a transaction"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    transaction_id: str
    blueprint_step_id: Optional[str] = None  # Links to blueprint step
    
    # Task details
    name: str
    description: str
    order: int
    status: TaskStatus = TaskStatus.PENDING
    
    # Assignment
    assigned_to: List[str] = []  # Participant IDs
    assigned_roles: List[str] = []  # Role names that can complete
    
    # Dependencies
    dependencies: List[str] = []  # Task IDs that must complete first
    blocked_reason: Optional[str] = None
    
    # Requirements
    requires_document: bool = False
    document_id: Optional[str] = None
    requires_signature: bool = False
    signature_id: Optional[str] = None
    requires_notarization: bool = False
    notarization_request_id: Optional[str] = None
    requires_payment: bool = False
    payment_id: Optional[str] = None
    
    # Timeline
    due_date: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    completed_by: Optional[str] = None
    
    # AI assistance
    ai_suggestions: List[str] = []
    ai_validation_status: Optional[str] = None  # passed, warning, failed
    ai_validation_notes: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None


class TransactionDocument(BaseModel):
    """A document within a transaction"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    transaction_id: str
    task_id: Optional[str] = None
    
    name: str
    file_type: str
    file_size: int
    storage_url: str
    
    uploaded_by: str  # Participant ID
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Verification
    document_hash: Optional[str] = None
    blockchain_seal_id: Optional[str] = None
    ai_analysis_id: Optional[str] = None
    
    # Signatures
    requires_signatures: List[str] = []  # Participant IDs
    signatures: List[dict] = []  # [{participant_id, signed_at, signature_hash}]
    
    is_final: bool = False
    version: int = 1


class TransactionMessage(BaseModel):
    """A message in the transaction room"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    transaction_id: str
    sender_id: str  # Participant ID
    sender_name: str
    
    content: str
    message_type: str = "text"  # text, system, task_update, document_upload
    
    # Attachments
    attachments: List[dict] = []  # [{name, url, type}]
    
    # Mentions
    mentioned_participants: List[str] = []
    
    # Read tracking
    read_by: List[str] = []  # Participant IDs
    
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Transaction(BaseModel):
    """A complete transaction managed by the orchestrator"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Basic info
    name: str
    description: str
    transaction_type: TransactionType
    status: TransactionStatus = TransactionStatus.DRAFT
    
    # Blueprint reference
    blueprint_id: Optional[str] = None
    blueprint_name: Optional[str] = None
    
    # Owner
    owner_id: str
    owner_email: str
    
    # Timeline
    target_completion_date: Optional[datetime] = None
    actual_completion_date: Optional[datetime] = None
    
    # Progress
    total_tasks: int = 0
    completed_tasks: int = 0
    progress_percentage: float = 0.0
    
    # HCS Topic for audit trail
    hcs_topic_id: Optional[str] = None
    hcs_explorer_url: Optional[str] = None
    
    # Settlement
    settlement_hash: Optional[str] = None
    settlement_transaction_id: Optional[str] = None
    settlement_timestamp: Optional[datetime] = None
    
    # AI orchestration
    ai_enabled: bool = True
    ai_last_analysis: Optional[datetime] = None
    ai_risk_score: Optional[float] = None
    ai_recommendations: List[str] = []
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None


class TransactionCreate(BaseModel):
    """Create a new transaction"""
    name: str
    description: str
    transaction_type: TransactionType
    blueprint_id: Optional[str] = None
    target_completion_date: Optional[str] = None
    participants: List[dict] = []  # [{email, name, role}]
    ai_enabled: bool = True


class TransactionSummary(BaseModel):
    """Summary view of a transaction for listings"""
    id: str
    name: str
    transaction_type: TransactionType
    status: TransactionStatus
    progress_percentage: float
    total_tasks: int
    completed_tasks: int
    participant_count: int
    target_completion_date: Optional[datetime]
    created_at: datetime
    owner_email: str
