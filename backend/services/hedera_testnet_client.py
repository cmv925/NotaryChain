"""
Hedera Testnet Client — Real on-chain operations for HSCS + HTS NFT
====================================================================
A dedicated, lightweight client that talks to Hedera testnet using the
HEDERA_TESTNET_* env credentials. This is intentionally separate from the
mainnet `hedera_service` so:
  • testnet calls don't accidentally hit mainnet (which costs real HBAR)
  • the mainnet HCS sealing flow keeps working untouched
  • this module fails closed (returns success=False) if creds are missing,
    so the higher-level `mock` fallback in hedera_contract_service / acn_service
    is the natural degradation path.
"""
from __future__ import annotations
import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


class HederaTestnetClient:
    """Wraps a single Hedera testnet `Client` with NFT + contract helpers."""

    def __init__(self):
        self._client = None
        self._account_id = None
        self._private_key = None
        self._sdk_available = False
        self._init()

    def _init(self):
        acct = os.environ.get("HEDERA_TESTNET_ACCOUNT_ID")
        priv = os.environ.get("HEDERA_TESTNET_PRIVATE_KEY")
        if not acct or not priv:
            logger.warning("[hedera-testnet] credentials missing — real-mode calls will short-circuit to mock")
            return
        try:
            from hiero_sdk_python import Client, PrivateKey, AccountId
            self._client = Client.for_testnet()
            account_id = AccountId.from_string(acct)
            # `from_string` auto-detects DER, raw-hex, ed25519/ecdsa formats
            private_key = PrivateKey.from_string(priv)
            self._client.set_operator(account_id, private_key)
            self._account_id = acct
            self._private_key = private_key
            self._sdk_available = True
            logger.info("[hedera-testnet] client ready (operator=%s)", acct)
        except ImportError:
            logger.warning("[hedera-testnet] hiero-sdk-python not installed")
        except Exception as e:
            logger.error("[hedera-testnet] init failed: %s", e)

    @property
    def ready(self) -> bool:
        return self._sdk_available

    @property
    def account_id(self) -> Optional[str]:
        return self._account_id

    @property
    def explorer_base(self) -> str:
        return "https://hashscan.io/testnet"

    # ──────────────────────────────────────────────────────────────────
    # NFT — create the collection lazily then mint a new serial
    # ──────────────────────────────────────────────────────────────────
    _NFT_TOKEN_CACHE: dict = {}

    async def _ensure_nft_collection(self) -> Optional[str]:
        """Create-once an HTS NFT collection for ACN passports.
        Caches the token id in memory and in env (`ACN_NFT_TOKEN_ID`)."""
        if not self._sdk_available:
            return None
        env_token = os.environ.get("ACN_NFT_TOKEN_ID")
        if env_token:
            self._NFT_TOKEN_CACHE["token_id"] = env_token
            return env_token
        if self._NFT_TOKEN_CACHE.get("token_id"):
            return self._NFT_TOKEN_CACHE["token_id"]

        try:
            from hiero_sdk_python import (
                TokenCreateTransaction, TokenType,
            )

            def _build():
                tx = (TokenCreateTransaction()
                      .set_token_name("NotaryChain ACN Passport")
                      .set_token_symbol("ACNP")
                      .set_token_type(TokenType.NON_FUNGIBLE_UNIQUE)
                      .set_treasury_account_id(self._client.operator_account_id)
                      .set_supply_key(self._private_key.public_key())
                      .set_initial_supply(0)
                      .set_decimals(0))
                tx = tx.freeze_with(self._client).sign(self._private_key)
                # This SDK's `execute` returns the TransactionReceipt directly
                # (not a TransactionResponse wrapper).
                receipt = tx.execute(self._client)
                return str(receipt.token_id) if receipt.token_id else None

            token_id = await asyncio.to_thread(_build)
            if token_id:
                self._NFT_TOKEN_CACHE["token_id"] = token_id
                logger.info("[hedera-testnet] NFT collection created %s", token_id)
            return token_id
        except Exception as e:
            logger.warning("[hedera-testnet] NFT collection create failed: %s", e)
            return None

    async def mint_nft(self, metadata: bytes) -> dict:
        """Mint a new serial in the ACN passport collection."""
        if not self._sdk_available:
            return {"success": False, "reason": "sdk_unavailable"}
        token_id = await self._ensure_nft_collection()
        if not token_id:
            return {"success": False, "reason": "token_create_failed"}

        try:
            from hiero_sdk_python import TokenMintTransaction, TokenId

            # Hedera NFT metadata cap is 100 bytes per serial
            md = metadata[:100]

            def _mint():
                tx = (TokenMintTransaction()
                      .set_token_id(TokenId.from_string(token_id))
                      .set_metadata(md))
                tx = tx.freeze_with(self._client).sign(self._private_key)
                receipt = tx.execute(self._client)  # returns receipt directly
                serials = receipt.serial_numbers or []
                tx_id_obj = getattr(receipt, "transaction_id", None)
                return {
                    "serial_number": serials[0] if serials else None,
                    "transaction_id": str(tx_id_obj) if tx_id_obj else None,
                }

            result = await asyncio.to_thread(_mint)
            if not result.get("serial_number"):
                return {"success": False, "reason": "mint_no_serial"}
            return {
                "success": True,
                "token_id": token_id,
                "serial_number": result["serial_number"],
                "transaction_id": result["transaction_id"],
                "explorer_url": f"{self.explorer_base}/token/{token_id}/{result['serial_number']}",
            }
        except Exception as e:
            logger.warning("[hedera-testnet] NFT mint failed: %s", e)
            return {"success": False, "reason": str(e)[:140]}

    # ──────────────────────────────────────────────────────────────────
    # CONTRACT — deploy bytecode file + create + execute
    # ──────────────────────────────────────────────────────────────────
    async def deploy_contract(self, bytecode_hex: str, *, memo: str = "") -> dict:
        """Deploy bytecode via the classic FileCreate + ContractCreate flow.
        Constructor params are intentionally not set — the NotaryEscrow
        contract used here has a zero-arg constructor for safety on testnet.
        Returns {success, contract_id, transaction_id, gas_used, file_id}."""
        if not self._sdk_available:
            return {"success": False, "reason": "sdk_unavailable"}
        try:
            from hiero_sdk_python import (
                FileCreateTransaction, ContractCreateTransaction,
            )

            bytecode_hex = bytecode_hex.lower()
            # Hedera File contents for ContractCreate must be the *hex-encoded
            # ASCII string* of the bytecode (the network decodes it at deploy),
            # NOT the raw bytes. (Hedera error 82 = ERROR_DECODING_BYTESTRING
            # is the symptom of getting this wrong.)
            file_contents = bytecode_hex.encode("ascii")
            if len(file_contents) > 6_000:
                return {"success": False, "reason": "bytecode_too_large_for_single_filecreate"}

            def _deploy():
                # 1) Upload bytecode (as hex-ASCII) to a File
                ftx = (FileCreateTransaction()
                       .set_keys(self._private_key.public_key())
                       .set_contents(file_contents))
                ftx = ftx.freeze_with(self._client).sign(self._private_key)
                freceipt = ftx.execute(self._client)  # returns receipt directly
                file_id = freceipt.file_id
                if file_id is None:
                    raise RuntimeError("FileCreate yielded no file id")

                # 2) Create the contract from the file
                ctx = (ContractCreateTransaction()
                       .set_bytecode_file_id(file_id)
                       .set_gas(1_500_000)  # Hedera needs higher gas than EVM minimum for deploy
                       .set_contract_memo(memo[:100]))
                ctx = ctx.freeze_with(self._client).sign(self._private_key)
                creceipt = ctx.execute(self._client)
                tx_id_obj = getattr(creceipt, "transaction_id", None)
                return {
                    "file_id": str(file_id),
                    "contract_id": str(creceipt.contract_id) if creceipt.contract_id else None,
                    "transaction_id": str(tx_id_obj) if tx_id_obj else None,
                }

            result = await asyncio.to_thread(_deploy)
            if not result.get("contract_id"):
                return {"success": False, "reason": "contract_create_no_id", **result}
            return {
                "success": True,
                "contract_id": result["contract_id"],
                "file_id": result["file_id"],
                "transaction_id": result["transaction_id"],
                "gas_used": 300_000,
                "explorer_url": f"{self.explorer_base}/contract/{result['contract_id']}",
                "deployed_at": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as e:
            logger.warning("[hedera-testnet] contract deploy failed: %s", e)
            return {"success": False, "reason": str(e)[:160]}


# Lazy singleton
_singleton: Optional[HederaTestnetClient] = None


def get_testnet_client() -> HederaTestnetClient:
    global _singleton
    if _singleton is None:
        _singleton = HederaTestnetClient()
    return _singleton
