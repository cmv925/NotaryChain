"""
Storage Service - Unified file storage with S3 + local fallback
Uses S3 when AWS credentials are configured, otherwise falls back to local filesystem.
"""

import os
import uuid
import logging
import mimetypes
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

LOCAL_UPLOAD_DIR = "/tmp/notary_uploads"
os.makedirs(LOCAL_UPLOAD_DIR, exist_ok=True)


class StorageService:
    """Unified storage: S3 when configured, local filesystem otherwise."""

    def __init__(self):
        self._s3_client = None
        self._bucket = None
        self._use_s3 = False
        self._kms_key_id = os.environ.get("AWS_KMS_KEY_ID")
        self._init_s3()

    def _init_s3(self):
        bucket = os.environ.get("AWS_S3_BUCKET")
        region = os.environ.get("AWS_REGION", "us-east-1")
        access_key = os.environ.get("AWS_ACCESS_KEY_ID")
        secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")

        if bucket and access_key and secret_key:
            try:
                import boto3
                self._s3_client = boto3.client(
                    "s3",
                    region_name=region,
                    aws_access_key_id=access_key,
                    aws_secret_access_key=secret_key,
                )
                self._bucket = bucket
                self._use_s3 = True
                logger.info(f"S3 storage initialized (bucket={bucket})")
            except Exception as e:
                logger.warning(f"S3 init failed, using local storage: {e}")
        else:
            logger.info("AWS credentials not configured — using local file storage")

    @property
    def backend(self) -> str:
        return "s3" if self._use_s3 else "local"

    # ---- Upload ----

    async def upload(self, content: bytes, filename: str, folder: str = "documents") -> dict:
        """Upload file content. Returns metadata dict with `path` and `storage_backend`."""
        ext = os.path.splitext(filename)[1].lower()
        unique_name = f"{uuid.uuid4().hex}{ext}"
        key = f"{folder}/{unique_name}"

        if self._use_s3:
            return self._upload_s3(content, key, filename)
        return self._upload_local(content, key, unique_name)

    def _upload_s3(self, content: bytes, key: str, original_name: str) -> dict:
        content_type = mimetypes.guess_type(original_name)[0] or "application/octet-stream"
        self._s3_client.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=content,
            ContentType=content_type,
            Metadata={"original_name": original_name},
        )
        return {
            "path": key,
            "storage_backend": "s3",
            "bucket": self._bucket,
            "size": len(content),
        }

    def _upload_local(self, content: bytes, key: str, unique_name: str) -> dict:
        filepath = os.path.join(LOCAL_UPLOAD_DIR, unique_name)
        with open(filepath, "wb") as f:
            f.write(content)
        return {
            "path": unique_name,
            "storage_backend": "local",
            "size": len(content),
        }

    # ---- Download / Read ----

    async def get_file_path(self, path: str, storage_backend: str = "local") -> Optional[str]:
        """Return a local filepath that can be served. Downloads from S3 if needed."""
        if storage_backend == "s3" and self._use_s3:
            return self._download_s3_to_temp(path)

        # Local file
        local_path = os.path.join(LOCAL_UPLOAD_DIR, os.path.basename(path))
        if os.path.exists(local_path):
            return local_path
        return None

    def _download_s3_to_temp(self, key: str) -> Optional[str]:
        try:
            local_tmp = os.path.join(LOCAL_UPLOAD_DIR, f"s3_cache_{os.path.basename(key)}")
            if os.path.exists(local_tmp):
                return local_tmp
            self._s3_client.download_file(self._bucket, key, local_tmp)
            return local_tmp
        except Exception as e:
            logger.error(f"S3 download failed for {key}: {e}")
            return None

    # ---- Delete ----

    async def delete(self, path: str, storage_backend: str = "local") -> bool:
        if storage_backend == "s3" and self._use_s3:
            return self._delete_s3(path)
        return self._delete_local(path)

    def _delete_s3(self, key: str) -> bool:
        try:
            self._s3_client.delete_object(Bucket=self._bucket, Key=key)
            return True
        except Exception as e:
            logger.error(f"S3 delete failed for {key}: {e}")
            return False

    def _delete_local(self, path: str) -> bool:
        local_path = os.path.join(LOCAL_UPLOAD_DIR, os.path.basename(path))
        if os.path.exists(local_path):
            os.remove(local_path)
            return True
        return False

    # ---- Presigned URL (S3 only) ----

    def get_presigned_url(self, key: str, expires_in: int = 3600) -> Optional[str]:
        if not self._use_s3:
            return None
        try:
            return self._s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self._bucket, "Key": key},
                ExpiresIn=expires_in,
            )
        except Exception as e:
            logger.error(f"Presigned URL generation failed: {e}")
            return None

    def status(self) -> dict:
        return {
            "backend": self.backend,
            "s3_configured": self._use_s3,
            "bucket": self._bucket if self._use_s3 else None,
            "local_dir": LOCAL_UPLOAD_DIR,
        }

    # ──────────────────────────────────────────────────────────────────────
    #  Multipart upload + integrity primitives (large video files).
    #  These are SYNCHRONOUS (blocking boto3) and MUST be invoked from async
    #  routes via `asyncio.to_thread(...)` so they never block the event loop.
    # ──────────────────────────────────────────────────────────────────────

    @property
    def s3_ready(self) -> bool:
        return self._use_s3

    def _sse_args(self) -> dict:
        if self._kms_key_id:
            return {"ServerSideEncryption": "aws:kms", "SSEKMSKeyId": self._kms_key_id}
        return {"ServerSideEncryption": "AES256"}

    def create_multipart_upload(self, key: str, content_type: str = "video/mp4") -> str:
        """Initiate an S3 multipart upload (SSE enforced). Returns the UploadId."""
        resp = self._s3_client.create_multipart_upload(
            Bucket=self._bucket,
            Key=key,
            ContentType=content_type,
            **self._sse_args(),
        )
        return resp["UploadId"]

    def upload_part(self, key: str, upload_id: str, part_number: int, fileobj) -> str:
        """Upload one part from a file-like object. Returns the part ETag."""
        resp = self._s3_client.upload_part(
            Bucket=self._bucket,
            Key=key,
            UploadId=upload_id,
            PartNumber=part_number,
            Body=fileobj,
        )
        return resp["ETag"]

    def complete_multipart_upload(self, key: str, upload_id: str, parts: list) -> dict:
        """Complete a multipart upload. `parts` = [{part_number, etag}, ...]."""
        payload = {
            "Parts": [
                {"PartNumber": p["part_number"], "ETag": p["etag"]}
                for p in sorted(parts, key=lambda x: x["part_number"])
            ]
        }
        return self._s3_client.complete_multipart_upload(
            Bucket=self._bucket,
            Key=key,
            UploadId=upload_id,
            MultipartUpload=payload,
        )

    def abort_multipart_upload(self, key: str, upload_id: str) -> bool:
        try:
            self._s3_client.abort_multipart_upload(Bucket=self._bucket, Key=key, UploadId=upload_id)
            return True
        except Exception as e:
            logger.warning(f"abort_multipart_upload failed for {key}: {e}")
            return False

    def compute_sha256(self, key: str, chunk_size: int = 8 * 1024 * 1024) -> str:
        """Stream the assembled object from S3 and compute its full SHA-256 (low memory)."""
        import hashlib
        obj = self._s3_client.get_object(Bucket=self._bucket, Key=key)
        body = obj["Body"]
        sha = hashlib.sha256()
        try:
            while True:
                data = body.read(chunk_size)
                if not data:
                    break
                sha.update(data)
        finally:
            body.close()
        return sha.hexdigest()

    def apply_object_lock(self, key: str, retain_until, mode: str = "COMPLIANCE", version_id: str = None) -> bool:
        """Apply S3 Object Lock (WORM) retention. Graceful: returns False if the bucket
        isn't Object-Lock-enabled rather than raising."""
        try:
            params = {
                "Bucket": self._bucket,
                "Key": key,
                "Retention": {"Mode": mode, "RetainUntilDate": retain_until},
            }
            if version_id:
                params["VersionId"] = version_id
            self._s3_client.put_object_retention(**params)
            return True
        except Exception as e:
            logger.warning(f"apply_object_lock not applied for {key} (bucket may lack Object Lock): {e}")
            return False

    def head_size(self, key: str) -> int:
        try:
            resp = self._s3_client.head_object(Bucket=self._bucket, Key=key)
            return resp.get("ContentLength", 0)
        except Exception:
            return 0


