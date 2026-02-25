"""
Notification Service
Creates and broadcasts notifications via global WebSocket channel
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Will be set from server.py
db = None
ws_manager = None


def set_db(database):
    global db
    db = database


def set_ws_manager(manager):
    global ws_manager
    ws_manager = manager


async def create_notification(
    user_id: str,
    title: str,
    message: str,
    notif_type: str = "info",
    link: str = None,
    metadata: dict = None
):
    """Create a notification and push via global WebSocket"""
    notif = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": notif_type,
        "link": link,
        "metadata": metadata or {},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.notifications.insert_one({**notif, "_id": notif["id"]})
    notif_clean = {k: v for k, v in notif.items() if k != "_id"}

    # Push via global WebSocket channel
    if ws_manager:
        try:
            await ws_manager.push_to_user(user_id, {
                "type": "notification",
                "notification": notif_clean,
            })
        except Exception as e:
            logger.debug(f"Could not push notification via WS: {e}")

    return notif_clean


async def broadcast_event(event_type: str, data: dict, target_user_ids: list = None):
    """Broadcast a real-time event to specific users or all connected users.
    
    event_type examples: 'request_created', 'request_assigned', 'request_completed',
                         'dashboard_update', 'notary_queue_update'
    """
    if not ws_manager:
        return

    message = {
        "type": "event",
        "event": event_type,
        "data": data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    try:
        if target_user_ids:
            await ws_manager.push_to_role(target_user_ids, message)
        else:
            await ws_manager.broadcast_global(message)
    except Exception as e:
        logger.debug(f"Could not broadcast event {event_type}: {e}")


async def get_notary_user_ids() -> list:
    """Get all user IDs with notary role (for broadcasting notary events)"""
    notaries = await db.users.find(
        {"role": "notary"},
        {"_id": 0, "id": 1}
    ).to_list(500)
    return [n["id"] for n in notaries]
