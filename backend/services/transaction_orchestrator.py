"""
AI Transaction Orchestrator Service
Manages transaction workflows with AI-powered suggestions and anomaly detection
"""

import os
import logging
import hashlib
import json
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


async def _emit_timeline(transaction_id: str, event: dict):
    """Emit a timeline event to all connected viewers (best-effort, non-blocking)."""
    try:
        from services.ws_manager import ws_manager
        await ws_manager.emit_timeline_event(transaction_id, event)
    except Exception as e:
        logger.debug(f"Timeline emit failed: {e}")


class TransactionOrchestratorService:
    """AI-powered transaction orchestration engine"""
    
    def __init__(self, db: AsyncIOMotorDatabase, hedera_service=None, ai_service=None):
        self.db = db
        self.hedera_service = hedera_service
        self.ai_service = ai_service
    
    # ============ BLUEPRINT MANAGEMENT ============
    
    async def get_system_blueprints(self) -> List[dict]:
        """Get all pre-defined system blueprints"""
        return SYSTEM_BLUEPRINTS
    
    async def create_blueprint(self, blueprint_data: dict, user_id: str) -> dict:
        """Create a custom blueprint"""
        from models_transaction import TransactionBlueprint, BlueprintStep
        import uuid
        
        # Generate step IDs if not present
        steps = []
        for i, step in enumerate(blueprint_data.get("steps", [])):
            step_obj = {
                "id": step.get("id", str(uuid.uuid4())),
                "name": step["name"],
                "description": step.get("description", ""),
                "order": step.get("order", i + 1),
                "required_roles": step.get("required_roles", []),
                "dependencies": step.get("dependencies", []),
                "estimated_duration_hours": step.get("estimated_duration_hours", 24),
                "is_required": step.get("is_required", True),
                "requires_document": step.get("requires_document", False),
                "requires_signature": step.get("requires_signature", False),
                "requires_notarization": step.get("requires_notarization", False),
                "requires_payment": step.get("requires_payment", False),
                "ai_validation_rules": step.get("ai_validation_rules", [])
            }
            steps.append(step_obj)
        
        created_at = datetime.now(timezone.utc)
        
        blueprint = {
            "id": str(uuid.uuid4()),
            "name": blueprint_data["name"],
            "description": blueprint_data.get("description", ""),
            "transaction_type": blueprint_data.get("transaction_type", "custom"),
            "version": "1.0",
            "is_active": True,
            "is_system": False,
            "steps": steps,
            "required_roles": blueprint_data.get("required_roles", []),
            "required_documents": blueprint_data.get("required_documents", []),
            "estimated_total_days": blueprint_data.get("estimated_total_days", 30),
            "ai_enabled": blueprint_data.get("ai_enabled", True),
            "auto_reminders": True,
            "deadline_enforcement": True,
            "created_by": user_id,
            "created_at": created_at
        }
        
        await self.db.transaction_blueprints.insert_one(blueprint)
        # Remove MongoDB _id and convert datetime before returning
        blueprint.pop("_id", None)
        blueprint["created_at"] = created_at.isoformat()
        return blueprint
    
    async def get_blueprint(self, blueprint_id: str) -> Optional[dict]:
        """Get a specific blueprint"""
        # Check system blueprints first
        for bp in SYSTEM_BLUEPRINTS:
            if bp["id"] == blueprint_id:
                return bp
        
        # Check custom blueprints
        return await self.db.transaction_blueprints.find_one(
            {"id": blueprint_id},
            {"_id": 0}
        )
    
    # ============ TRANSACTION MANAGEMENT ============
    
    async def create_transaction(
        self,
        transaction_data: dict,
        owner_id: str,
        owner_email: str
    ) -> dict:
        """Create a new transaction from blueprint or custom"""
        import uuid
        from models_transaction import TransactionStatus
        
        transaction_id = str(uuid.uuid4())
        
        # Get blueprint if specified
        blueprint = None
        if transaction_data.get("blueprint_id"):
            blueprint = await self.get_blueprint(transaction_data["blueprint_id"])
        
        # Create HCS topic for audit trail
        hcs_topic_id = None
        hcs_explorer_url = None
        if self.hedera_service:
            try:
                topic_result = await self.hedera_service.create_topic(
                    memo=f"Transaction: {transaction_data['name']}"
                )
                if topic_result.get("success"):
                    hcs_topic_id = topic_result["topic_id"]
                    hcs_explorer_url = topic_result.get("explorer_url")
                    
                    # Log transaction creation
                    await self.hedera_service.submit_message(hcs_topic_id, {
                        "type": "TRANSACTION_CREATED",
                        "transaction_id": transaction_id,
                        "transaction_type": transaction_data["transaction_type"],
                        "owner_id": owner_id
                    })
            except Exception as e:
                logger.error(f"Failed to create HCS topic: {e}")
        
        # Parse target date
        target_date = None
        if transaction_data.get("target_completion_date"):
            try:
                target_date = datetime.fromisoformat(transaction_data["target_completion_date"].replace('Z', '+00:00'))
            except:
                target_date = datetime.now(timezone.utc) + timedelta(days=30)
        
        transaction = {
            "id": transaction_id,
            "name": transaction_data["name"],
            "description": transaction_data.get("description", ""),
            "transaction_type": transaction_data["transaction_type"],
            "status": TransactionStatus.DRAFT.value,
            "blueprint_id": blueprint["id"] if blueprint else None,
            "blueprint_name": blueprint["name"] if blueprint else None,
            "owner_id": owner_id,
            "owner_email": owner_email,
            "target_completion_date": target_date,
            "total_tasks": 0,
            "completed_tasks": 0,
            "progress_percentage": 0.0,
            "hcs_topic_id": hcs_topic_id,
            "hcs_explorer_url": hcs_explorer_url,
            "ai_enabled": transaction_data.get("ai_enabled", True),
            "ai_recommendations": [],
            "created_at": datetime.now(timezone.utc)
        }
        
        await self.db.transactions.insert_one(transaction)
        
        # Add owner as participant
        owner_participant = {
            "id": str(uuid.uuid4()),
            "transaction_id": transaction_id,
            "user_id": owner_id,
            "email": owner_email,
            "name": owner_email.split('@')[0],
            "role": "owner",
            "status": "joined",
            "can_view_all_documents": True,
            "can_upload_documents": True,
            "can_send_messages": True,
            "can_complete_tasks": True,
            "joined_at": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc)
        }
        await self.db.transaction_participants.insert_one(owner_participant)
        
        # Add invited participants
        for participant in transaction_data.get("participants", []):
            await self.add_participant(
                transaction_id=transaction_id,
                email=participant["email"],
                name=participant.get("name", participant["email"].split('@')[0]),
                role=participant.get("role", "signer")
            )
        
        # Generate tasks from blueprint
        if blueprint:
            await self._generate_tasks_from_blueprint(transaction_id, blueprint)
        
        # Get fresh transaction with task count
        return await self.get_transaction(transaction_id)
    
    async def _generate_tasks_from_blueprint(self, transaction_id: str, blueprint: dict):
        """Generate tasks from blueprint steps"""
        import uuid
        from models_transaction import TaskStatus
        
        tasks = []
        step_id_map = {}  # Map blueprint step IDs to task IDs
        
        for step in blueprint.get("steps", []):
            task_id = str(uuid.uuid4())
            step_id_map[step["id"]] = task_id
            
            task = {
                "id": task_id,
                "transaction_id": transaction_id,
                "blueprint_step_id": step["id"],
                "name": step["name"],
                "description": step.get("description", ""),
                "order": step.get("order", 0),
                "status": TaskStatus.PENDING.value,
                "assigned_to": [],
                "assigned_roles": step.get("required_roles", []),
                "dependencies": [],  # Will update after all tasks created
                "requires_document": step.get("requires_document", False),
                "requires_signature": step.get("requires_signature", False),
                "requires_notarization": step.get("requires_notarization", False),
                "requires_payment": step.get("requires_payment", False),
                "ai_suggestions": [],
                "created_at": datetime.now(timezone.utc)
            }
            tasks.append(task)
        
        # Update dependencies with actual task IDs
        for i, step in enumerate(blueprint.get("steps", [])):
            for dep_step_id in step.get("dependencies", []):
                if dep_step_id in step_id_map:
                    tasks[i]["dependencies"].append(step_id_map[dep_step_id])
        
        # Insert all tasks
        if tasks:
            await self.db.transaction_tasks.insert_many(tasks)
            
            # Update transaction task count
            await self.db.transactions.update_one(
                {"id": transaction_id},
                {"$set": {"total_tasks": len(tasks)}}
            )
    
    async def get_transaction(self, transaction_id: str) -> Optional[dict]:
        """Get transaction with participant and task counts"""
        transaction = await self.db.transactions.find_one(
            {"id": transaction_id},
            {"_id": 0}
        )
        
        if not transaction:
            return None
        
        # Get counts
        participant_count = await self.db.transaction_participants.count_documents(
            {"transaction_id": transaction_id}
        )
        
        # Format dates
        for field in ["target_completion_date", "actual_completion_date", "created_at", 
                      "updated_at", "ai_last_analysis", "settlement_timestamp"]:
            if field in transaction and isinstance(transaction[field], datetime):
                transaction[field] = transaction[field].isoformat()
        
        transaction["participant_count"] = participant_count
        return transaction
    
    async def get_user_transactions(self, user_id: str) -> List[dict]:
        """Get all transactions where user is a participant"""
        # Get transaction IDs where user is participant
        participant_docs = await self.db.transaction_participants.find(
            {"user_id": user_id},
            {"transaction_id": 1}
        ).to_list(100)
        
        transaction_ids = [p["transaction_id"] for p in participant_docs]
        
        transactions = await self.db.transactions.find(
            {"id": {"$in": transaction_ids}},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        # Add participant counts and format dates
        for tx in transactions:
            tx["participant_count"] = await self.db.transaction_participants.count_documents(
                {"transaction_id": tx["id"]}
            )
            for field in ["target_completion_date", "created_at", "updated_at"]:
                if field in tx and isinstance(tx[field], datetime):
                    tx[field] = tx[field].isoformat()
        
        return transactions
    
    async def update_transaction_status(
        self,
        transaction_id: str,
        new_status: str,
        user_id: str
    ) -> dict:
        """Update transaction status with audit trail"""
        transaction = await self.db.transactions.find_one({"id": transaction_id})
        if not transaction:
            raise ValueError("Transaction not found")
        
        old_status = transaction.get("status")
        
        update_data = {
            "status": new_status,
            "updated_at": datetime.now(timezone.utc)
        }
        
        if new_status == "completed":
            update_data["actual_completion_date"] = datetime.now(timezone.utc)
        
        await self.db.transactions.update_one(
            {"id": transaction_id},
            {"$set": update_data}
        )
        
        # Log to HCS
        if transaction.get("hcs_topic_id") and self.hedera_service:
            try:
                await self.hedera_service.submit_message(transaction["hcs_topic_id"], {
                    "type": "STATUS_CHANGED",
                    "transaction_id": transaction_id,
                    "old_status": old_status,
                    "new_status": new_status,
                    "changed_by": user_id
                })
            except Exception as e:
                logger.error(f"Failed to log status change to HCS: {e}")
        
        return await self.get_transaction(transaction_id)
    
    # ============ PARTICIPANT MANAGEMENT ============
    
    async def add_participant(
        self,
        transaction_id: str,
        email: str,
        name: str,
        role: str,
        custom_role_name: Optional[str] = None
    ) -> dict:
        """Add a participant to a transaction"""
        import uuid
        
        # Check if already exists
        existing = await self.db.transaction_participants.find_one({
            "transaction_id": transaction_id,
            "email": email
        })
        if existing:
            return existing
        
        # Check if user exists in system
        user = await self.db.users.find_one({"email": email}, {"_id": 0, "id": 1})
        
        participant = {
            "id": str(uuid.uuid4()),
            "transaction_id": transaction_id,
            "user_id": user["id"] if user else None,
            "email": email,
            "name": name,
            "role": role,
            "custom_role_name": custom_role_name,
            "status": "invited",
            "can_view_all_documents": role in ["owner", "attorney", "notary"],
            "can_upload_documents": True,
            "can_send_messages": True,
            "can_complete_tasks": True,
            "invite_sent_at": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc)
        }
        
        await self.db.transaction_participants.insert_one(participant)
        
        # Log to HCS
        transaction = await self.db.transactions.find_one({"id": transaction_id})
        if transaction and transaction.get("hcs_topic_id") and self.hedera_service:
            try:
                await self.hedera_service.submit_message(transaction["hcs_topic_id"], {
                    "type": "PARTICIPANT_ADDED",
                    "participant_email": email,
                    "participant_role": role
                })
            except Exception as e:
                logger.error(f"Failed to log participant add to HCS: {e}")
        
        return {k: v for k, v in participant.items() if k != "_id"}

    async def get_participants(self, transaction_id: str) -> List[dict]:
        """Get all participants for a transaction"""
        participants = await self.db.transaction_participants.find(
            {"transaction_id": transaction_id},
            {"_id": 0}
        ).to_list(50)
        
        for p in participants:
            for field in ["invite_sent_at", "joined_at", "last_active_at", "created_at"]:
                if field in p and isinstance(p[field], datetime):
                    p[field] = p[field].isoformat()
        
        return participants
    
    async def join_transaction(self, transaction_id: str, user_id: str, user_email: str) -> dict:
        """User joins a transaction they were invited to"""
        participant = await self.db.transaction_participants.find_one({
            "transaction_id": transaction_id,
            "email": user_email
        })
        
        if not participant:
            raise ValueError("No invitation found for this user")
        
        await self.db.transaction_participants.update_one(
            {"id": participant["id"]},
            {"$set": {
                "user_id": user_id,
                "status": "joined",
                "joined_at": datetime.now(timezone.utc)
            }}
        )
        
        # Check if all participants joined, update transaction status
        pending = await self.db.transaction_participants.count_documents({
            "transaction_id": transaction_id,
            "status": "invited"
        })
        
        if pending == 0:
            transaction = await self.db.transactions.find_one({"id": transaction_id})
            if transaction and transaction.get("status") == "pending_participants":
                await self.update_transaction_status(transaction_id, "in_progress", user_id)
        
        return await self.db.transaction_participants.find_one(
            {"id": participant["id"]},
            {"_id": 0}
        )
    
    # ============ TASK MANAGEMENT ============
    
    async def get_tasks(self, transaction_id: str) -> List[dict]:
        """Get all tasks for a transaction"""
        tasks = await self.db.transaction_tasks.find(
            {"transaction_id": transaction_id},
            {"_id": 0}
        ).sort("order", 1).to_list(100)
        
        for task in tasks:
            for field in ["due_date", "started_at", "completed_at", "created_at", "updated_at"]:
                if field in task and isinstance(task[field], datetime):
                    task[field] = task[field].isoformat()
        
        return tasks
    
    async def update_task_status(
        self,
        task_id: str,
        new_status: str,
        user_id: str,
        notes: Optional[str] = None
    ) -> dict:
        """Update task status"""
        task = await self.db.transaction_tasks.find_one({"id": task_id})
        if not task:
            raise ValueError("Task not found")
        
        update_data = {
            "status": new_status,
            "updated_at": datetime.now(timezone.utc)
        }
        
        if new_status == "in_progress" and not task.get("started_at"):
            update_data["started_at"] = datetime.now(timezone.utc)
        elif new_status == "completed":
            update_data["completed_at"] = datetime.now(timezone.utc)
            update_data["completed_by"] = user_id
        
        await self.db.transaction_tasks.update_one(
            {"id": task_id},
            {"$set": update_data}
        )
        
        # Update transaction progress
        await self._update_transaction_progress(task["transaction_id"])
        
        # Log to HCS
        transaction = await self.db.transactions.find_one({"id": task["transaction_id"]})
        if transaction and transaction.get("hcs_topic_id") and self.hedera_service:
            try:
                await self.hedera_service.submit_message(transaction["hcs_topic_id"], {
                    "type": "TASK_STATUS_CHANGED",
                    "task_id": task_id,
                    "task_name": task["name"],
                    "new_status": new_status,
                    "changed_by": user_id
                })
            except Exception as e:
                logger.error(f"Failed to log task update to HCS: {e}")
        
        # Unblock dependent tasks if completed
        if new_status == "completed":
            await self._check_and_unblock_tasks(task["transaction_id"], task_id)
        
        # Emit timeline event
        now = datetime.now(timezone.utc).isoformat()
        if new_status == "completed":
            await _emit_timeline(task["transaction_id"], {
                "type": "task", "category": "tasks", "icon": "check-circle",
                "title": f'Task Completed: {task["name"]}',
                "description": f'Completed by: {user_id}',
                "timestamp": now, "severity": "success",
                "metadata": {"task_id": task_id},
            })
        elif new_status == "in_progress":
            await _emit_timeline(task["transaction_id"], {
                "type": "task", "category": "tasks", "icon": "play",
                "title": f'Task Started: {task["name"]}',
                "description": task.get("description", "")[:100],
                "timestamp": now, "severity": "info",
                "metadata": {"task_id": task_id},
            })

        return await self.db.transaction_tasks.find_one({"id": task_id}, {"_id": 0})
    
    async def _update_transaction_progress(self, transaction_id: str):
        """Recalculate transaction progress"""
        total = await self.db.transaction_tasks.count_documents({"transaction_id": transaction_id})
        completed = await self.db.transaction_tasks.count_documents({
            "transaction_id": transaction_id,
            "status": "completed"
        })
        
        progress = (completed / total * 100) if total > 0 else 0
        
        await self.db.transactions.update_one(
            {"id": transaction_id},
            {"$set": {
                "total_tasks": total,
                "completed_tasks": completed,
                "progress_percentage": round(progress, 1)
            }}
        )
    
    async def _check_and_unblock_tasks(self, transaction_id: str, completed_task_id: str):
        """Check if any tasks can be unblocked after task completion"""
        blocked_tasks = await self.db.transaction_tasks.find({
            "transaction_id": transaction_id,
            "status": "blocked"
        }).to_list(50)
        
        for task in blocked_tasks:
            # Check if all dependencies completed
            deps_completed = True
            for dep_id in task.get("dependencies", []):
                dep_task = await self.db.transaction_tasks.find_one({"id": dep_id})
                if dep_task and dep_task.get("status") != "completed":
                    deps_completed = False
                    break
            
            if deps_completed:
                await self.db.transaction_tasks.update_one(
                    {"id": task["id"]},
                    {"$set": {"status": "pending", "blocked_reason": None}}
                )
    
    # ============ MESSAGING ============
    
    async def send_message(
        self,
        transaction_id: str,
        sender_participant_id: str,
        sender_name: str,
        content: str,
        message_type: str = "text",
        attachments: List[dict] = None
    ) -> dict:
        """Send a message in the transaction room"""
        import uuid
        
        message = {
            "id": str(uuid.uuid4()),
            "transaction_id": transaction_id,
            "sender_id": sender_participant_id,
            "sender_name": sender_name,
            "content": content,
            "message_type": message_type,
            "attachments": attachments or [],
            "mentioned_participants": [],
            "read_by": [sender_participant_id],
            "created_at": datetime.now(timezone.utc)
        }
        
        await self.db.transaction_messages.insert_one(message)
        return {k: v for k, v in message.items() if k != "_id"}
    
    async def get_messages(self, transaction_id: str, limit: int = 50) -> List[dict]:
        """Get messages for a transaction"""
        messages = await self.db.transaction_messages.find(
            {"transaction_id": transaction_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        
        for msg in messages:
            if isinstance(msg.get("created_at"), datetime):
                msg["created_at"] = msg["created_at"].isoformat()
        
        return list(reversed(messages))  # Return in chronological order
    
    # ============ AI ORCHESTRATION ============
    
    async def get_ai_recommendations(self, transaction_id: str) -> dict:
        """Get AI-powered recommendations for a transaction"""
        transaction = await self.db.transactions.find_one({"id": transaction_id})
        if not transaction:
            raise ValueError("Transaction not found")
        
        tasks = await self.get_tasks(transaction_id)
        participants = await self.get_participants(transaction_id)
        
        recommendations = []
        risk_factors = []
        
        # Analyze pending tasks
        pending_tasks = [t for t in tasks if t["status"] == "pending"]
        blocked_tasks = [t for t in tasks if t["status"] == "blocked"]
        overdue_tasks = [t for t in tasks if t.get("due_date") and 
                        datetime.fromisoformat(t["due_date"]) < datetime.now(timezone.utc) and
                        t["status"] != "completed"]
        
        if overdue_tasks:
            recommendations.append({
                "type": "warning",
                "message": f"{len(overdue_tasks)} task(s) are overdue and require immediate attention",
                "action": "Review overdue tasks",
                "priority": "high"
            })
            risk_factors.append("overdue_tasks")
        
        if blocked_tasks:
            recommendations.append({
                "type": "info",
                "message": f"{len(blocked_tasks)} task(s) are blocked waiting for dependencies",
                "action": "Complete blocking tasks first",
                "priority": "medium"
            })
        
        # Check participant status
        pending_participants = [p for p in participants if p["status"] == "invited"]
        if pending_participants:
            recommendations.append({
                "type": "action",
                "message": f"{len(pending_participants)} participant(s) haven't joined yet",
                "action": "Send reminders to pending participants",
                "priority": "medium"
            })
        
        # Suggest next actions
        if pending_tasks:
            next_task = min(pending_tasks, key=lambda t: t["order"])
            recommendations.append({
                "type": "suggestion",
                "message": f"Next recommended action: {next_task['name']}",
                "action": f"Start task: {next_task['id']}",
                "priority": "normal"
            })
        
        # Calculate risk score (0-100)
        risk_score = 0
        if overdue_tasks:
            risk_score += len(overdue_tasks) * 15
        if pending_participants:
            risk_score += len(pending_participants) * 10
        if blocked_tasks:
            risk_score += len(blocked_tasks) * 5
        
        # Progress-based risk
        if transaction.get("target_completion_date"):
            try:
                target = datetime.fromisoformat(transaction["target_completion_date"])
                days_remaining = (target - datetime.now(timezone.utc)).days
                progress = transaction.get("progress_percentage", 0)
                
                if days_remaining < 7 and progress < 50:
                    risk_score += 20
                    recommendations.append({
                        "type": "warning",
                        "message": "Transaction may not complete by target date",
                        "action": "Expedite remaining tasks",
                        "priority": "high"
                    })
            except:
                pass
        
        risk_score = min(100, risk_score)
        
        # Update transaction with AI analysis
        await self.db.transactions.update_one(
            {"id": transaction_id},
            {"$set": {
                "ai_last_analysis": datetime.now(timezone.utc),
                "ai_risk_score": risk_score,
                "ai_recommendations": [r["message"] for r in recommendations[:5]]
            }}
        )
        
        return {
            "transaction_id": transaction_id,
            "risk_score": risk_score,
            "risk_level": "low" if risk_score < 30 else "medium" if risk_score < 60 else "high",
            "recommendations": recommendations,
            "risk_factors": risk_factors,
            "analysis_timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    # ============ SETTLEMENT ============
    
    async def settle_transaction(self, transaction_id: str, user_id: str) -> dict:
        """Finalize and seal transaction on blockchain"""
        transaction = await self.db.transactions.find_one({"id": transaction_id})
        if not transaction:
            raise ValueError("Transaction not found")
        
        # Verify all tasks completed
        incomplete = await self.db.transaction_tasks.count_documents({
            "transaction_id": transaction_id,
            "status": {"$nin": ["completed", "skipped"]}
        })
        
        if incomplete > 0:
            raise ValueError(f"{incomplete} tasks are not yet completed")
        
        # Compile settlement data
        tasks = await self.get_tasks(transaction_id)
        participants = await self.get_participants(transaction_id)
        messages = await self.get_messages(transaction_id, limit=1000)
        documents = await self.db.transaction_documents.find(
            {"transaction_id": transaction_id},
            {"_id": 0, "storage_url": 0}
        ).to_list(100)
        
        settlement_data = {
            "transaction_id": transaction_id,
            "transaction_name": transaction["name"],
            "transaction_type": transaction["transaction_type"],
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "participants": [{
                "email": p["email"],
                "role": p["role"],
                "joined_at": p.get("joined_at")
            } for p in participants],
            "tasks_completed": len([t for t in tasks if t["status"] == "completed"]),
            "documents_count": len(documents),
            "messages_count": len(messages)
        }
        
        # Create settlement hash
        settlement_json = json.dumps(settlement_data, sort_keys=True, default=str)
        settlement_hash = hashlib.sha256(settlement_json.encode()).hexdigest()
        
        # Seal on blockchain
        settlement_tx_id = None
        if self.hedera_service and transaction.get("hcs_topic_id"):
            try:
                result = await self.hedera_service.submit_message(
                    transaction["hcs_topic_id"],
                    {
                        "type": "TRANSACTION_SETTLED",
                        "settlement_hash": settlement_hash,
                        "settlement_data": settlement_data
                    }
                )
                settlement_tx_id = result.get("sequence_number")
            except Exception as e:
                logger.error(f"Failed to seal settlement on HCS: {e}")
        
        # Update transaction
        await self.db.transactions.update_one(
            {"id": transaction_id},
            {"$set": {
                "status": "completed",
                "settlement_hash": settlement_hash,
                "settlement_transaction_id": str(settlement_tx_id) if settlement_tx_id else None,
                "settlement_timestamp": datetime.now(timezone.utc),
                "actual_completion_date": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        return {
            "success": True,
            "transaction_id": transaction_id,
            "settlement_hash": settlement_hash,
            "settlement_transaction_id": settlement_tx_id,
            "hcs_topic_id": transaction.get("hcs_topic_id"),
            "explorer_url": transaction.get("hcs_explorer_url"),
            "settled_at": datetime.now(timezone.utc).isoformat()
        }


# ============ SYSTEM BLUEPRINTS ============

SYSTEM_BLUEPRINTS = [
    {
        "id": "bp_real_estate_closing",
        "name": "Real Estate Closing",
        "description": "Complete workflow for residential or commercial real estate transactions",
        "transaction_type": "real_estate_closing",
        "version": "1.0",
        "is_active": True,
        "is_system": True,
        "estimated_total_days": 45,
        "required_roles": ["buyer", "seller", "agent", "lender", "title_company", "notary"],
        "required_documents": [
            "Purchase Agreement",
            "Title Report",
            "Loan Documents",
            "Property Disclosure",
            "Closing Disclosure",
            "Deed"
        ],
        "steps": [
            {
                "id": "step_1",
                "name": "Purchase Agreement Execution",
                "description": "All parties sign the purchase agreement",
                "order": 1,
                "required_roles": ["buyer", "seller", "agent"],
                "dependencies": [],
                "estimated_duration_hours": 48,
                "requires_document": True,
                "requires_signature": True
            },
            {
                "id": "step_2",
                "name": "Title Search & Report",
                "description": "Title company performs title search and provides report",
                "order": 2,
                "required_roles": ["title_company"],
                "dependencies": ["step_1"],
                "estimated_duration_hours": 168,
                "requires_document": True
            },
            {
                "id": "step_3",
                "name": "Loan Application & Approval",
                "description": "Buyer submits loan application and receives approval",
                "order": 3,
                "required_roles": ["buyer", "lender"],
                "dependencies": ["step_1"],
                "estimated_duration_hours": 336,
                "requires_document": True
            },
            {
                "id": "step_4",
                "name": "Property Inspection",
                "description": "Professional property inspection completed",
                "order": 4,
                "required_roles": ["buyer"],
                "dependencies": ["step_1"],
                "estimated_duration_hours": 72,
                "requires_document": True
            },
            {
                "id": "step_5",
                "name": "Appraisal",
                "description": "Property appraisal for lender",
                "order": 5,
                "required_roles": ["lender"],
                "dependencies": ["step_3"],
                "estimated_duration_hours": 120,
                "requires_document": True
            },
            {
                "id": "step_6",
                "name": "Final Loan Approval",
                "description": "Lender provides final loan approval",
                "order": 6,
                "required_roles": ["lender"],
                "dependencies": ["step_3", "step_5"],
                "estimated_duration_hours": 72,
                "requires_document": True
            },
            {
                "id": "step_7",
                "name": "Closing Disclosure Review",
                "description": "All parties review closing disclosure (3-day waiting period)",
                "order": 7,
                "required_roles": ["buyer", "seller", "lender"],
                "dependencies": ["step_2", "step_6"],
                "estimated_duration_hours": 72,
                "requires_document": True,
                "requires_signature": True
            },
            {
                "id": "step_8",
                "name": "Final Walkthrough",
                "description": "Buyer performs final property walkthrough",
                "order": 8,
                "required_roles": ["buyer"],
                "dependencies": ["step_7"],
                "estimated_duration_hours": 24
            },
            {
                "id": "step_9",
                "name": "Closing Meeting",
                "description": "All parties meet for closing, sign final documents",
                "order": 9,
                "required_roles": ["buyer", "seller", "notary", "title_company"],
                "dependencies": ["step_7", "step_8"],
                "estimated_duration_hours": 4,
                "requires_document": True,
                "requires_signature": True,
                "requires_notarization": True
            },
            {
                "id": "step_10",
                "name": "Funds Transfer & Recording",
                "description": "Funds transferred, deed recorded with county",
                "order": 10,
                "required_roles": ["title_company", "lender"],
                "dependencies": ["step_9"],
                "estimated_duration_hours": 24,
                "requires_payment": True
            }
        ],
        "ai_enabled": True
    },
    {
        "id": "bp_business_contract",
        "name": "Business Contract",
        "description": "Multi-party business contract with legal review and execution",
        "transaction_type": "business_contract",
        "version": "1.0",
        "is_active": True,
        "is_system": True,
        "estimated_total_days": 14,
        "required_roles": ["owner", "signer", "attorney", "reviewer", "notary"],
        "required_documents": [
            "Draft Contract",
            "Legal Review Notes",
            "Final Contract",
            "Supporting Exhibits"
        ],
        "steps": [
            {
                "id": "step_1",
                "name": "Draft Contract Upload",
                "description": "Upload initial contract draft for review",
                "order": 1,
                "required_roles": ["owner"],
                "dependencies": [],
                "estimated_duration_hours": 24,
                "requires_document": True
            },
            {
                "id": "step_2",
                "name": "Legal Review",
                "description": "Attorney reviews contract and provides feedback",
                "order": 2,
                "required_roles": ["attorney"],
                "dependencies": ["step_1"],
                "estimated_duration_hours": 72,
                "requires_document": True
            },
            {
                "id": "step_3",
                "name": "Revisions & Negotiations",
                "description": "Parties negotiate and finalize terms",
                "order": 3,
                "required_roles": ["owner", "signer"],
                "dependencies": ["step_2"],
                "estimated_duration_hours": 120
            },
            {
                "id": "step_4",
                "name": "Final Contract Preparation",
                "description": "Prepare final contract with all agreed terms",
                "order": 4,
                "required_roles": ["owner", "attorney"],
                "dependencies": ["step_3"],
                "estimated_duration_hours": 24,
                "requires_document": True
            },
            {
                "id": "step_5",
                "name": "Signature Collection",
                "description": "All parties sign the final contract",
                "order": 5,
                "required_roles": ["owner", "signer"],
                "dependencies": ["step_4"],
                "estimated_duration_hours": 48,
                "requires_signature": True
            },
            {
                "id": "step_6",
                "name": "Notarization",
                "description": "Contract notarized for legal validity",
                "order": 6,
                "required_roles": ["notary"],
                "dependencies": ["step_5"],
                "estimated_duration_hours": 24,
                "requires_notarization": True
            }
        ],
        "ai_enabled": True
    },
    {
        "id": "bp_estate_settlement",
        "name": "Estate Settlement",
        "description": "Probate and estate settlement workflow",
        "transaction_type": "estate_settlement",
        "version": "1.0",
        "is_active": True,
        "is_system": True,
        "estimated_total_days": 180,
        "required_roles": ["executor", "beneficiary", "attorney", "notary"],
        "required_documents": [
            "Death Certificate",
            "Will",
            "Letters Testamentary",
            "Asset Inventory",
            "Creditor Claims",
            "Distribution Plan",
            "Final Accounting"
        ],
        "steps": [
            {
                "id": "step_1",
                "name": "File Probate Petition",
                "description": "Executor files petition to open probate",
                "order": 1,
                "required_roles": ["executor", "attorney"],
                "dependencies": [],
                "estimated_duration_hours": 72,
                "requires_document": True
            },
            {
                "id": "step_2",
                "name": "Obtain Letters Testamentary",
                "description": "Court issues letters testamentary to executor",
                "order": 2,
                "required_roles": ["executor"],
                "dependencies": ["step_1"],
                "estimated_duration_hours": 336,
                "requires_document": True
            },
            {
                "id": "step_3",
                "name": "Notify Beneficiaries & Creditors",
                "description": "Send required legal notices",
                "order": 3,
                "required_roles": ["executor"],
                "dependencies": ["step_2"],
                "estimated_duration_hours": 168,
                "requires_document": True
            },
            {
                "id": "step_4",
                "name": "Asset Inventory",
                "description": "Compile complete inventory of estate assets",
                "order": 4,
                "required_roles": ["executor"],
                "dependencies": ["step_2"],
                "estimated_duration_hours": 504,
                "requires_document": True
            },
            {
                "id": "step_5",
                "name": "Creditor Claims Period",
                "description": "Review and settle valid creditor claims",
                "order": 5,
                "required_roles": ["executor", "attorney"],
                "dependencies": ["step_3"],
                "estimated_duration_hours": 2160,
                "requires_document": True
            },
            {
                "id": "step_6",
                "name": "Tax Filings",
                "description": "File estate tax returns",
                "order": 6,
                "required_roles": ["executor"],
                "dependencies": ["step_4"],
                "estimated_duration_hours": 336,
                "requires_document": True
            },
            {
                "id": "step_7",
                "name": "Distribution Plan",
                "description": "Prepare asset distribution plan",
                "order": 7,
                "required_roles": ["executor", "attorney"],
                "dependencies": ["step_4", "step_5", "step_6"],
                "estimated_duration_hours": 168,
                "requires_document": True
            },
            {
                "id": "step_8",
                "name": "Beneficiary Approval",
                "description": "Beneficiaries review and approve distribution",
                "order": 8,
                "required_roles": ["beneficiary"],
                "dependencies": ["step_7"],
                "estimated_duration_hours": 336,
                "requires_signature": True
            },
            {
                "id": "step_9",
                "name": "Asset Distribution",
                "description": "Distribute assets to beneficiaries",
                "order": 9,
                "required_roles": ["executor"],
                "dependencies": ["step_8"],
                "estimated_duration_hours": 504,
                "requires_document": True,
                "requires_notarization": True
            },
            {
                "id": "step_10",
                "name": "Final Accounting & Closure",
                "description": "File final accounting and close estate",
                "order": 10,
                "required_roles": ["executor", "attorney"],
                "dependencies": ["step_9"],
                "estimated_duration_hours": 168,
                "requires_document": True
            }
        ],
        "ai_enabled": True
    },
    {
        "id": "bp_trust_settlement",
        "name": "Trust Settlement",
        "description": "Trust administration and settlement workflow",
        "transaction_type": "trust_settlement",
        "version": "1.0",
        "is_active": True,
        "is_system": True,
        "estimated_total_days": 90,
        "required_roles": ["executor", "beneficiary", "attorney", "notary"],
        "required_documents": [
            "Trust Document",
            "Death Certificate",
            "Asset Inventory",
            "Distribution Schedule"
        ],
        "steps": [
            {
                "id": "step_1",
                "name": "Trust Administration Initiation",
                "description": "Trustee initiates trust administration process",
                "order": 1,
                "required_roles": ["executor"],
                "dependencies": [],
                "estimated_duration_hours": 48,
                "requires_document": True
            },
            {
                "id": "step_2",
                "name": "Beneficiary Notification",
                "description": "Notify all beneficiaries of trust administration",
                "order": 2,
                "required_roles": ["executor"],
                "dependencies": ["step_1"],
                "estimated_duration_hours": 168,
                "requires_document": True
            },
            {
                "id": "step_3",
                "name": "Asset Valuation",
                "description": "Value all trust assets",
                "order": 3,
                "required_roles": ["executor"],
                "dependencies": ["step_1"],
                "estimated_duration_hours": 336,
                "requires_document": True
            },
            {
                "id": "step_4",
                "name": "Debt Settlement",
                "description": "Pay outstanding debts and obligations",
                "order": 4,
                "required_roles": ["executor"],
                "dependencies": ["step_3"],
                "estimated_duration_hours": 336,
                "requires_document": True,
                "requires_payment": True
            },
            {
                "id": "step_5",
                "name": "Distribution Schedule",
                "description": "Prepare distribution schedule per trust terms",
                "order": 5,
                "required_roles": ["executor", "attorney"],
                "dependencies": ["step_3", "step_4"],
                "estimated_duration_hours": 168,
                "requires_document": True
            },
            {
                "id": "step_6",
                "name": "Beneficiary Acknowledgment",
                "description": "Beneficiaries acknowledge distribution terms",
                "order": 6,
                "required_roles": ["beneficiary"],
                "dependencies": ["step_5"],
                "estimated_duration_hours": 168,
                "requires_signature": True
            },
            {
                "id": "step_7",
                "name": "Asset Distribution",
                "description": "Transfer assets to beneficiaries",
                "order": 7,
                "required_roles": ["executor"],
                "dependencies": ["step_6"],
                "estimated_duration_hours": 336,
                "requires_document": True,
                "requires_notarization": True
            },
            {
                "id": "step_8",
                "name": "Trust Termination",
                "description": "Formally close the trust",
                "order": 8,
                "required_roles": ["executor", "attorney"],
                "dependencies": ["step_7"],
                "estimated_duration_hours": 72,
                "requires_document": True
            }
        ],
        "ai_enabled": True
    }
]
