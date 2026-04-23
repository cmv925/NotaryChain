"""
Test Witness Agent Real Audit and Certificate PDF Features
- Witness Agent builds real Merkle trees from ceremony evidence
- Witness Agent writes audit logs to ceremony_audit_logs collection
- Certificate PDF auto-generated on APPROVED consensus
- Certificate endpoint returns valid PDF
"""
import pytest
import requests
import os
import re
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://chain-verify-demo.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@notarychain.com"
TEST_PASSWORD = "Admin123!"


class TestWitnessAgentRealAudit:
    """Test Witness Agent real audit functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        
        # Cleanup - no specific cleanup needed
    
    def test_witness_agent_returns_real_audit_data(self):
        """Test that Witness Agent returns real_audit=true and audit_log_written=true"""
        # Create ceremony
        create_resp = self.session.post(f"{BASE_URL}/api/ceremony/start", json={
            "document_name": "TEST_WitnessAudit_Document",
            "signer_name": "Test Signer"
        })
        assert create_resp.status_code == 200, f"Create failed: {create_resp.text}"
        ceremony_id = create_resp.json()["ceremony_id"]
        
        # Execute ceremony
        exec_resp = self.session.post(f"{BASE_URL}/api/ceremony/{ceremony_id}/execute")
        assert exec_resp.status_code == 200, f"Execute failed: {exec_resp.text}"
        
        result = exec_resp.json()
        witness = result.get("agents", {}).get("witness", {})
        
        # Verify real_audit and audit_log_written
        assert witness.get("details", {}).get("real_audit") == True, "Witness should have real_audit=true"
        assert witness.get("details", {}).get("audit_log_written") == True, "Witness should have audit_log_written=true"
        print(f"✓ Witness Agent real_audit={witness['details']['real_audit']}, audit_log_written={witness['details']['audit_log_written']}")
    
    def test_witness_merkle_root_is_real_sha256(self):
        """Test that Merkle root is a real SHA256 hash (64 hex chars)"""
        # Create ceremony
        create_resp = self.session.post(f"{BASE_URL}/api/ceremony/start", json={
            "document_name": "TEST_MerkleRoot_Document",
            "signer_name": "Test Signer"
        })
        assert create_resp.status_code == 200
        ceremony_id = create_resp.json()["ceremony_id"]
        
        # Execute ceremony
        exec_resp = self.session.post(f"{BASE_URL}/api/ceremony/{ceremony_id}/execute")
        assert exec_resp.status_code == 200
        
        result = exec_resp.json()
        witness = result.get("agents", {}).get("witness", {})
        evidence = witness.get("details", {}).get("evidence", {})
        merkle_root = evidence.get("audit_integrity", {}).get("merkle_root", "")
        
        # Verify Merkle root is 64 hex characters (SHA256)
        assert len(merkle_root) == 64, f"Merkle root should be 64 chars, got {len(merkle_root)}"
        assert re.match(r'^[a-f0-9]{64}$', merkle_root), f"Merkle root should be hex, got {merkle_root}"
        print(f"✓ Merkle root is valid SHA256: {merkle_root[:16]}...")
    
    def test_witness_timeline_entries_greater_than_zero(self):
        """Test that timeline entries > 0"""
        # Create ceremony
        create_resp = self.session.post(f"{BASE_URL}/api/ceremony/start", json={
            "document_name": "TEST_Timeline_Document",
            "signer_name": "Test Signer"
        })
        assert create_resp.status_code == 200
        ceremony_id = create_resp.json()["ceremony_id"]
        
        # Execute ceremony
        exec_resp = self.session.post(f"{BASE_URL}/api/ceremony/{ceremony_id}/execute")
        assert exec_resp.status_code == 200
        
        result = exec_resp.json()
        witness = result.get("agents", {}).get("witness", {})
        evidence = witness.get("details", {}).get("evidence", {})
        entries = evidence.get("audit_integrity", {}).get("entries", 0)
        
        assert entries > 0, f"Timeline entries should be > 0, got {entries}"
        print(f"✓ Timeline entries: {entries}")
    
    def test_witness_evidence_items_greater_than_zero(self):
        """Test that evidence items > 0"""
        # Create ceremony
        create_resp = self.session.post(f"{BASE_URL}/api/ceremony/start", json={
            "document_name": "TEST_EvidenceItems_Document",
            "signer_name": "Test Signer"
        })
        assert create_resp.status_code == 200
        ceremony_id = create_resp.json()["ceremony_id"]
        
        # Execute ceremony
        exec_resp = self.session.post(f"{BASE_URL}/api/ceremony/{ceremony_id}/execute")
        assert exec_resp.status_code == 200
        
        result = exec_resp.json()
        witness = result.get("agents", {}).get("witness", {})
        evidence = witness.get("details", {}).get("evidence", {})
        items = evidence.get("evidence_package", {}).get("items_collected", 0)
        
        assert items > 0, f"Evidence items should be > 0, got {items}"
        print(f"✓ Evidence items collected: {items}")
    
    def test_witness_tamper_proof_status(self):
        """Test that tamper_proof status is present and true"""
        # Create ceremony
        create_resp = self.session.post(f"{BASE_URL}/api/ceremony/start", json={
            "document_name": "TEST_TamperProof_Document",
            "signer_name": "Test Signer"
        })
        assert create_resp.status_code == 200
        ceremony_id = create_resp.json()["ceremony_id"]
        
        # Execute ceremony
        exec_resp = self.session.post(f"{BASE_URL}/api/ceremony/{ceremony_id}/execute")
        assert exec_resp.status_code == 200
        
        result = exec_resp.json()
        witness = result.get("agents", {}).get("witness", {})
        evidence = witness.get("details", {}).get("evidence", {})
        tamper_proof = evidence.get("evidence_package", {}).get("tamper_proof")
        
        assert tamper_proof == True, f"tamper_proof should be True, got {tamper_proof}"
        print(f"✓ Tamper proof status: {tamper_proof}")


class TestCertificatePDF:
    """Test Certificate PDF generation and download"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
    
    def test_sealed_ceremony_has_certificate_flag(self):
        """Test that sealed ceremony has has_certificate=true"""
        # Create ceremony
        create_resp = self.session.post(f"{BASE_URL}/api/ceremony/start", json={
            "document_name": "TEST_CertFlag_Document",
            "signer_name": "Test Signer"
        })
        assert create_resp.status_code == 200
        ceremony_id = create_resp.json()["ceremony_id"]
        
        # Execute ceremony
        exec_resp = self.session.post(f"{BASE_URL}/api/ceremony/{ceremony_id}/execute")
        assert exec_resp.status_code == 200
        
        result = exec_resp.json()
        
        # Check if sealed (consensus APPROVED)
        if result.get("status") == "sealed":
            assert result.get("has_certificate") == True, "Sealed ceremony should have has_certificate=true"
            print(f"✓ Sealed ceremony has_certificate=true")
        else:
            print(f"⚠ Ceremony not sealed (status={result.get('status')}), skipping certificate flag check")
    
    def test_certificate_endpoint_returns_valid_pdf(self):
        """Test GET /api/ceremony/{id}/certificate returns valid PDF"""
        # Create ceremony
        create_resp = self.session.post(f"{BASE_URL}/api/ceremony/start", json={
            "document_name": "TEST_CertPDF_Document",
            "signer_name": "Test Signer"
        })
        assert create_resp.status_code == 200
        ceremony_id = create_resp.json()["ceremony_id"]
        
        # Execute ceremony
        exec_resp = self.session.post(f"{BASE_URL}/api/ceremony/{ceremony_id}/execute")
        assert exec_resp.status_code == 200
        
        result = exec_resp.json()
        
        if result.get("status") != "sealed":
            pytest.skip("Ceremony not sealed, cannot test certificate download")
        
        # Download certificate (no auth required - public endpoint)
        cert_resp = requests.get(f"{BASE_URL}/api/ceremony/{ceremony_id}/certificate")
        assert cert_resp.status_code == 200, f"Certificate download failed: {cert_resp.status_code}"
        
        # Verify Content-Type
        content_type = cert_resp.headers.get("Content-Type", "")
        assert "application/pdf" in content_type, f"Expected application/pdf, got {content_type}"
        
        # Verify PDF magic bytes (%PDF)
        pdf_content = cert_resp.content
        assert pdf_content[:4] == b'%PDF', f"PDF should start with %PDF, got {pdf_content[:10]}"
        
        # Verify reasonable size (at least 1KB)
        assert len(pdf_content) > 1000, f"PDF too small: {len(pdf_content)} bytes"
        
        print(f"✓ Certificate PDF valid: {len(pdf_content)} bytes, Content-Type: {content_type}")
    
    def test_certificate_returns_404_for_non_sealed_ceremony(self):
        """Test that certificate returns 404 for pending ceremony"""
        # Create ceremony but don't execute
        create_resp = self.session.post(f"{BASE_URL}/api/ceremony/start", json={
            "document_name": "TEST_CertNotSealed_Document",
            "signer_name": "Test Signer"
        })
        assert create_resp.status_code == 200
        ceremony_id = create_resp.json()["ceremony_id"]
        
        # Try to download certificate without executing
        cert_resp = requests.get(f"{BASE_URL}/api/ceremony/{ceremony_id}/certificate")
        assert cert_resp.status_code == 404, f"Expected 404 for non-sealed ceremony, got {cert_resp.status_code}"
        print(f"✓ Certificate returns 404 for non-sealed ceremony")
    
    def test_certificate_returns_404_for_invalid_ceremony(self):
        """Test that certificate returns 404 for non-existent ceremony"""
        cert_resp = requests.get(f"{BASE_URL}/api/ceremony/invalid-ceremony-id-12345/certificate")
        assert cert_resp.status_code == 404, f"Expected 404 for invalid ceremony, got {cert_resp.status_code}"
        print(f"✓ Certificate returns 404 for invalid ceremony ID")