async def apply_fl_retention_lock(object_ref: str, retain_until) -> bool:
    """
    Apply S3 Object Lock (compliance mode) to an FL ceremony asset, retaining until
    `retain_until` (datetime). Returns True if the lock was applied or already in place,
    False if S3 isn't configured or the call failed.

    The object_ref may be a full s3:// URI or a plain key. Bucket-level Object Lock must
    be enabled at bucket creation (one-time setup); this only sets the per-object retention.
    """
    if not storage_service._use_s3:
        logger.info("apply_fl_retention_lock: S3 not configured (dev/local mode)")
        return False
    try:
        # Parse key
        key = object_ref
        if object_ref.startswith("s3://"):
            without = object_ref[5:]
            parts = without.split("/", 1)
            if len(parts) == 2:
                key = parts[1]
        # Apply object retention
        storage_service._s3_client.put_object_retention(
            Bucket=storage_service._bucket,
            Key=key,
            Retention={
                "Mode": "COMPLIANCE",
                "RetainUntilDate": retain_until,
            },
        )
        # Tag for lifecycle/audit
        try:
            storage_service._s3_client.put_object_tagging(
                Bucket=storage_service._bucket,
                Key=key,
                Tagging={"TagSet": [
                    {"Key": "retention_policy", "Value": "FL_10YR"},
                    {"Key": "jurisdiction", "Value": "FL"},
                ]},
            )
        except Exception as tag_err:
            logger.warning(f"apply_fl_retention_lock: tagging failed (lock still applied): {tag_err}")
        return True
    except Exception as e:
        logger.warning(f"apply_fl_retention_lock failed for {object_ref}: {e}")
        return False


# Singleton
storage_service = StorageService()
