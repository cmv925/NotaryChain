"""
Notification Service
Creates and broadcasts notifications
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
    """Create a notification and broadcast via WebSocket if possible"""
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

    # Try to push via WebSocket
    if ws_manager:
        try:
            for room_id, connections in ws_manager.active_connections.items():
                if user_id in connections:
                    await ws_manager.send_personal(room_id, user_id, {
                        "type": "notification",
                        "notification": notif_clean,
                    })
        except Exception as e:
            logger.debug(f"Could not push notification via WS: {e}")

    return notif_clean