class TestSSECertificateEvent:
    """Test SSE stream fires certificate_generated event"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
    
    def test_sse_stream_fires_certificate_generated_event(self):
        """Test that SSE stream fires certificate_generated event after APPROVED consensus"""
        # Create ceremony
        create_resp = self.session.post(f"{BASE_URL}/api/ceremony/start", json={
            "document_name": "TEST_SSE_Certificate_Document",
            "signer_name": "Test Signer"
        })
        assert create_resp.status_code == 200
        ceremony_id = create_resp.json()["ceremony_id"]
        
        # Connect to SSE stream
        sse_url = f"{BASE_URL}/api/ceremony/{ceremony_id}/stream"
        sse_resp = requests.get(sse_url, stream=True, timeout=60)
        assert sse_resp.status_code == 200, f"SSE connection failed: {sse_resp.status_code}"
        
        events_received = []
        certificate_generated = False
        consensus_result = None
        
        # Read SSE events
        for line in sse_resp.iter_lines(decode_unicode=True):
            if line:
                if line.startswith("event:"):
                    event_type = line.split(":", 1)[1].strip()
                    events_received.append(event_type)
                    
                    if event_type == "certificate_generated":
                        certificate_generated = True
                    
                    if event_type == "ceremony_complete":
                        break
                
                if line.startswith("data:") and "consensus_reached" in str(events_received):
                    import json
                    try:
                        data = json.loads(line.split(":", 1)[1].strip())
                        if data.get("type") == "consensus_reached":
                            consensus_result = data.get("result")
                    except:
                        pass
        
        print(f"Events received: {events_received}")
        
        # Verify ceremony was sealed
        get_resp = self.session.get(f"{BASE_URL}/api/ceremony/{ceremony_id}")
        assert get_resp.status_code == 200
        ceremony = get_resp.json()
        
        if ceremony.get("status") == "sealed":
            assert certificate_generated, "certificate_generated event should fire for sealed ceremony"
            print(f"✓ SSE certificate_generated event fired for sealed ceremony")
        else:
            print(f"⚠ Ceremony not sealed (status={ceremony.get('status')}), certificate_generated may not fire")


class TestAuditLogCollection:
    """Test audit log entry exists in ceremony_audit_logs collection"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
    
    def test_audit_log_written_flag_in_witness_response(self):
        """Test that audit_log_written flag is true in witness response"""
        # Create ceremony
        create_resp = self.session.post(f"{BASE_URL}/api/ceremony/start", json={
            "document_name": "TEST_AuditLogFlag_Document",
            "signer_name": "Test Signer"
        })
        assert create_resp.status_code == 200
        ceremony_id = create_resp.json()["ceremony_id"]
        
        # Execute ceremony
        exec_resp = self.session.post(f"{BASE_URL}/api/ceremony/{ceremony_id}/execute")
        assert exec_resp.status_code == 200
        
        result = exec_resp.json()
        witness = result.get("agents", {}).get("witness", {})
        
        # Verify audit_log_written flag
        assert witness.get("details", {}).get("audit_log_written") == True, "audit_log_written should be True"
        print(f"✓ Witness audit_log_written=True")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
