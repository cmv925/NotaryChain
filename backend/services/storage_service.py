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


# Singleton
storage_service = StorageService()
