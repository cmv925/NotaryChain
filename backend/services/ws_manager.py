"""
WebSocket Connection Manager
Manages real-time connections for Transaction Rooms
"""

import logging
import json
from typing import Dict, Set
from datetime import datetime, timezone
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections grouped by room (transaction_id)"""

    def __init__(self):
        # room_id -> set of (websocket, user_info) tuples
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        # Track user presence: room_id -> set of user_ids
        self.presence: Dict[str, Set[str]] = {}

    async def connect(self, websocket: WebSocket, room_id: str, user_id: str, user_name: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = {}
            self.presence[room_id] = set()

        self.active_connections[room_id][user_id] = websocket
        self.presence[room_id].add(user_id)

        logger.info(f"WS: {user_name} ({user_id}) connected to room {room_id}")

        # Notify others of join
        await self.broadcast(room_id, {
            "type": "presence",
            "event": "user_joined",
            "user_id": user_id,
            "user_name": user_name,
            "online_users": list(self.presence.get(room_id, set())),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, exclude_user=user_id)

    def disconnect(self, room_id: str, user_id: str, user_name: str = ""):
        if room_id in self.active_connections:
            self.active_connections[room_id].pop(user_id, None)
            self.presence.get(room_id, set()).discard(user_id)

            if not self.active_connections[room_id]:
                del self.active_connections[room_id]
                self.presence.pop(room_id, None)

        logger.info(f"WS: {user_name} ({user_id}) disconnected from room {room_id}")

    async def broadcast(self, room_id: str, message: dict, exclude_user: str = None):
        """Broadcast message to all connections in a room"""
        if room_id not in self.active_connections:
            return

        disconnected = []
        for uid, ws in self.active_connections[room_id].items():
            if uid == exclude_user:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.append(uid)

        for uid in disconnected:
            self.active_connections[room_id].pop(uid, None)
            self.presence.get(room_id, set()).discard(uid)

    async def send_personal(self, room_id: str, user_id: str, message: dict):
        """Send message to a specific user in a room"""
        ws = self.active_connections.get(room_id, {}).get(user_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                self.active_connections.get(room_id, {}).pop(user_id, None)

    def get_online_users(self, room_id: str) -> list:
        return list(self.presence.get(room_id, set()))

    def get_connection_count(self, room_id: str) -> int:
        return len(self.active_connections.get(room_id, {}))


# Singleton instance
ws_manager = ConnectionManager()
