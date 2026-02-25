"""
Global WebSocket endpoint for real-time notifications and dashboard events
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorDatabase
from services.ws_manager import ws_manager
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database


@router.websocket("/api/ws/global")
async def global_websocket(websocket: WebSocket):
    """Global WebSocket for notifications, dashboard updates, and queue events.
    
    Client sends: { "type": "auth", "token": "<jwt>" } as first message to authenticate.
    Server pushes: notifications, dashboard events, notary queue updates.
    """
    user_id = None
    try:
        # Accept and wait for auth message
        await websocket.accept()

        # Wait for auth token
        raw = await websocket.receive_text()
        data = json.loads(raw)

        if data.get("type") != "auth" or not data.get("token"):
            await websocket.send_json({"type": "error", "message": "Send auth message first"})
            await websocket.close(code=4001)
            return

        # Validate token
        from routes.auth_routes import decode_token
        token = data["token"]
        try:
            payload = decode_token(token)
            email = payload.get("sub")
        except Exception:
            await websocket.send_json({"type": "error", "message": "Invalid token"})
            await websocket.close(code=4001)
            return

        user_doc = await db.users.find_one({"email": email}, {"_id": 0, "id": 1, "full_name": 1, "role": 1})
        if not user_doc:
            await websocket.send_json({"type": "error", "message": "User not found"})
            await websocket.close(code=4001)
            return

        user_id = user_doc["id"]

        # Close the accepted connection and re-register through manager
        # (manager.connect_global already accepted, so we use internal tracking)
        ws_manager._global_connections.setdefault(user_id, set()).add(websocket)
        logger.info(f"WS Global: {user_doc.get('full_name', email)} authenticated")

        # Send welcome
        await websocket.send_json({
            "type": "connected",
            "user_id": user_id,
            "online_count": ws_manager.get_global_online_count(),
        })

        # Keep alive loop
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug(f"WS Global error: {e}")
    finally:
        if user_id:
            ws_manager.disconnect_global(websocket, user_id)
