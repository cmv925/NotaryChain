"""
Draft Collaboration WebSocket
Real-time presence and live editing indicators for shared template drafts.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorDatabase
from services.ws_manager import ws_manager
import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

router = APIRouter(tags=["draft-collaboration"])

db: AsyncIOMotorDatabase = None


def set_db(database):
    global db
    db = database


# Track draft presence: draft_id -> { user_id: { ws, name, email, cursor_field } }
_draft_rooms = {}


def _get_presence_list(draft_id):
    """Get list of users currently viewing a draft."""
    room = _draft_rooms.get(draft_id, {})
    return [
        {
            "user_id": uid,
            "name": info.get("name", ""),
            "email": info.get("email", ""),
            "cursor_field": info.get("cursor_field"),
            "is_typing": info.get("is_typing", False),
        }
        for uid, info in room.items()
    ]


async def _broadcast_to_draft(draft_id, message, exclude_user=None):
    """Broadcast a message to all users in a draft room."""
    room = _draft_rooms.get(draft_id, {})
    disconnected = []
    for uid, info in room.items():
        if uid == exclude_user:
            continue
        ws = info.get("ws")
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.append(uid)
    for uid in disconnected:
        room.pop(uid, None)


@router.websocket("/api/ws/draft/{draft_id}")
async def draft_collaboration_ws(websocket: WebSocket, draft_id: str):
    """WebSocket for real-time collaboration on a specific draft.

    Client sends:
      1. { "type": "auth", "token": "<jwt>" } — first message to authenticate
      2. { "type": "cursor", "field": "<field_name>" } — cursor position update
      3. { "type": "typing", "field": "<field_name>", "is_typing": true/false }
      4. { "type": "field_update", "field": "<field_name>", "value": "..." } — live edit
      5. { "type": "ping" }

    Server pushes:
      - { "type": "presence", "users": [...] } — on join/leave
      - { "type": "cursor_update", "user_id", "user_name", "field" }
      - { "type": "typing_indicator", "user_id", "user_name", "field", "is_typing" }
      - { "type": "remote_edit", "user_id", "user_name", "field", "value" }
    """
    user_id = None
    user_name = None

    try:
        await websocket.accept()

        # Wait for auth
        raw = await websocket.receive_text()
        data = json.loads(raw)

        if data.get("type") != "auth" or not data.get("token"):
            await websocket.send_json({"type": "error", "message": "Send auth first"})
            await websocket.close(code=4001)
            return

        from auth import decode_access_token
        try:
            payload = decode_access_token(data["token"])
            if not payload:
                raise ValueError("Invalid")
            email = payload.get("sub")
        except Exception:
            await websocket.send_json({"type": "error", "message": "Invalid token"})
            await websocket.close(code=4001)
            return

        user_doc = await db.users.find_one(
            {"email": email}, {"_id": 0, "id": 1, "full_name": 1, "email": 1}
        )
        if not user_doc:
            await websocket.send_json({"type": "error", "message": "User not found"})
            await websocket.close(code=4001)
            return

        user_id = user_doc["id"]
        user_name = user_doc.get("full_name", email)
        user_email = user_doc.get("email", "")

        # Join draft room
        if draft_id not in _draft_rooms:
            _draft_rooms[draft_id] = {}

        _draft_rooms[draft_id][user_id] = {
            "ws": websocket,
            "name": user_name,
            "email": user_email,
            "cursor_field": None,
            "is_typing": False,
        }

        logger.info(f"Draft WS: {user_name} joined draft {draft_id}")

        # Broadcast updated presence
        presence = _get_presence_list(draft_id)
        await _broadcast_to_draft(draft_id, {
            "type": "presence",
            "users": presence,
            "event": "user_joined",
            "user_id": user_id,
            "user_name": user_name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        # Send welcome to this user
        await websocket.send_json({
            "type": "connected",
            "user_id": user_id,
            "draft_id": draft_id,
            "users": presence,
        })

        # Message loop
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
                msg_type = msg.get("type")

                if msg_type == "ping":
                    await websocket.send_json({"type": "pong"})

                elif msg_type == "cursor":
                    field = msg.get("field")
                    if draft_id in _draft_rooms and user_id in _draft_rooms[draft_id]:
                        _draft_rooms[draft_id][user_id]["cursor_field"] = field
                    await _broadcast_to_draft(draft_id, {
                        "type": "cursor_update",
                        "user_id": user_id,
                        "user_name": user_name,
                        "field": field,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }, exclude_user=user_id)

                elif msg_type == "typing":
                    field = msg.get("field")
                    is_typing = msg.get("is_typing", False)
                    if draft_id in _draft_rooms and user_id in _draft_rooms[draft_id]:
                        _draft_rooms[draft_id][user_id]["is_typing"] = is_typing
                        _draft_rooms[draft_id][user_id]["cursor_field"] = field
                    await _broadcast_to_draft(draft_id, {
                        "type": "typing_indicator",
                        "user_id": user_id,
                        "user_name": user_name,
                        "field": field,
                        "is_typing": is_typing,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }, exclude_user=user_id)

                elif msg_type == "field_update":
                    field = msg.get("field")
                    value = msg.get("value", "")
                    await _broadcast_to_draft(draft_id, {
                        "type": "remote_edit",
                        "user_id": user_id,
                        "user_name": user_name,
                        "field": field,
                        "value": value,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }, exclude_user=user_id)

            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug(f"Draft WS error: {e}")
    finally:
        if user_id and draft_id in _draft_rooms:
            _draft_rooms[draft_id].pop(user_id, None)
            if not _draft_rooms[draft_id]:
                del _draft_rooms[draft_id]
            else:
                # Broadcast leave
                presence = _get_presence_list(draft_id)
                try:
                    await _broadcast_to_draft(draft_id, {
                        "type": "presence",
                        "users": presence,
                        "event": "user_left",
                        "user_id": user_id,
                        "user_name": user_name or "",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                except Exception:
                    pass
            logger.info(f"Draft WS: {user_name or user_id} left draft {draft_id}")
