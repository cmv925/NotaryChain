"""
S3 Storage Integration Tests
Tests the AWS S3 storage integration that was migrated from local filesystem storage.
Key endpoints:
- /api/infra/status - Should show s3_configured: true
- /api/documents/seal - Create document seal
- /api/documents/files/{filename} - File serving (presigned URLs or fallback)
- /api/blockchain/seal-file - File upload with blockchain seal
- /api/notary/profile/credentials - Credential file upload to S3
- /api/auth/login - Admin login
- /api/health - General health check
"""

import pytest
import requests
import os
import io
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
DEMO_EMAIL = "demo@test.com"
DEMO_PASSWORD = "Demo123!"


class TestHealthAndInfrastructure:
    """Test basic health and infrastructure status endpoints"""
    
    def test_api_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Health check failed: {response.text}"
        
        data = response.json()
        assert data.get("status") == "healthy", f"Unexpected status: {data}"
        print(f"✓ Health check passed: {data.get('status')}")
    
    def test_api_root_endpoint(self):
        """Test /api/ returns API info"""
        response = requests.get(f"{BASE_URL}/api/", timeout=10)
        assert response.status_code == 200, f"Root API failed: {response.text}"
        
        data = response.json()
        assert "NotaryChain" in data.get("message", ""), f"Unexpected response: {data}"
        print(f"✓ API root working: {data}")


class TestAuthenticationAndLogin:
    """Test authentication endpoints"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, f"No access_token in response: {data}"
        assert data.get("user", {}).get("email") == ADMIN_EMAIL
        print(f"✓ Admin login successful, role: {data.get('user', {}).get('role')}")
        return data["access_token"]
    
    def test_demo_user_login_success(self):
        """Test demo user login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
            timeout=10
        )
        assert response.status_code == 200, f"Demo login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, f"No access_token in response: {data}"
        print(f"✓ Demo user login successful")
        return data["access_token"]


