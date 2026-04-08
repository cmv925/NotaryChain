"""
Feature Gating Utility
Enforces subscription-based access control at the route handler level.
"""
from fastapi import HTTPException, Request
import logging

logger = logging.getLogger(__name__)

db = None

def set_db(database):
    global db
    db = database


async def enforce_feature_gate(request: Request, feature: str):
    """Call at the start of any route handler to enforce plan-based feature gating.
    
    Extracts user from the request token, checks their plan, and raises 403
    with upgrade details if the feature is not included in their plan.
    """
    from routes.subscription_routes import FEATURE_PLAN_MAP, PLAN_HIERARCHY, PLANS

    required_plan = FEATURE_PLAN_MAP.get(feature)
    if not required_plan:
        return  # Feature not gated

    # Extract user
    from auth import decode_access_token
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_access_token(auth.split(" ", 1)[1])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"email": payload["sub"]}, {"_id": 0, "id": 1, "role": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Admin bypass
    if user.get("role") == "admin":
        return

    user_id = user.get("id", "")
    sub = await db.subscriptions.find_one(
        {"user_id": user_id, "status": {"$in": ["active", "trialing"]}},
        {"_id": 0, "plan_id": 1}
    )
    user_plan = sub["plan_id"] if sub else "free"
    user_level = PLAN_HIERARCHY.get(user_plan, 0)
    required_level = PLAN_HIERARCHY.get(required_plan, 0)

    if user_level < required_level:
        plan_info = PLANS.get(required_plan, {})
        raise HTTPException(
            status_code=403,
            detail={
                "error": "upgrade_required",
                "message": f"This feature requires the {plan_info.get('name', required_plan)} plan or higher.",
                "required_plan": required_plan,
                "required_plan_name": plan_info.get("name", ""),
                "required_plan_price": plan_info.get("price", 0),
                "current_plan": user_plan,
                "feature": feature,
            }
        )
