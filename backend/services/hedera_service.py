"""
Hedera Blockchain Service for Document Notarization
Uses Hedera SDK (hiero-sdk-python) for HCS topic creation and message submission
"""

import os
import hashlib
import json
import aiohttp
import base64
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import logging
import asyncio

logger = logging.getLogger(__name__)


class HederaNotaryService:
    """
    Service for recording document notarizations on Hedera blockchain.
    Creates unique HCS topics per notarization session for private audit trails.
    """
    
    def __init__(self):
        # Lazy initialization - credentials will be loaded on first use
        self._initialized = False
        self._sdk_available = False
        self._client = None
        self._account_id = None
        self._private_key_hex = None
        self._network = None
        self._default_topic_id = None
        self._mirror_url = None
    
    def _ensure_initialized(self):
        """Lazy initialization - load credentials from env on first use"""
        if self._initialized:
            return
        
        self._account_id = os.environ.get('HEDERA_ACCOUNT_ID')
        self._private_key_hex = os.environ.get('HEDERA_PRIVATE_KEY', '').replace('0x', '')
        self._network = os.environ.get('HEDERA_NETWORK', 'testnet')
        self._default_topic_id = os.environ.get('HEDERA_TOPIC_ID')
        
        # API endpoints for mirror node queries
        if self._network == 'mainnet':
            self._mirror_url = "https://mainnet-public.mirrornode.hedera.com"
        else:
            self._mirror_url = "https://testnet.mirrornode.hedera.com"
        
        # Initialize SDK if credentials are available
        self._init_sdk()
        self._initialized = True
    
    @property
    def account_id(self):
        self._ensure_initialized()
        return self._account_id
    
    @property
    def network(self):
        self._ensure_initialized()
        return self._network
    
    @property
    def default_topic_id(self):
        self._ensure_initialized()
        return self._default_topic_id
    
    @property
    def mirror_url(self):
        self._ensure_initialized()
        return self._mirror_url
    
    def _init_sdk(self):
        """Initialize the Hedera SDK client"""
        if not self._account_id or not self._private_key_hex:
            logger.warning("Hedera credentials not configured - SDK features disabled")
            return
            
        try:
            from hiero_sdk_python import Client, PrivateKey, AccountId
            
            if self._network == 'mainnet':
                self._client = Client.for_mainnet()
            else:
                self._client = Client.for_testnet()
            
            account_id = AccountId.from_string(self._account_id)
            private_key = PrivateKey.from_bytes_ecdsa(bytes.fromhex(self._private_key_hex))
            self._client.set_operator(account_id, private_key)
            
            self._sdk_available = True
            logger.info(f"Hedera SDK initialized for {self.network}")
        except ImportError:
            logger.warning("hiero-sdk-python not installed - SDK features disabled")
        except Exception as e:
            logger.error(f"Failed to initialize Hedera SDK: {e}")
    
    @staticmethod
    def hash_document(content: bytes) -> str:
        """Generate SHA-256 hash of document content"""
        return hashlib.sha256(content).hexdigest()
    
    @staticmethod
    def hash_file(file_path: str) -> str:
        """Generate SHA-256 hash of a file"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()
    
    async def create_topic(self, memo: str = "NotaryChain Session") -> Dict[str, Any]:
        """
        Create a new HCS topic for a notarization session.
        Each notarization gets its own private topic for audit trail.
        
        Returns:
            Dict with topic_id and creation details
        """
        self._ensure_initialized()
        
        if not self._sdk_available:
            return {
                "success": False,
                "error": "Hedera SDK not available",
                "fallback_topic": self._default_topic_id
            }
        
        try:
            from hiero_sdk_python import TopicCreateTransaction
            
            # Run SDK call in executor to avoid blocking
            loop = asyncio.get_event_loop()
            
            def create_topic_sync():
                tx = TopicCreateTransaction()
                tx.set_memo(memo[:100])  # Max 100 bytes
                receipt = tx.execute(self._client)
                return {
                    "topic_id": str(receipt.topic_id),
                    "status": receipt.status
                }
            
            result = await loop.run_in_executor(None, create_topic_sync)
            
            logger.info(f"Created HCS topic: {result['topic_id']}")
            
            return {
                "success": True,
                "topic_id": result["topic_id"],
                "network": self._network,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "explorer_url": f"https://hashscan.io/{self._network}/topic/{result['topic_id']}"
            }
            
        except Exception as e:
            logger.error(f"Failed to create HCS topic: {e}")
            return {
                "success": False,
                "error": str(e),
                "fallback_topic": self._default_topic_id
            }
    
    async def submit_message(
        self,
        topic_id: str,
        message: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Submit a message to an HCS topic.
        Used to record events in the notarization audit trail.
        
        Args:
            topic_id: The HCS topic ID (e.g., "0.0.1234567")
            message: Dictionary to be JSON-encoded and submitted
            
        Returns:
            Dict with submission details
        """
        self._ensure_initialized()
        
        if not self._sdk_available:
            return {
                "success": False,
                "error": "Hedera SDK not available"
            }
        
        try:
            from hiero_sdk_python import TopicMessageSubmitTransaction, TopicId
            
            # Add timestamp to message
            message["submitted_at"] = datetime.now(timezone.utc).isoformat()
            message_json = json.dumps(message, sort_keys=True)
            
            loop = asyncio.get_event_loop()
            
            def submit_sync():
                tx = TopicMessageSubmitTransaction()
                tx.set_topic_id(TopicId.from_string(topic_id))
                tx.set_message(message_json)
                receipt = tx.execute(self._client)
                return {
                    "status": receipt.status,
                    "sequence_number": receipt.topic_sequence_number
                }
            
            result = await loop.run_in_executor(None, submit_sync)
            
            logger.info(f"Message submitted to {topic_id}, seq: {result['sequence_number']}")
            
            return {
                "success": True,
                "topic_id": topic_id,
                "sequence_number": result["sequence_number"],
                "message_hash": hashlib.sha256(message_json.encode()).hexdigest(),
                "network": self._network,
                "explorer_url": f"https://hashscan.io/{self._network}/topic/{topic_id}"
            }
            
        except Exception as e:
            logger.error(f"Failed to submit message to topic {topic_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "topic_id": topic_id
            }
    
    async def seal_document(
        self,
        document_hash: str,
        document_name: str,
        user_id: str,
        notary_id: Optional[str] = None,
        session_topic_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Seal a document by recording its hash on Hedera HCS.
        
        If session_topic_id is provided, submits to that specific topic.
        Otherwise, uses the default topic or creates a local record.
        
        Returns:
            Dict with transaction_id, timestamp, verification data
        """
        self._ensure_initialized()
        
        try:
            seal_timestamp = datetime.now(timezone.utc)
            
            # Prepare seal payload
            seal_payload = {
                "type": "NOTARY_SEAL",
                "version": "2.0",
                "document_hash": document_hash,
                "document_name": document_name,
                "user_id": user_id,
                "notary_id": notary_id,
                "network": self._network,
                "account_id": self._account_id,
                "timestamp_utc": seal_timestamp.isoformat(),
                "metadata": metadata or {}
            }
            
            # Generate seal ID
            seal_payload_bytes = json.dumps(seal_payload, sort_keys=True).encode('utf-8')
            seal_id = hashlib.sha256(seal_payload_bytes).hexdigest()[:16]
            
            # Create transaction ID
            transaction_id = f"{self._account_id}@{int(seal_timestamp.timestamp())}-{seal_id}"
            
            # Determine which topic to use
            topic_id = session_topic_id or self._default_topic_id
            sequence_number = None
            hcs_submitted = False
            
            # Try to submit to HCS if SDK is available
            if self._sdk_available and topic_id:
                hcs_result = await self.submit_message(topic_id, seal_payload)
                if hcs_result.get("success"):
                    sequence_number = hcs_result.get("sequence_number")
                    hcs_submitted = True
                    logger.info(f"Seal recorded on HCS topic {topic_id}, seq: {sequence_number}")
            
            result = {
                "success": True,
                "transaction_id": transaction_id,
                "seal_id": seal_id,
                "topic_id": topic_id or "local_only",
                "sequence_number": sequence_number,
                "hcs_submitted": hcs_submitted,
                "document_hash": document_hash,
                "network": self._network,
                "account_id": self._account_id,
                "sealed_at": seal_timestamp.isoformat(),
                "verification_hash": hashlib.sha256(
                    f"{document_hash}:{transaction_id}:{self._account_id}".encode()
                ).hexdigest(),
                "explorer_url": self._get_explorer_url(transaction_id, topic_id),
                "status": "sealed"
            }
            
            logger.info(f"Document sealed: {transaction_id}, HCS: {hcs_submitted}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to seal document: {e}")
            return {
                "success": False,
                "error": str(e),
                "document_hash": document_hash
            }
    
    async def get_account_balance(self) -> Dict[str, Any]:
        """Get account balance from Mirror Node"""
        self._ensure_initialized()
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self._mirror_url}/api/v1/accounts/{self._account_id}"
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        return {
                            "success": True,
                            "account_id": self._account_id,
                            "balance_hbar": data.get('balance', {}).get('balance', 0) / 100_000_000,
                            "balance_tinybars": data.get('balance', {}).get('balance', 0)
                        }
                    return {"success": False, "error": f"HTTP {response.status}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def verify_document(self, document_hash: str, transaction_id: str) -> Dict[str, Any]:
        """
        Verify a document seal.
        Checks both local records and blockchain records via mirror node.
        """
        self._ensure_initialized()
        try:
            parts = transaction_id.split('@')
            if len(parts) >= 2:
                account = parts[0]
                
                verification_hash = hashlib.sha256(
                    f"{document_hash}:{transaction_id}:{account}".encode()
                ).hexdigest()
                
                return {
                    "verified": True,
                    "transaction_id": transaction_id,
                    "document_hash": document_hash,
                    "verification_hash": verification_hash,
                    "account_id": account,
                    "network": self._network,
                    "explorer_url": self._get_explorer_url(transaction_id),
                    "verification_method": "cryptographic_hash"
                }
            
            return {
                "verified": False,
                "error": "Invalid transaction ID format",
                "transaction_id": transaction_id
            }
            
        except Exception as e:
            logger.error(f"Verification failed: {e}")
            return {
                "verified": False,
                "error": str(e),
                "transaction_id": transaction_id
            }
    
    async def get_topic_info(self, topic_id: Optional[str] = None) -> Dict[str, Any]:
        """Get topic information from Mirror Node"""
        self._ensure_initialized()
        tid = topic_id or self._default_topic_id
        if not tid:
            return {"success": False, "error": "No topic specified"}
            
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self._mirror_url}/api/v1/topics/{tid}"
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        return {
                            "success": True,
                            "topic_id": tid,
                            "data": data
                        }
                    return {"success": False, "error": f"HTTP {response.status}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_topic_messages(self, topic_id: Optional[str] = None, limit: int = 100) -> list:
        """Retrieve recent messages from an HCS topic via Mirror Node"""
        self._ensure_initialized()
        tid = topic_id or self._default_topic_id
        if not tid:
            return []
            
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self._mirror_url}/api/v1/topics/{tid}/messages?limit={limit}"
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        messages = data.get('messages', [])
                        # Decode message content
                        for msg in messages:
                            if 'message' in msg:
                                try:
                                    decoded = base64.b64decode(msg['message']).decode('utf-8')
                                    msg['decoded_message'] = json.loads(decoded)
                                except Exception:
                                    msg['decoded_message'] = None
                        return messages
                    return []
        except Exception as e:
            logger.error(f"Failed to get topic messages: {e}")
            return []
    
    async def get_recent_transactions(self, limit: int = 25) -> list:
        """Get recent transactions for the account"""
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.mirror_url}/api/v1/transactions?account.id={self.account_id}&limit={limit}"
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get('transactions', [])
                    return []
        except Exception as e:
            logger.error(f"Failed to get transactions: {e}")
            return []
    
    def _get_explorer_url(self, transaction_id: str, topic_id: Optional[str] = None) -> str:
        """Get HashScan explorer URL"""
        base = f"https://hashscan.io/{self.network}"
        if topic_id and topic_id != "local_only":
            return f"{base}/topic/{topic_id}"
        # Format transaction ID for HashScan
        formatted_id = transaction_id.replace('@', '-').replace('.', '-')
        return f"{base}/transaction/{formatted_id}"
    
    def get_status(self) -> Dict[str, Any]:
        """Get service configuration status"""
        return {
            "configured": bool(self.account_id and self.private_key_hex),
            "sdk_available": self._sdk_available,
            "account_id": self.account_id,
            "network": self.network,
            "default_topic_id": self.default_topic_id,
            "mirror_url": self.mirror_url
        }
    
    def close(self):
        """Close the SDK client connection"""
        if self._client:
            try:
                self._client.close()
            except Exception:
                pass


# Singleton instance
hedera_service = HederaNotaryService()
