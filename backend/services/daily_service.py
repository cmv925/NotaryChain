"""
Daily.co Video Conferencing Service for RON (Remote Online Notarization) Sessions
"""

import os
import aiohttp
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class DailyVideoService:
    """
    Service for managing video conferencing rooms using Daily.co API.
    Used for Remote Online Notarization (RON) sessions.
    """
    
    def __init__(self):
        self.api_key = os.environ.get('DAILY_API_KEY')
        self.base_url = "https://api.daily.co/v1"
        
    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)
    
    async def _request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict:
        """Make authenticated request to Daily.co API"""
        if not self.api_key:
            raise Exception("Daily.co API key not configured")
            
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        url = f"{self.base_url}{endpoint}"
        
        async with aiohttp.ClientSession() as session:
            if method == "GET":
                async with session.get(url, headers=headers) as response:
                    return await response.json()
            elif method == "POST":
                async with session.post(url, headers=headers, json=data) as response:
                    return await response.json()
            elif method == "DELETE":
                async with session.delete(url, headers=headers) as response:
                    if response.status == 200:
                        return await response.json()
                    return {"deleted": True}
    
    async def create_room(
        self,
        session_id: str,
        expires_minutes: int = 60,
        enable_recording: bool = True,
        enable_screenshare: bool = True,
        max_participants: int = 4
    ) -> Dict[str, Any]:
        """
        Create a new video room for a notarization session.
        
        Args:
            session_id: Unique identifier for the notary session
            expires_minutes: How long until room expires
            enable_recording: Enable cloud recording for compliance
            enable_screenshare: Allow screen sharing for document review
            max_participants: Maximum number of participants
            
        Returns:
            Room details including URL and name
        """
        if not self.is_configured:
            # Return mock room for development
            return self._mock_room(session_id)
        
        room_name = f"notary-{session_id[:8]}-{uuid.uuid4().hex[:6]}"
        expiry_time = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
        
        room_config = {
            "name": room_name,
            "privacy": "private",
            "properties": {
                "exp": int(expiry_time.timestamp()),
                "max_participants": max_participants,
                "enable_screenshare": enable_screenshare,
                "enable_recording": "cloud" if enable_recording else False,
                "enable_chat": True,
                "start_video_off": False,
                "start_audio_off": False,
                "owner_only_broadcast": False,
                "enable_knocking": True,
                "enable_prejoin_ui": True,
                "eject_at_room_exp": True
            }
        }
        
        try:
            result = await self._request("POST", "/rooms", room_config)
            
            return {
                "success": True,
                "room_name": result.get("name"),
                "room_url": result.get("url"),
                "expires_at": expiry_time.isoformat(),
                "recording_enabled": enable_recording,
                "config": result.get("config", {})
            }
        except Exception as e:
            logger.error(f"Failed to create room: {e}")
            return {"success": False, "error": str(e)}
    
    async def create_meeting_token(
        self,
        room_name: str,
        user_name: str,
        user_id: str,
        is_owner: bool = False,
        expires_minutes: int = 60
    ) -> Dict[str, Any]:
        """
        Create a meeting token for a participant.
        
        Args:
            room_name: Name of the Daily room
            user_name: Display name for the participant
            user_id: Unique user identifier
            is_owner: If true, grants owner privileges (can kick, mute others)
            expires_minutes: Token expiration time
            
        Returns:
            Meeting token for joining the room
        """
        if not self.is_configured:
            return self._mock_token(room_name, user_name)
        
        expiry_time = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
        
        token_config = {
            "properties": {
                "room_name": room_name,
                "user_name": user_name,
                "user_id": user_id,
                "exp": int(expiry_time.timestamp()),
                "is_owner": is_owner,
                "enable_recording": "cloud" if is_owner else False,
                "start_cloud_recording": False,
                "enable_screenshare": True
            }
        }
        
        try:
            result = await self._request("POST", "/meeting-tokens", token_config)
            
            return {
                "success": True,
                "token": result.get("token"),
                "expires_at": expiry_time.isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to create token: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_room(self, room_name: str) -> Dict[str, Any]:
        """Get room details"""
        if not self.is_configured:
            return {"success": False, "error": "Daily.co not configured"}
            
        try:
            result = await self._request("GET", f"/rooms/{room_name}")
            return {"success": True, "room": result}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def delete_room(self, room_name: str) -> Dict[str, Any]:
        """Delete a room"""
        if not self.is_configured:
            return {"success": True, "deleted": True}
            
        try:
            await self._request("DELETE", f"/rooms/{room_name}")
            return {"success": True, "deleted": True}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_recordings(self, room_name: str) -> Dict[str, Any]:
        """Get recordings for a room"""
        if not self.is_configured:
            return {"success": False, "error": "Daily.co not configured"}
            
        try:
            result = await self._request("GET", f"/recordings?room_name={room_name}")
            return {"success": True, "recordings": result.get("data", [])}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _mock_room(self, session_id: str) -> Dict[str, Any]:
        """Return mock room data for development without API key"""
        room_name = f"mock-notary-{session_id[:8]}"
        return {
            "success": True,
            "room_name": room_name,
            "room_url": f"https://notarychain.daily.co/{room_name}",
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
            "recording_enabled": True,
            "mock": True,
            "message": "Daily.co API key not configured. Using mock room for development."
        }
    
    def _mock_token(self, room_name: str, user_name: str) -> Dict[str, Any]:
        """Return mock token for development"""
        return {
            "success": True,
            "token": f"mock_token_{room_name}_{user_name}",
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
            "mock": True
        }
    
    def get_status(self) -> Dict[str, Any]:
        """Get service configuration status"""
        return {
            "configured": self.is_configured,
            "provider": "daily.co",
            "features": {
                "video_conferencing": True,
                "screen_sharing": True,
                "cloud_recording": True,
                "chat": True
            }
        }


# Singleton instance
daily_service = DailyVideoService()