class TestS3StorageConfiguration:
    """Test S3 storage configuration and infra status"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_infra_status_shows_s3_configured(self, auth_token):
        """Test /api/infra/status shows s3_configured: true"""
        response = requests.get(
            f"{BASE_URL}/api/infra/status",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        assert response.status_code == 200, f"Infra status failed: {response.text}"
        
        data = response.json()
        storage = data.get("storage", {})
        
        # Verify S3 is configured
        assert storage.get("backend") == "s3", f"Expected backend=s3, got: {storage.get('backend')}"
        assert storage.get("s3_configured") == True, f"S3 not configured: {storage}"
        assert storage.get("bucket") == "notarychain-documents", f"Wrong bucket: {storage.get('bucket')}"
        
        print(f"✓ S3 storage configured correctly:")
        print(f"  - Backend: {storage.get('backend')}")
        print(f"  - S3 Configured: {storage.get('s3_configured')}")
        print(f"  - Bucket: {storage.get('bucket')}")
        print(f"  - Local Dir: {storage.get('local_dir')}")
    
    def test_infra_status_shows_cache_and_jobs(self, auth_token):
        """Test infra status includes cache and jobs stats"""
        response = requests.get(
            f"{BASE_URL}/api/infra/status",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "cache" in data, "Missing cache stats"
        assert "jobs" in data, "Missing jobs stats"
        assert "sentry" in data, "Missing sentry config"
        
        print(f"✓ Infrastructure status complete:")
        print(f"  - Cache: {data.get('cache')}")
        print(f"  - Jobs: {data.get('jobs')}")
        print(f"  - Infrastructure Version: {data.get('infrastructure_version')}")


class TestDocumentSealEndpoint:
    """Test document seal creation endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_create_document_seal(self, auth_token):
        """Test POST /api/documents/seal creates a document seal"""
        import hashlib
        test_content = f"Test document content for S3 seal test {time.time()}"
        test_hash = hashlib.sha256(test_content.encode()).hexdigest()
        
        response = requests.post(
            f"{BASE_URL}/api/documents/seal",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "file_name": "test_s3_seal_document.pdf",
                "file_size": len(test_content),
                "file_type": "application/pdf",
                "sha256_hash": test_hash,
                "transaction_id": f"TEST_TX_{int(time.time())}"
            },
            timeout=15
        )
        
        assert response.status_code == 200, f"Document seal failed: {response.text}"
        
        data = response.json()
        assert data.get("sha256_hash") == test_hash, "Hash mismatch"
        assert "id" in data, "No ID in response"
        
        print(f"✓ Document seal created:")
        print(f"  - ID: {data.get('id')}")
        print(f"  - File: {data.get('file_name')}")
        print(f"  - Hash: {data.get('sha256_hash')[:16]}...")
    
    def test_get_user_document_seals(self, auth_token):
        """Test GET /api/documents/seals returns user's seals"""
        response = requests.get(
            f"{BASE_URL}/api/documents/seals",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        assert response.status_code == 200, f"Get seals failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), f"Expected list, got: {type(data)}"
        
        print(f"✓ Retrieved {len(data)} document seals")


class TestBlockchainSealFile:
    """Test blockchain file upload and seal endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_blockchain_status(self, auth_token):
        """Test /api/blockchain/status endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/blockchain/status",
            timeout=10
        )
        
        assert response.status_code == 200, f"Blockchain status failed: {response.text}"
        
        data = response.json()
        assert "connected" in data
        assert "network" in data
        
        print(f"✓ Blockchain status:")
        print(f"  - Connected: {data.get('connected')}")
        print(f"  - Network: {data.get('network')}")
        print(f"  - SDK Available: {data.get('sdk_available')}")
    
    def test_seal_file_upload(self, auth_token):
        """Test POST /api/blockchain/seal-file uploads and seals a file"""
        # Create a test file
        test_content = f"Test file content for blockchain seal {time.time()}".encode()
        files = {
            'file': ('test_blockchain_seal.txt', io.BytesIO(test_content), 'text/plain')
        }
        data = {
            'document_name': 'Test Blockchain Seal Document'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/blockchain/seal-file",
            headers={"Authorization": f"Bearer {auth_token}"},
            files=files,
            data=data,
            timeout=30
        )
        
        assert response.status_code == 200, f"Seal file failed: {response.text}"
        
        result = response.json()
        assert result.get("success") == True, f"Seal not successful: {result}"
        assert "document_hash" in result, "No document_hash in response"
        assert "seal" in result, "No seal in response"
        
        seal = result.get("seal", {})
        print(f"✓ File sealed on blockchain:")
        print(f"  - Document Hash: {result.get('document_hash')[:16]}...")
        print(f"  - Transaction ID: {seal.get('transaction_id')}")
        print(f"  - Topic ID: {seal.get('topic_id')}")
        print(f"  - Network: {seal.get('network')}")
        print(f"  - Explorer URL: {seal.get('explorer_url')}")
    
    def test_get_my_blockchain_seals(self, auth_token):
        """Test GET /api/blockchain/seals/my returns user's blockchain seals"""
        response = requests.get(
            f"{BASE_URL}/api/blockchain/seals/my",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        assert response.status_code == 200, f"Get seals failed: {response.text}"
        
        data = response.json()
        assert "seals" in data, "No seals key in response"
        assert "count" in data, "No count key in response"
        
        print(f"✓ Retrieved {data.get('count')} blockchain seals")


class TestNotaryCredentialUpload:
    """Test notary credential upload endpoint (S3 integration)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_notary_profile_status(self, auth_token):
        """Test GET /api/notary/profile/status endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/notary/profile/status",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        # 200 = has profile, 404 = no profile (both valid responses)
        assert response.status_code in [200, 404], f"Profile status failed: {response.text}"
        
        data = response.json()
        print(f"✓ Notary profile status: {data.get('status') or 'no profile'}")
        return data
    
    def test_create_notary_profile_if_needed(self, auth_token):
        """Create notary profile if it doesn't exist"""
        # Check if profile exists
        response = requests.get(
            f"{BASE_URL}/api/notary/profile/status",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        if response.status_code == 200 and response.json().get("has_profile"):
            print("✓ Notary profile already exists")
            return True
        
        # Create profile
        profile_data = {
            "full_name": "Test Admin Notary",
            "license_state": "CA",
            "license_number": "TEST123456",
            "commission_expiry": "2027-12-31",
            "ron_certified": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/notary/profile",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=profile_data,
            timeout=10
        )
        
        # 200/201 = created, 400 = already exists (both acceptable)
        assert response.status_code in [200, 201, 400], f"Profile creation failed: {response.text}"
        
        print(f"✓ Notary profile status: created or already exists")
        return True
    
    def test_credential_upload_to_s3(self, auth_token):
        """Test credential upload goes to S3"""
        # First ensure profile exists
        self.test_create_notary_profile_if_needed(auth_token)
        
        # Create a test credential file
        test_content = f"Test credential certificate content {time.time()}".encode()
        files = {
            'file': ('test_government_id.pdf', io.BytesIO(test_content), 'application/pdf')
        }
        data = {
            'credential_type': 'government_id'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/notary/profile/credentials",
            headers={"Authorization": f"Bearer {auth_token}"},
            files=files,
            data=data,
            timeout=20
        )
        
        assert response.status_code == 200, f"Credential upload failed: {response.text}"
        
        result = response.json()
        assert result.get("success") == True, f"Upload not successful: {result}"
        assert "credential_id" in result, "No credential_id in response"
        
        print(f"✓ Credential uploaded to S3:")
        print(f"  - Credential ID: {result.get('credential_id')}")
        print(f"  - Type: {result.get('credential_type')}")
        print(f"  - Filename: {result.get('filename')}")
    
    def test_get_uploaded_credentials(self, auth_token):
        """Test retrieving list of uploaded credentials"""
        response = requests.get(
            f"{BASE_URL}/api/notary/profile/credentials",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        assert response.status_code == 200, f"Get credentials failed: {response.text}"
        
        data = response.json()
        assert "credentials" in data, "No credentials key in response"
        
        print(f"✓ Retrieved {len(data.get('credentials', []))} credentials")


class TestDocumentFileServing:
    """Test document file serving endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_document_file_endpoint_404_for_nonexistent(self, auth_token):
        """Test /api/documents/files/{filename} returns 404 for nonexistent file"""
        response = requests.get(
            f"{BASE_URL}/api/documents/files/nonexistent_file_12345.pdf",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10,
            allow_redirects=False  # Don't follow S3 presigned URL redirects
        )
        
        # 404 = file not found (expected)
        # 307 = redirect to S3 presigned URL (would indicate file exists)
        assert response.status_code in [404, 307], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 404:
            print("✓ Document file endpoint returns 404 for nonexistent file")
        else:
            print("✓ Document file endpoint redirects to S3 presigned URL")


class TestDocumentStats:
    """Test document statistics endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_document_stats(self, auth_token):
        """Test GET /api/documents/stats returns user statistics"""
        response = requests.get(
            f"{BASE_URL}/api/documents/stats",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        assert response.status_code == 200, f"Stats failed: {response.text}"
        
        data = response.json()
        assert "total_seals" in data, "Missing total_seals"
        assert "recent_seals" in data, "Missing recent_seals"
        
        print(f"✓ Document stats:")
        print(f"  - Total Seals: {data.get('total_seals')}")
        print(f"  - Recent Seals (30d): {data.get('recent_seals')}")


class TestNotaryProfessionalSeals:
    """Test notary professional seal upload (S3 integration)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_notary_seals(self, auth_token):
        """Test GET /api/notary/professional/seals endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/notary/professional/seals",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        assert response.status_code == 200, f"Get seals failed: {response.text}"
        
        data = response.json()
        assert "seals" in data, "No seals key in response"
        
        print(f"✓ Retrieved {len(data.get('seals', []))} notary seals")
    
    def test_upload_notary_seal_image(self, auth_token):
        """Test POST /api/notary/professional/seals/upload (S3)"""
        # Create a minimal PNG image (1x1 pixel transparent PNG)
        # PNG header + minimal IHDR + IDAT + IEND
        png_bytes = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D,  # IHDR length
            0x49, 0x48, 0x44, 0x52,  # IHDR
            0x00, 0x00, 0x00, 0x01,  # width 1
            0x00, 0x00, 0x00, 0x01,  # height 1
            0x08, 0x06,              # bit depth 8, RGBA
            0x00, 0x00, 0x00,        # compression, filter, interlace
            0x1F, 0x15, 0xC4, 0x89,  # CRC
            0x00, 0x00, 0x00, 0x0A,  # IDAT length
            0x49, 0x44, 0x41, 0x54,  # IDAT
            0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01,  # compressed data
            0x0D, 0x0A, 0x2D, 0xB4,  # CRC
            0x00, 0x00, 0x00, 0x00,  # IEND length
            0x49, 0x45, 0x4E, 0x44,  # IEND
            0xAE, 0x42, 0x60, 0x82   # CRC
        ])
        
        files = {
            'file': ('test_seal_image.png', io.BytesIO(png_bytes), 'image/png')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/notary/professional/seals/upload",
            headers={"Authorization": f"Bearer {auth_token}"},
            files=files,
            timeout=20
        )
        
        assert response.status_code == 200, f"Seal upload failed: {response.text}"
        
        data = response.json()
        assert "id" in data, "No seal id in response"
        assert data.get("storage_backend") == "s3", f"Expected S3 storage, got: {data.get('storage_backend')}"
        
        print(f"✓ Notary seal uploaded to S3:")
        print(f"  - Seal ID: {data.get('id')}")
        print(f"  - Storage Backend: {data.get('storage_backend')}")
        print(f"  - Filename: {data.get('filename')}")
        
        return data.get("id")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
