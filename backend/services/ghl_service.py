"""
GoHighLevel (GHL) CRM Integration Service
One-way sync: NotaryChain → GHL sub-account using a Location-level Private Integration Token (PIT).

Scope: always-on, single-tenant. All NotaryChain-wide events push into one ClayTelligence location.
"""

import os
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

import httpx
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

GHL_BASE_URL = "https://services.leadconnectorhq.com"
GHL_API_VERSION = os.environ.get("GHL_API_VERSION", "2021-07-28")
PIT_TOKEN = os.environ.get("GHL_PIT_TOKEN", "").strip()
LOCATION_ID = os.environ.get("GHL_LOCATION_ID", "").strip()
PIPELINE_ID = os.environ.get("GHL_PIPELINE_ID", "").strip()
STAGE_SIGNUP = os.environ.get("GHL_PIPELINE_STAGE_SIGNUP", "").strip()
STAGE_UPGRADED = os.environ.get("GHL_PIPELINE_STAGE_UPGRADED", "").strip()


def is_configured() -> bool:
    return bool(PIT_TOKEN and LOCATION_ID)


class GHLService:
    """Async client for GoHighLevel v2 API."""

    def __init__(self) -> None:
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {PIT_TOKEN}",
            "Version": GHL_API_VERSION,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(base_url=GHL_BASE_URL, timeout=20.0)
        return self._client

    async def _request(self, method: str, path: str, *, params: Optional[dict] = None,
                       json_body: Optional[dict] = None, retries: int = 3) -> Dict[str, Any]:
        """Issue an authenticated request with exponential backoff on 429/5xx."""
        if not is_configured():
            raise RuntimeError("GHL is not configured: missing GHL_PIT_TOKEN or GHL_LOCATION_ID")

        client = await self._get_client()
        attempt = 0
        last_exc: Optional[Exception] = None
        while attempt < retries:
            try:
                resp = await client.request(method, path, headers=self.headers,
                                            params=params, json=json_body)
                if resp.status_code == 429 or (500 <= resp.status_code < 600):
                    wait = 2 ** attempt
                    logger.warning(f"GHL {method} {path} returned {resp.status_code}, retrying in {wait}s")
                    await asyncio.sleep(wait)
                    attempt += 1
                    continue
                if resp.status_code >= 400:
                    logger.error(f"GHL {method} {path} failed: {resp.status_code} {resp.text[:400]}")
                    resp.raise_for_status()
                return resp.json() if resp.content else {}
            except httpx.RequestError as e:
                last_exc = e
                wait = 2 ** attempt
                logger.warning(f"GHL {method} {path} network error: {e}, retry in {wait}s")
                await asyncio.sleep(wait)
                attempt += 1
        raise RuntimeError(f"GHL {method} {path} exhausted retries: {last_exc}")

    # ────────── CONTACTS ──────────

    async def upsert_contact(self, *, email: str, first_name: str = "", last_name: str = "",
                             phone: Optional[str] = None,
                             tags: Optional[List[str]] = None,
                             source: str = "NotaryChain") -> Dict[str, Any]:
        """Upsert a contact keyed on email. Returns the contact dict (with `id`)."""
        payload: Dict[str, Any] = {
            "locationId": LOCATION_ID,
            "email": email,
            "source": source,
        }
        if first_name:
            payload["firstName"] = first_name
        if last_name:
            payload["lastName"] = last_name
        if phone:
            payload["phone"] = phone
        if tags:
            payload["tags"] = tags
        data = await self._request("POST", "/contacts/upsert", json_body=payload)
        # GHL returns {"contact": {...}, "new": bool, "succeded": bool}
        contact = data.get("contact") or data
        return contact

    async def add_tags(self, contact_id: str, tags: List[str]) -> Dict[str, Any]:
        return await self._request("POST", f"/contacts/{contact_id}/tags",
                                   json_body={"tags": tags})

    async def add_note(self, contact_id: str, body: str) -> Dict[str, Any]:
        return await self._request("POST", f"/contacts/{contact_id}/notes",
                                   json_body={"body": body, "userId": None})

    # ────────── OPPORTUNITIES ──────────

    async def create_opportunity(self, *, contact_id: str, title: str,
                                 pipeline_id: Optional[str] = None,
                                 stage_id: Optional[str] = None,
                                 status: str = "open",
                                 monetary_value: Optional[float] = None) -> Dict[str, Any]:
        """Create an opportunity in a pipeline stage and associate it with a contact."""
        pid = pipeline_id or PIPELINE_ID
        sid = stage_id or STAGE_SIGNUP
        if not pid:
            raise RuntimeError("GHL_PIPELINE_ID not configured")
        payload: Dict[str, Any] = {
            "locationId": LOCATION_ID,
            "pipelineId": pid,
            "pipelineStageId": sid,
            "name": title,
            "status": status,
            "contactId": contact_id,
        }
        if monetary_value is not None:
            payload["monetaryValue"] = monetary_value
        return await self._request("POST", "/opportunities/", json_body=payload)

    async def move_opportunity_stage(self, opportunity_id: str, stage_id: str,
                                     status: str = "open") -> Dict[str, Any]:
        return await self._request("PUT", f"/opportunities/{opportunity_id}",
                                   json_body={"pipelineStageId": stage_id, "status": status})

    # ────────── DIAGNOSTICS ──────────

    async def ping(self) -> Dict[str, Any]:
        """Verify PIT + location by fetching the location object."""
        data = await self._request("GET", f"/locations/{LOCATION_ID}")
        loc = data.get("location", {})
        return {
            "ok": True,
            "location_id": loc.get("id"),
            "location_name": loc.get("name"),
            "company_id": loc.get("companyId"),
            "timezone": loc.get("timezone"),
        }

    async def list_pipelines(self) -> List[Dict[str, Any]]:
        data = await self._request("GET", "/opportunities/pipelines",
                                   params={"locationId": LOCATION_ID})
        return data.get("pipelines", [])

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()


