"""
Role-Based Access Control (RBAC) Routes
Manages custom roles, permissions, and role assignments within organizations.
"""

from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid
import logging

from routes.auth_routes import get_current_user
from routes.org_activity_routes import log_org_activity

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/organizations", tags=["rbac"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


# --- Permission Definitions ---

ALL_PERMISSIONS = [
    {"key": "documents:view", "label": "View Documents", "category": "Documents"},
    {"key": "documents:create", "label": "Create Documents", "category": "Documents"},
    {"key": "documents:edit", "label": "Edit Documents", "category": "Documents"},
    {"key": "documents:delete", "label": "Delete Documents", "category": "Documents"},
    {"key": "documents:seal", "label": "Seal Documents", "category": "Documents"},
    {"key": "vault:view", "label": "View Vault", "category": "Vault"},
    {"key": "vault:upload", "label": "Upload to Vault", "category": "Vault"},
    {"key": "vault:delete", "label": "Delete from Vault", "category": "Vault"},
    {"key": "members:view", "label": "View Members", "category": "Members"},
    {"key": "members:invite", "label": "Invite Members", "category": "Members"},
    {"key": "members:remove", "label": "Remove Members", "category": "Members"},
    {"key": "members:manage_roles", "label": "Manage Roles", "category": "Members"},
    {"key": "templates:view", "label": "View Templates", "category": "Templates"},
    {"key": "templates:create", "label": "Create Templates", "category": "Templates"},
    {"key": "templates:delete", "label": "Delete Templates", "category": "Templates"},
    {"key": "approvals:view", "label": "View Approvals", "category": "Approvals"},
    {"key": "approvals:manage", "label": "Manage Approvals", "category": "Approvals"},
    {"key": "notarization:request", "label": "Request Notarization", "category": "Notarization"},
    {"key": "notarization:review", "label": "Review Notarization", "category": "Notarization"},
    {"key": "org:settings", "label": "Organization Settings", "category": "Organization"},
    {"key": "org:sso", "label": "Configure SSO", "category": "Organization"},
    {"key": "org:billing", "label": "Manage Billing", "category": "Organization"},
    {"key": "org:branding", "label": "Custom Branding", "category": "Organization"},
]

PERMISSION_KEYS = [p["key"] for p in ALL_PERMISSIONS]

# System default roles that are auto-created
SYSTEM_ROLES = {
    "org_admin": {
        "name": "Organization Admin",
        "description": "Full access to all organization features",
        "permissions": PERMISSION_KEYS,  # all permissions
    },
    "editor": {
        "name": "Editor",
        "description": "Can create, edit, and manage documents",
        "permissions": [
            "documents:view", "documents:create", "documents:edit", "documents:seal",
            "vault:view", "vault:upload",
            "members:view",
            "templates:view", "templates:create",
            "approvals:view",
            "notarization:request",
        ],
    },
    "viewer": {
        "name": "Viewer",
        "description": "Read-only access to documents and vault",
        "permissions": [
            "documents:view",
            "vault:view",
            "members:view",
            "templates:view",
            "approvals:view",
        ],
    },
}


# --- Models ---

class CreateRoleRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    permissions: List[str] = []

class UpdateRoleRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None

class AssignRoleRequest(BaseModel):
    role_id: str


# --- Helpers ---

async def _get_membership(org_id: str, user_id: str):
    return await db.org_members.find_one(
        {"org_id": org_id, "user_id": user_id, "status": "active"},
        {"_id": 0}
    )

