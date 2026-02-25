"""
WebSocket Connection Manager
Manages real-time connections for:
  1. Transaction Rooms (scoped to a transaction_id)
  2. Global user channels (scoped to a user_id) for notifications & dashboard updates
"""

import logging
import json
from typing import Dict, Set
from datetime import datetime, timezone
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections grouped by room (transaction_id) and global user channels"""

    def __init__(self):
        # Transaction rooms: room_id -> { user_id: WebSocket }
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        self.presence: Dict[str, Set[str]] = {}

        # Global user channels: user_id -> set of WebSocket connections
        self._global_connections: Dict[str, Set[WebSocket]] = {}

    # ============ TRANSACTION ROOM METHODS ============

    async def connect(self, websocket: WebSocket, room_id: str, user_id: str, user_name: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = {}
            self.presence[room_id] = set()

        self.active_connections[room_id][user_id] = websocket
        self.presence[room_id].add(user_id)

        logger.info(f"WS: {user_name} ({user_id}) connected to room {room_id}")

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

    # ============ GLOBAL USER CHANNEL METHODS ============

    async def connect_global(self, websocket: WebSocket, user_id: str):
        """Connect a user to the global notification/event channel"""
        await websocket.accept()
        if user_id not in self._global_connections:
            self._global_connections[user_id] = set()
        self._global_connections[user_id].add(websocket)
        logger.info(f"WS Global: user {user_id} connected ({len(self._global_connections[user_id])} tabs)")

    def disconnect_global(self, websocket: WebSocket, user_id: str):
        """Disconnect a user from the global channel"""
        if user_id in self._global_connections:
            self._global_connections[user_id].discard(websocket)
            if not self._global_connections[user_id]:
                del self._global_connections[user_id]
        logger.info(f"WS Global: user {user_id} disconnected")

    async def push_to_user(self, user_id: str, message: dict):
        """Send a message to all global connections of a specific user"""
        sockets = self._global_connections.get(user_id, set())
        if not sockets:
            return

        disconnected = []
        for ws in sockets:
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.append(ws)

        for ws in disconnected:
            sockets.discard(ws)
        if not sockets:
            self._global_connections.pop(user_id, None)

    async def push_to_role(self, role_user_ids: list, message: dict):
        """Broadcast a message to all connected users in a list of user IDs"""
        for uid in role_user_ids:
            await self.push_to_user(uid, message)

    async def broadcast_global(self, message: dict):
        """Broadcast to ALL connected global users"""
        disconnected_users = []
        for uid, sockets in self._global_connections.items():
            dead = []
            for ws in sockets:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                sockets.discard(ws)
            if not sockets:
                disconnected_users.append(uid)
        for uid in disconnected_users:
            self._global_connections.pop(uid, None)

    def get_global_online_count(self) -> int:
        return len(self._global_connections)

    def is_user_online(self, user_id: str) -> bool:
        return user_id in self._global_connections


# Singleton instance
ws_manager = ConnectionManager()