# Singleton
ghl_service = GHLService()


# ════════════════════════════════════════════════════════
#  HIGH-LEVEL SYNC HELPERS (fire-and-forget, never block)
# ════════════════════════════════════════════════════════

async def _safe(coro):
    """Run an async call and swallow errors — CRM sync must never break core flows."""
    try:
        return await coro
    except Exception as e:
        logger.warning(f"GHL sync skipped: {e}")
        return None


async def sync_user_signup(*, email: str, full_name: str = "", role: str = "user",
                           subscription_tier: str = "starter") -> Optional[str]:
    """Upsert a NotaryChain signup into GHL + place into the NotaryChain pipeline."""
    if not is_configured():
        return None
    first, _, last = (full_name or "").partition(" ")
    tags = [
        "notarychain-signup",
        f"role-{role}",
        f"tier-{subscription_tier}",
    ]
    contact = await _safe(ghl_service.upsert_contact(
        email=email, first_name=first or email.split("@")[0], last_name=last,
        tags=tags, source="NotaryChain Signup",
    ))
    if not contact:
        return None
    cid = contact.get("id")
    if not cid:
        return None
    # Create an opportunity in "Form Completed" stage
    await _safe(ghl_service.create_opportunity(
        contact_id=cid,
        title=f"NotaryChain Signup — {email}",
        stage_id=STAGE_SIGNUP,
        status="open",
    ))
    await _safe(ghl_service.add_note(cid, _event_note("signup", {
        "email": email, "role": role, "tier": subscription_tier,
    })))
    return cid


async def sync_ceremony_completed(*, email: str, request_id: str,
                                  document_type: str = "",
                                  seal_hash: str = "") -> None:
    if not is_configured():
        return
    contact = await _safe(ghl_service.upsert_contact(email=email, tags=["ceremony-completed"]))
    if contact and contact.get("id"):
        await _safe(ghl_service.add_note(contact["id"], _event_note("ceremony_completed", {
            "request_id": request_id, "document_type": document_type,
            "seal_hash": seal_hash[:32] if seal_hash else None,
        })))


async def sync_escrow_settled(*, email: str, escrow_id: str, amount: float,
                              settlement_hash: str = "") -> None:
    if not is_configured():
        return
    contact = await _safe(ghl_service.upsert_contact(email=email, tags=["escrow-settled"]))
    if contact and contact.get("id"):
        await _safe(ghl_service.add_note(contact["id"], _event_note("escrow_settled", {
            "escrow_id": escrow_id, "amount_usd": amount,
            "settlement_hash": settlement_hash[:32] if settlement_hash else None,
        })))


async def sync_hts_token_minted(*, email: str, token_id: str, amount: Optional[float] = None,
                                purpose: str = "") -> None:
    if not is_configured():
        return
    contact = await _safe(ghl_service.upsert_contact(email=email, tags=["hts-minted"]))
    if contact and contact.get("id"):
        await _safe(ghl_service.add_note(contact["id"], _event_note("hts_token_minted", {
            "token_id": token_id, "amount": amount, "purpose": purpose,
        })))


async def sync_subscription_upgraded(*, email: str, new_tier: str,
                                     old_tier: str = "starter",
                                     monetary_value: Optional[float] = None) -> None:
    if not is_configured():
        return
    contact = await _safe(ghl_service.upsert_contact(
        email=email,
        tags=["subscription-upgraded", f"tier-{new_tier}"],
    ))
    if not contact or not contact.get("id"):
        return
    cid = contact["id"]
    await _safe(ghl_service.add_note(cid, _event_note("subscription_upgraded", {
        "old_tier": old_tier, "new_tier": new_tier, "monetary_value": monetary_value,
    })))
    # Move deeper in pipeline for upgrades
    await _safe(ghl_service.create_opportunity(
        contact_id=cid,
        title=f"Subscription Upgrade → {new_tier.title()} ({email})",
        stage_id=STAGE_UPGRADED,
        status="won",
        monetary_value=monetary_value,
    ))


def _event_note(event_type: str, details: dict) -> str:
    ts = datetime.now(timezone.utc).isoformat()
    lines = [f"[NotaryChain · {event_type}]", f"timestamp: {ts}"]
    for k, v in details.items():
        if v is not None and v != "":
            lines.append(f"{k}: {v}")
    return "\n".join(lines)