async def _require_org_admin(org_id: str, user_id: str):
    membership = await _get_membership(org_id, user_id)
    if not membership or membership["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return membership

async def _require_role_management(org_id: str, user_id: str):
    """Check if user has permission to manage roles (owner/admin or has members:manage_roles)."""
    membership = await _get_membership(org_id, user_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    if membership["role"] in ("owner", "admin"):
        return membership
    # Check custom role permissions
    custom_role_id = membership.get("custom_role_id")
    if custom_role_id:
        role = await db.rbac_roles.find_one({"id": custom_role_id, "org_id": org_id}, {"_id": 0})
        if role and "members:manage_roles" in role.get("permissions", []):
            return membership
    raise HTTPException(status_code=403, detail="You don't have permission to manage roles")


async def ensure_system_roles(org_id: str):
    """Ensure system default roles exist for an org."""
    for system_key, role_def in SYSTEM_ROLES.items():
        existing = await db.rbac_roles.find_one({"org_id": org_id, "system_key": system_key})
        if not existing:
            now = datetime.now(timezone.utc).isoformat()
            await db.rbac_roles.insert_one({
                "id": str(uuid.uuid4()),
                "org_id": org_id,
                "system_key": system_key,
                "name": role_def["name"],
                "description": role_def["description"],
                "permissions": role_def["permissions"],
                "is_system": True,
                "created_at": now,
                "updated_at": now,
            })


# --- Routes ---

@router.get("/{org_id}/permissions")
async def list_permissions(org_id: str, current_user: dict = Depends(get_current_user)):
    """List all available permissions."""
    membership = await _get_membership(org_id, current_user.id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    # Group by category
    categories = {}
    for p in ALL_PERMISSIONS:
        cat = p["category"]
        if cat not in categories:
            categories[cat] = []
        categories[cat].append({"key": p["key"], "label": p["label"]})
    return {"permissions": ALL_PERMISSIONS, "categories": categories}


@router.get("/{org_id}/roles")
async def list_roles(org_id: str, current_user: dict = Depends(get_current_user)):
    """List all roles for an organization."""
    membership = await _get_membership(org_id, current_user.id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    await ensure_system_roles(org_id)

    roles = await db.rbac_roles.find(
        {"org_id": org_id}, {"_id": 0}
    ).sort("is_system", -1).to_list(100)

    # Count members per role
    for role in roles:
        count = await db.org_members.count_documents({
            "org_id": org_id, "custom_role_id": role["id"], "status": "active"
        })
        role["member_count"] = count

    return {"roles": roles}


@router.post("/{org_id}/roles")
async def create_role(org_id: str, body: CreateRoleRequest, current_user: dict = Depends(get_current_user)):
    """Create a custom role."""
    await _require_role_management(org_id, current_user.id)

    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Role name is required")

    # Validate permissions
    invalid = [p for p in body.permissions if p not in PERMISSION_KEYS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid permissions: {', '.join(invalid)}")

    # Check name uniqueness within org
    existing = await db.rbac_roles.find_one({"org_id": org_id, "name": body.name.strip()})
    if existing:
        raise HTTPException(status_code=400, detail="A role with this name already exists")

    now = datetime.now(timezone.utc).isoformat()
    role = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "system_key": None,
        "name": body.name.strip(),
        "description": body.description or "",
        "permissions": body.permissions,
        "is_system": False,
        "created_by": current_user.id,
        "created_at": now,
        "updated_at": now,
    }
    await db.rbac_roles.insert_one(role)
    role.pop("_id", None)
    role["member_count"] = 0
    return role


@router.put("/{org_id}/roles/{role_id}")
async def update_role(org_id: str, role_id: str, body: UpdateRoleRequest, current_user: dict = Depends(get_current_user)):
    """Update a role's name, description, or permissions."""
    await _require_role_management(org_id, current_user.id)

    role = await db.rbac_roles.find_one({"id": role_id, "org_id": org_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.name is not None:
        # Check uniqueness
        dup = await db.rbac_roles.find_one({"org_id": org_id, "name": body.name.strip(), "id": {"$ne": role_id}})
        if dup:
            raise HTTPException(status_code=400, detail="A role with this name already exists")
        update["name"] = body.name.strip()
    if body.description is not None:
        update["description"] = body.description
    if body.permissions is not None:
        invalid = [p for p in body.permissions if p not in PERMISSION_KEYS]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Invalid permissions: {', '.join(invalid)}")
        update["permissions"] = body.permissions

    await db.rbac_roles.update_one({"id": role_id}, {"$set": update})

    updated = await db.rbac_roles.find_one({"id": role_id}, {"_id": 0})
    count = await db.org_members.count_documents({"org_id": org_id, "custom_role_id": role_id, "status": "active"})
    updated["member_count"] = count
    return updated


@router.delete("/{org_id}/roles/{role_id}")
async def delete_role(org_id: str, role_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a custom role. System roles cannot be deleted."""
    await _require_role_management(org_id, current_user.id)

    role = await db.rbac_roles.find_one({"id": role_id, "org_id": org_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if role.get("is_system"):
        raise HTTPException(status_code=400, detail="System roles cannot be deleted")

    # Unassign from any members
    await db.org_members.update_many(
        {"org_id": org_id, "custom_role_id": role_id},
        {"$unset": {"custom_role_id": ""}}
    )

    await db.rbac_roles.delete_one({"id": role_id})
    return {"message": "Role deleted", "unassigned_members": True}


@router.put("/{org_id}/members/{member_id}/custom-role")
async def assign_custom_role(
    org_id: str, member_id: str, body: AssignRoleRequest,
    current_user: dict = Depends(get_current_user)
):
    """Assign a custom RBAC role to a member."""
    await _require_role_management(org_id, current_user.id)

    member = await db.org_members.find_one({"id": member_id, "org_id": org_id, "status": "active"})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if member["role"] == "owner":
        raise HTTPException(status_code=400, detail="Cannot assign custom roles to the owner")

    # Verify role exists
    if body.role_id:
        role = await db.rbac_roles.find_one({"id": body.role_id, "org_id": org_id})
        if not role:
            raise HTTPException(status_code=404, detail="Role not found")
        await db.org_members.update_one(
            {"id": member_id},
            {"$set": {"custom_role_id": body.role_id}}
        )
        return {"message": f"Role '{role['name']}' assigned to member"}
    else:
        await db.org_members.update_one(
            {"id": member_id},
            {"$unset": {"custom_role_id": ""}}
        )
        return {"message": "Custom role removed from member"}


@router.delete("/{org_id}/members/{member_id}/custom-role")
async def remove_custom_role(
    org_id: str, member_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove custom role from a member."""
    await _require_role_management(org_id, current_user.id)

    member = await db.org_members.find_one({"id": member_id, "org_id": org_id, "status": "active"})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    await db.org_members.update_one(
        {"id": member_id},
        {"$unset": {"custom_role_id": ""}}
    )
    return {"message": "Custom role removed"}


@router.get("/{org_id}/members/{member_id}/effective-permissions")
async def get_effective_permissions(
    org_id: str, member_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the effective permissions for a member based on their role."""
    membership = await _get_membership(org_id, current_user.id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    member = await db.org_members.find_one({"id": member_id, "org_id": org_id, "status": "active"}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Owner and admin have all permissions
    if member["role"] in ("owner", "admin"):
        return {"permissions": PERMISSION_KEYS, "source": member["role"]}

    # Check custom role
    custom_role_id = member.get("custom_role_id")
    if custom_role_id:
        role = await db.rbac_roles.find_one({"id": custom_role_id, "org_id": org_id}, {"_id": 0})
        if role:
            return {"permissions": role.get("permissions", []), "source": role["name"]}

    # Default member permissions
    return {"permissions": ["documents:view", "vault:view", "members:view", "templates:view"], "source": "default_member"}



@router.get("/{org_id}/my-permissions")
async def get_my_permissions(org_id: str, current_user: dict = Depends(get_current_user)):
    """Get the current user's effective permissions for this organization."""
    membership = await _get_membership(org_id, current_user.id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    base_role = membership["role"]

    # Owner and admin have all permissions
    if base_role in ("owner", "admin"):
        return {
            "permissions": PERMISSION_KEYS,
            "base_role": base_role,
            "custom_role": None,
            "source": base_role,
        }

    # Check custom role
    custom_role_id = membership.get("custom_role_id")
    custom_role_name = None
    if custom_role_id:
        role = await db.rbac_roles.find_one({"id": custom_role_id, "org_id": org_id}, {"_id": 0})
        if role:
            custom_role_name = role["name"]
            return {
                "permissions": role.get("permissions", []),
                "base_role": base_role,
                "custom_role": custom_role_name,
                "source": custom_role_name,
            }

    # Default member permissions
    return {
        "permissions": ["documents:view", "vault:view", "members:view", "templates:view"],
        "base_role": base_role,
        "custom_role": None,
        "source": "default_member",
    }
