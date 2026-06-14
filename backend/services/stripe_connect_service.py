"""
Stripe Connect helper for the Template Marketplace creator royalty payouts.

Uses the direct `stripe` SDK (the emergentintegrations Checkout library does not
cover Connect). Every function degrades gracefully: if Connect is not enabled on
the platform account, or the creator hasn't onboarded, callers fall back to
recording a *pending* payout rather than failing the sale.

Model: "separate charges and transfers" — the platform collects the full price via
Checkout, then transfers the royalty to the creator's connected Express account.
"""
import os
import logging
import asyncio

logger = logging.getLogger(__name__)


def is_configured() -> bool:
    return bool(os.environ.get("STRIPE_API_KEY"))


def _stripe():
    import stripe
    stripe.api_key = os.environ.get("STRIPE_API_KEY")
    return stripe


async def _run(fn, *args, **kwargs):
    """Run the (synchronous) stripe SDK call in a threadpool to avoid blocking."""
    return await asyncio.to_thread(fn, *args, **kwargs)


async def create_express_account(email: str) -> dict:
    """Create a Stripe Connect Express account for a creator. Returns {account_id} or {error}."""
    try:
        s = _stripe()
        acct = await _run(
            s.Account.create,
            type="express",
            email=email,
            capabilities={"transfers": {"requested": True}},
        )
        return {"account_id": acct.id}
    except Exception as e:
        logger.warning("[connect] create_express_account failed: %s", e)
        return {"error": str(e)[:200]}


async def onboarding_link(account_id: str, refresh_url: str, return_url: str) -> dict:
    """Generate a one-time Express onboarding URL. Returns {url} or {error}."""
    try:
        s = _stripe()
        link = await _run(
            s.AccountLink.create,
            account=account_id,
            refresh_url=refresh_url,
            return_url=return_url,
            type="account_onboarding",
        )
        return {"url": link.url}
    except Exception as e:
        logger.warning("[connect] onboarding_link failed: %s", e)
        return {"error": str(e)[:200]}


async def account_status(account_id: str) -> dict:
    """Return {payouts_enabled, details_submitted, charges_enabled} or {error}."""
    try:
        s = _stripe()
        acct = await _run(s.Account.retrieve, account_id)
        return {
            "payouts_enabled": bool(getattr(acct, "payouts_enabled", False)),
            "details_submitted": bool(getattr(acct, "details_submitted", False)),
            "charges_enabled": bool(getattr(acct, "charges_enabled", False)),
        }
    except Exception as e:
        logger.warning("[connect] account_status failed: %s", e)
        return {"error": str(e)[:200], "payouts_enabled": False, "details_submitted": False}


async def transfer_to_creator(amount_usd: float, destination_account_id: str, metadata: dict) -> dict:
    """Transfer the royalty to the creator's connected account. Returns {transfer_id, status}."""
    try:
        s = _stripe()
        tr = await _run(
            s.Transfer.create,
            amount=int(round(amount_usd * 100)),
            currency="usd",
            destination=destination_account_id,
            metadata={k: str(v) for k, v in (metadata or {}).items()},
        )
        return {"transfer_id": tr.id, "status": "paid"}
    except Exception as e:
        logger.warning("[connect] transfer_to_creator failed: %s", e)
        return {"error": str(e)[:200], "status": "failed"}
