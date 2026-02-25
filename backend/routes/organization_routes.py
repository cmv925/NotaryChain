"""
Organization & Multi-tenancy Routes
Manages organizations, teams, memberships, and SSO configuration.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel, EmailStr
import uuid
import secrets
import logging

from routes.auth_routes import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/organizations", tags=["organizations"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


# --- Models ---

class CreateOrgRequest(BaseModel):
    name: str
    slug: str
    description: Optional[str] = ""

class UpdateOrgRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class InviteMemberRequest(BaseModel):
    email: EmailStr
    role: str = "member"  # owner, admin, member

class UpdateMemberRoleRequest(BaseModel):
    role: str

class SSOConfigRequest(BaseModel):
    sso_enabled: bool = False
    sso_provider: Optional[str] = None  # saml, oidc
    sso_issuer_url: Optional[str] = None
    sso_client_id: Optional[str] = None
    sso_client_secret: Optional[str] = None
    sso_metadata_url: Optional[str] = None
    sso_allowed_domains: List[str] = []


# --- Helpers ---

def _org_projection():
    return {"_id": 0}

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

async def _require_org_owner(org_id: str, user_id: str):
    membership = await _get_membership(org_id, user_id)
    if not membership or membership["role"] != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")
    return membership


# --- Organization CRUD ---

@router.post("/")
async def create_organization(body: CreateOrgRequest, current_user: dict = Depends(get_current_user)):
    """Create a new organization."""
    # Check slug uniqueness
    existing = await db.organizations.find_one({"slug": body.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Organization slug already taken")

    org_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    org = {
        "id": org_id,
        "name": body.name,
        "slug": body.slug,
        "description": body.description or "",
        "owner_id": current_user.id,
        "created_at": now,
        "updated_at": now,
        "member_count": 1,
        "plan": "free",
        "sso_enabled": False,
        "sso_config": {},
    }
    await db.organizations.insert_one(org)

    # Add creator as owner member
    member = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "user_id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": "owner",
        "status": "active",
        "joined_at": now,
    }
    await db.org_members.insert_one(member)

    # Update user's org list
    await db.users.update_one(
        {"email": current_user.email},
        {"$addToSet": {"organizations": {"org_id": org_id, "role": "owner"}}}
    )

    org.pop("_id", None)
    return org


@router.get("/")
async def list_my_organizations(current_user: dict = Depends(get_current_user)):
    """List organizations the current user belongs to."""
    memberships = await db.org_members.find(
        {"user_id": current_user.id, "status": "active"}, {"_id": 0}
    ).to_list(50)

    org_ids = [m["org_id"] for m in memberships]
    if not org_ids:
        return {"organizations": []}

    orgs = await db.organizations.find(
        {"id": {"$in": org_ids}}, {"_id": 0}
    ).to_list(50)

    # Enrich with user's role
    role_map = {m["org_id"]: m["role"] for m in memberships}
    for org in orgs:
        org["my_role"] = role_map.get(org["id"], "member")

    return {"organizations": orgs}


@router.get("/{org_id}")
async def get_organization(org_id: str, current_user: dict = Depends(get_current_user)):
    """Get organization details (members only)."""
    membership = await _get_membership(org_id, current_user.id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    org["my_role"] = membership["role"]
    return org


@router.put("/{org_id}")
async def update_organization(org_id: str, body: UpdateOrgRequest, current_user: dict = Depends(get_current_user)):
    """Update organization settings (admin/owner only)."""
    await _require_org_admin(org_id, current_user.id)

    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.name is not None:
        update["name"] = body.name
    if body.description is not None:
        update["description"] = body.description

    await db.organizations.update_one({"id": org_id}, {"$set": update})
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    return org


@router.delete("/{org_id}")
async def delete_organization(org_id: str, current_user: dict = Depends(get_current_user)):
    """Delete organization (owner only)."""
    await _require_org_owner(org_id, current_user.id)

    await db.organizations.delete_one({"id": org_id})
    await db.org_members.delete_many({"org_id": org_id})
    await db.org_invites.delete_many({"org_id": org_id})

    # Remove from all users' org lists
    await db.users.update_many(
        {},
        {"$pull": {"organizations": {"org_id": org_id}}}
    )

    return {"message": "Organization deleted"}


# --- Member Management ---

@router.get("/{org_id}/members")
async def list_members(org_id: str, current_user: dict = Depends(get_current_user)):
    """List organization members."""
    membership = await _get_membership(org_id, current_user.id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    members = await db.org_members.find(
        {"org_id": org_id, "status": "active"}, {"_id": 0}
    ).to_list(200)

    return {"members": members}


@router.post("/{org_id}/invite")
async def invite_member(org_id: str, body: InviteMemberRequest, current_user: dict = Depends(get_current_user)):
    """Invite a user to the organization (admin/owner only)."""
    await _require_org_admin(org_id, current_user.id)

    if body.role not in ("admin", "member"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'member'")

    # Check if already a member
    existing = await db.org_members.find_one(
        {"org_id": org_id, "email": body.email, "status": "active"}
    )
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member")

    # Check for pending invite
    pending = await db.org_invites.find_one(
        {"org_id": org_id, "email": body.email, "status": "pending"}
    )
    if pending:
        raise HTTPException(status_code=400, detail="Invite already pending for this email")

    org = await db.organizations.find_one({"id": org_id}, {"_id": 0, "name": 1})
    now = datetime.now(timezone.utc).isoformat()
    invite_token = secrets.token_urlsafe(32)

    invite = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "org_name": org.get("name", ""),
        "email": body.email,
        "role": body.role,
        "invited_by": current_user.id,
        "invited_by_name": current_user.full_name,
        "token": invite_token,
        "status": "pending",
        "created_at": now,
    }
    await db.org_invites.insert_one(invite)

    invite.pop("_id", None)
    return invite


@router.get("/{org_id}/invites")
async def list_invites(org_id: str, current_user: dict = Depends(get_current_user)):
    """List pending invites (admin/owner only)."""
    await _require_org_admin(org_id, current_user.id)
    invites = await db.org_invites.find(
        {"org_id": org_id, "status": "pending"}, {"_id": 0}
    ).to_list(100)
    return {"invites": invites}


@router.post("/accept-invite/{invite_token}")
async def accept_invite(invite_token: str, current_user: dict = Depends(get_current_user)):
    """Accept an organization invite."""
    invite = await db.org_invites.find_one({"token": invite_token, "status": "pending"})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found or expired")

    if invite["email"] != current_user.email:
        raise HTTPException(status_code=403, detail="This invite is for a different email")

    now = datetime.now(timezone.utc).isoformat()

    # Add as member
    member = {
        "id": str(uuid.uuid4()),
        "org_id": invite["org_id"],
        "user_id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": invite["role"],
        "status": "active",
        "joined_at": now,
    }
    await db.org_members.insert_one(member)

    # Update invite status
    await db.org_invites.update_one(
        {"token": invite_token},
        {"$set": {"status": "accepted", "accepted_at": now}}
    )

    # Update org member count
    await db.organizations.update_one(
        {"id": invite["org_id"]},
        {"$inc": {"member_count": 1}}
    )

    # Update user's org list
    await db.users.update_one(
        {"email": current_user.email},
        {"$addToSet": {"organizations": {"org_id": invite["org_id"], "role": invite["role"]}}}
    )

    return {"message": "Successfully joined organization", "org_id": invite["org_id"]}


@router.put("/{org_id}/members/{member_id}/role")
async def update_member_role(
    org_id: str, member_id: str, body: UpdateMemberRoleRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a member's role (owner only)."""
    await _require_org_owner(org_id, current_user.id)

    if body.role not in ("admin", "member"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'member'")

    member = await db.org_members.find_one({"id": member_id, "org_id": org_id})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if member["role"] == "owner":
        raise HTTPException(status_code=400, detail="Cannot change owner role")

    await db.org_members.update_one(
        {"id": member_id},
        {"$set": {"role": body.role}}
    )

    # Update in user's org list
    await db.users.update_one(
        {"email": member["email"], "organizations.org_id": org_id},
        {"$set": {"organizations.$.role": body.role}}
    )

    return {"message": f"Role updated to {body.role}"}


@router.delete("/{org_id}/members/{member_id}")
async def remove_member(org_id: str, member_id: str, current_user: dict = Depends(get_current_user)):
    """Remove a member from the organization (admin/owner, or self-leave)."""
    member = await db.org_members.find_one({"id": member_id, "org_id": org_id})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Self-leave or admin action
    is_self = member["user_id"] == current_user.id
    if not is_self:
        await _require_org_admin(org_id, current_user.id)

    if member["role"] == "owner":
        raise HTTPException(status_code=400, detail="Owner cannot be removed. Transfer ownership first.")

    await db.org_members.update_one(
        {"id": member_id},
        {"$set": {"status": "removed"}}
    )

    await db.organizations.update_one(
        {"id": org_id},
        {"$inc": {"member_count": -1}}
    )

    await db.users.update_one(
        {"email": member["email"]},
        {"$pull": {"organizations": {"org_id": org_id}}}
    )

    return {"message": "Member removed"}


@router.delete("/{org_id}/invites/{invite_id}")
async def cancel_invite(org_id: str, invite_id: str, current_user: dict = Depends(get_current_user)):
    """Cancel a pending invite (admin/owner only)."""
    await _require_org_admin(org_id, current_user.id)
    result = await db.org_invites.delete_one({"id": invite_id, "org_id": org_id, "status": "pending"})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invite not found")
    return {"message": "Invite cancelled"}


# --- SSO Configuration ---

@router.get("/{org_id}/sso")
async def get_sso_config(org_id: str, current_user: dict = Depends(get_current_user)):
    """Get SSO configuration (admin/owner only)."""
    await _require_org_admin(org_id, current_user.id)
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0, "sso_enabled": 1, "sso_config": 1})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    config = org.get("sso_config", {})
    # Mask secrets
    if config.get("sso_client_secret"):
        config["sso_client_secret"] = "***" + config["sso_client_secret"][-4:]

    return {"sso_enabled": org.get("sso_enabled", False), "sso_config": config}


@router.put("/{org_id}/sso")
async def update_sso_config(org_id: str, body: SSOConfigRequest, current_user: dict = Depends(get_current_user)):
    """Update SSO configuration (owner only)."""
    await _require_org_owner(org_id, current_user.id)

    sso_config = {
        "sso_provider": body.sso_provider,
        "sso_issuer_url": body.sso_issuer_url,
        "sso_client_id": body.sso_client_id,
        "sso_metadata_url": body.sso_metadata_url,
        "sso_allowed_domains": body.sso_allowed_domains,
    }
    # Only update secret if a new one is provided
    if body.sso_client_secret and not body.sso_client_secret.startswith("***"):
        sso_config["sso_client_secret"] = body.sso_client_secret

    await db.organizations.update_one(
        {"id": org_id},
        {"$set": {
            "sso_enabled": body.sso_enabled,
            "sso_config": sso_config,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    return {"message": "SSO configuration updated"}


# --- Pending Invites for Current User ---

@router.get("/my/invites")
async def my_pending_invites(current_user: dict = Depends(get_current_user)):
    """List pending invites for the current user."""
    invites = await db.org_invites.find(
        {"email": current_user.email, "status": "pending"}, {"_id": 0}
    ).to_list(50)
    return {"invites": invites}
