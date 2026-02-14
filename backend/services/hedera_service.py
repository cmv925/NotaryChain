"""
Hedera Blockchain Service for Document Notarization
Uses Hedera Consensus Service (HCS) for tamper-proof document timestamping
"""

import os
import hashlib
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

# Hedera SDK imports
try:
    from hedera import (
        Client, 
        AccountId, 
        PrivateKey,
        TopicCreateTransaction,
        TopicMessageSubmitTransaction,
        TopicId,
        Hbar
    )
    HEDERA_AVAILABLE = True
except ImportError:
    HEDERA_AVAILABLE = False
    logger.warning("Hedera SDK not available. Install with: pip install hedera-sdk-py")


class HederaNotaryService:
    """
    Service for recording document notarizations on Hedera blockchain.
    Uses HCS (Hedera Consensus Service) for tamper-proof timestamps.
    """
    
    def __init__(self):
        self.account_id = os.environ.get('HEDERA_ACCOUNT_ID')
        self.private_key = os.environ.get('HEDERA_PRIVATE_KEY')
        self.network = os.environ.get('HEDERA_NETWORK', 'testnet')
        self.topic_id = os.environ.get('HEDERA_TOPIC_ID')  # Pre-created topic for notarizations
        self.client = None
        self._initialized = False
        
    def initialize(self) -> bool:
        """Initialize Hedera client connection"""
        if not HEDERA_AVAILABLE:
            logger.error("Hedera SDK not installed")
            return False
            
        if not self.account_id or not self.private_key:
            logger.error("Hedera credentials not configured")
            return False
            
        try:
            # Parse credentials
            operator_id = AccountId.fromString(self.account_id)
            operator_key = PrivateKey.fromStringECDSA(self.private_key)
            
            # Create client for appropriate network
            if self.network == 'mainnet':
                self.client = Client.forMainnet()
            else:
                self.client = Client.forTestnet()
            
            # Set operator
            self.client.setOperator(operator_id, operator_key)
            self._initialized = True
            logger.info(f"Hedera client initialized on {self.network}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize Hedera client: {e}")
            return False
    
    def _ensure_initialized(self):
        """Ensure client is initialized before operations"""
        if not self._initialized:
            if not self.initialize():
                raise Exception("Failed to initialize Hedera client")
    
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
    
    async def create_notary_topic(self, memo: str = "NotaryChain Document Seals") -> Optional[str]:
        """
        Create a new HCS topic for document notarizations.
        Only needs to be done once per application.
        """
        self._ensure_initialized()
        
        try:
            # Create topic transaction
            transaction = (
                TopicCreateTransaction()
                .setTopicMemo(memo)
                .setMaxTransactionFee(Hbar(2))
            )
            
            # Execute and get receipt
            response = transaction.execute(self.client)
            receipt = response.getReceipt(self.client)
            topic_id = receipt.topicId
            
            logger.info(f"Created HCS topic: {topic_id}")
            return str(topic_id)
            
        except Exception as e:
            logger.error(f"Failed to create topic: {e}")
            return None
    
    async def seal_document(
        self,
        document_hash: str,
        document_name: str,
        user_id: str,
        notary_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Seal a document on Hedera blockchain.
        Records document hash with timestamp on HCS.
        
        Returns:
            Dict with transaction_id, consensus_timestamp, topic_id, sequence_number
        """
        self._ensure_initialized()
        
        if not self.topic_id:
            raise Exception("No HCS topic configured. Set HEDERA_TOPIC_ID environment variable.")
        
        try:
            # Prepare message payload
            seal_data = {
                "type": "DOCUMENT_SEAL",
                "version": "1.0",
                "document_hash": document_hash,
                "document_name": document_name,
                "user_id": user_id,
                "notary_id": notary_id,
                "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                "metadata": metadata or {}
            }
            
            message_bytes = json.dumps(seal_data).encode('utf-8')
            
            # Submit to HCS topic
            topic_id = TopicId.fromString(self.topic_id)
            transaction = (
                TopicMessageSubmitTransaction()
                .setTopicId(topic_id)
                .setMessage(message_bytes)
                .setMaxTransactionFee(Hbar(2))
            )
            
            # Execute transaction
            response = transaction.execute(self.client)
            receipt = response.getReceipt(self.client)
            
            # Get transaction details
            transaction_id = str(response.transactionId)
            
            result = {
                "success": True,
                "transaction_id": transaction_id,
                "topic_id": self.topic_id,
                "sequence_number": receipt.topicSequenceNumber,
                "document_hash": document_hash,
                "network": self.network,
                "explorer_url": self._get_explorer_url(transaction_id),
                "sealed_at": datetime.now(timezone.utc).isoformat()
            }
            
            logger.info(f"Document sealed on Hedera: {transaction_id}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to seal document: {e}")
            return {
                "success": False,
                "error": str(e),
                "document_hash": document_hash
            }
    
    async def verify_document(self, document_hash: str, transaction_id: str) -> Dict[str, Any]:
        """
        Verify a document seal by checking the blockchain record.
        Uses Hedera Mirror Node API for verification.
        """
        import aiohttp
        
        try:
            # Query Mirror Node for transaction
            if self.network == 'mainnet':
                mirror_url = f"https://mainnet-public.mirrornode.hedera.com/api/v1/transactions/{transaction_id}"
            else:
                mirror_url = f"https://testnet.mirrornode.hedera.com/api/v1/transactions/{transaction_id}"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(mirror_url) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        # Transaction found
                        transactions = data.get('transactions', [])
                        if transactions:
                            tx = transactions[0]
                            return {
                                "verified": True,
                                "transaction_id": transaction_id,
                                "consensus_timestamp": tx.get('consensus_timestamp'),
                                "status": tx.get('result'),
                                "network": self.network,
                                "explorer_url": self._get_explorer_url(transaction_id)
                            }
                    
                    return {
                        "verified": False,
                        "error": "Transaction not found",
                        "transaction_id": transaction_id
                    }
                    
        except Exception as e:
            logger.error(f"Verification failed: {e}")
            return {
                "verified": False,
                "error": str(e),
                "transaction_id": transaction_id
            }
    
    async def get_topic_messages(self, limit: int = 100) -> list:
        """
        Retrieve recent messages from the notary topic.
        Uses Mirror Node API.
        """
        import aiohttp
        
        if not self.topic_id:
            return []
            
        try:
            if self.network == 'mainnet':
                mirror_url = f"https://mainnet-public.mirrornode.hedera.com/api/v1/topics/{self.topic_id}/messages?limit={limit}"
            else:
                mirror_url = f"https://testnet.mirrornode.hedera.com/api/v1/topics/{self.topic_id}/messages?limit={limit}"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(mirror_url) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get('messages', [])
                    return []
                    
        except Exception as e:
            logger.error(f"Failed to get topic messages: {e}")
            return []
    
    def _get_explorer_url(self, transaction_id: str) -> str:
        """Get HashScan explorer URL for transaction"""
        if self.network == 'mainnet':
            return f"https://hashscan.io/mainnet/transaction/{transaction_id}"
        return f"https://hashscan.io/testnet/transaction/{transaction_id}"


# Singleton instance
hedera_service = HederaNotaryService()
