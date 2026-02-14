"""
Tests for AI Document Analysis and Biometric Verification Endpoints
Tests: /api/ai/analyze-document, /api/ai/verify-biometric, /api/auth endpoints
"""

import pytest
import requests
import os
import io
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials
TEST_EMAIL = "testuser@example.com"
TEST_PASSWORD = "Test123!"
TEST_NAME = "Test User"


class TestAuthFlow:
    """Authentication endpoint tests"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create requests session"""
        return requests.Session()
    
    def test_api_root(self, session):
        """Test if API is accessible"""
        response = session.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"API root not accessible: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ API root accessible: {data}")
    
    def test_signup_or_login(self, session):
        """Test signup (or login if user exists)"""
        # Try to signup first
        signup_response = session.post(
            f"{BASE_URL}/api/auth/signup",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "full_name": TEST_NAME
            }
        )
        
        if signup_response.status_code == 200:
            # New user created
            data = signup_response.json()
            assert "access_token" in data
            print(f"✓ New user created and token received")
            return data["access_token"]
        elif signup_response.status_code == 400:
            # User already exists, try login
            login_response = session.post(
                f"{BASE_URL}/api/auth/login",
                json={
                    "email": TEST_EMAIL,
                    "password": TEST_PASSWORD
                }
            )
            assert login_response.status_code == 200, f"Login failed: {login_response.text}"
            data = login_response.json()
            assert "access_token" in data
            print(f"✓ User already exists, logged in successfully")
            return data["access_token"]
        else:
            pytest.fail(f"Unexpected signup response: {signup_response.status_code} - {signup_response.text}")


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    session = requests.Session()
    
    # Try signup first
    signup_response = session.post(
        f"{BASE_URL}/api/auth/signup",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "full_name": TEST_NAME
        }
    )
    
    if signup_response.status_code == 200:
        return signup_response.json()["access_token"]
    
    # User exists, try login
    login_response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
    )
    
    if login_response.status_code == 200:
        return login_response.json()["access_token"]
    
    pytest.skip(f"Could not authenticate: {login_response.text}")


@pytest.fixture(scope="module")
def authenticated_session(auth_token):
    """Create authenticated session"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Accept": "application/json"
    })
    return session


class TestAIDocumentAnalysis:
    """Test AI Document Analysis endpoints"""
    
    def test_analyze_document_with_text_file(self, authenticated_session):
        """Test document analysis with a simple text file"""
        # Create a test document
        test_content = """
        POWER OF ATTORNEY
        
        I, John Smith, residing at 123 Main Street, New York, NY 10001,
        hereby appoint Jane Doe as my attorney-in-fact.
        
        Date: January 15, 2026
        
        Signature: ___________________
        """
        
        files = {
            'file': ('test_document.txt', io.BytesIO(test_content.encode()), 'text/plain')
        }
        data = {
            'document_type': 'power_of_attorney',
            'session_id': f'test_session_{datetime.now().timestamp()}'
        }
        
        response = authenticated_session.post(
            f"{BASE_URL}/api/ai/analyze-document",
            files=files,
            data=data
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:500]}...")
        
        assert response.status_code == 200, f"Document analysis failed: {response.text}"
        
        result = response.json()
        assert result.get("success") == True, f"Analysis not successful: {result}"
        assert "analysis_id" in result, "No analysis_id returned"
        assert "analysis" in result, "No analysis data returned"
        
        analysis = result["analysis"]
        assert "confidence_score" in analysis, "No confidence_score in analysis"
        assert "status" in analysis, "No status in analysis"
        assert "discrepancies" in analysis, "No discrepancies in analysis"
        
        print(f"✓ Document analyzed successfully")
        print(f"  - Analysis ID: {result['analysis_id']}")
        print(f"  - Confidence Score: {analysis['confidence_score']}")
        print(f"  - Status: {analysis['status']}")
        print(f"  - Discrepancies: {len(analysis.get('discrepancies', []))}")
        
        return result
    
    def test_analyze_document_general_type(self, authenticated_session):
        """Test document analysis with general document type"""
        test_content = """
        Agreement Between Parties
        
        This is a simple test contract.
        Party A: Alice Johnson
        Party B: Bob Williams
        
        Terms: This agreement is effective from January 1, 2026.
        """
        
        files = {
            'file': ('general_doc.txt', io.BytesIO(test_content.encode()), 'text/plain')
        }
        data = {
            'document_type': 'general',
            'session_id': f'test_session_general_{datetime.now().timestamp()}'
        }
        
        response = authenticated_session.post(
            f"{BASE_URL}/api/ai/analyze-document",
            files=files,
            data=data
        )
        
        assert response.status_code == 200, f"General document analysis failed: {response.text}"
        result = response.json()
        assert result.get("success") == True
        print(f"✓ General document analyzed with confidence: {result['analysis'].get('confidence_score')}")
    
    def test_analyze_document_without_auth(self):
        """Test document analysis without authentication - should fail"""
        session = requests.Session()
        
        files = {
            'file': ('test.txt', io.BytesIO(b'Test content'), 'text/plain')
        }
        data = {'document_type': 'general'}
        
        response = session.post(
            f"{BASE_URL}/api/ai/analyze-document",
            files=files,
            data=data
        )
        
        # Should return 401 or 403
        assert response.status_code in [401, 403], f"Unauthorized access not blocked: {response.status_code}"
        print(f"✓ Unauthorized access blocked correctly: {response.status_code}")


class TestBiometricVerification:
    """Test Biometric Verification endpoints"""
    
    def test_verify_biometric_high_confidence(self, authenticated_session):
        """Test biometric verification with high confidence score (should pass)"""
        data = {
            'verification_type': 'facial',
            'session_id': f'test_biometric_session_{datetime.now().timestamp()}',
            'confidence_score': '0.90'  # 90% confidence
        }
        
        response = authenticated_session.post(
            f"{BASE_URL}/api/ai/verify-biometric",
            data=data
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text}")
        
        assert response.status_code == 200, f"Biometric verification failed: {response.text}"
        
        result = response.json()
        assert result.get("success") == True, f"Verification not successful: {result}"
        assert "verification_id" in result, "No verification_id returned"
        assert result.get("status") == "passed", f"Expected status 'passed', got: {result.get('status')}"
        assert result.get("confidence_score") == 0.90
        
        print(f"✓ Biometric verification passed with 90% confidence")
        return result
    
    def test_verify_biometric_low_confidence(self, authenticated_session):
        """Test biometric verification with low confidence score (should fail)"""
        data = {
            'verification_type': 'facial',
            'session_id': f'test_biometric_low_{datetime.now().timestamp()}',
            'confidence_score': '0.50'  # 50% confidence - below threshold
        }
        
        response = authenticated_session.post(
            f"{BASE_URL}/api/ai/verify-biometric",
            data=data
        )
        
        assert response.status_code == 200, f"Biometric API failed: {response.text}"
        
        result = response.json()
        assert result.get("success") == True
        assert result.get("status") == "failed", f"Expected status 'failed' for low confidence, got: {result.get('status')}"
        
        print(f"✓ Low confidence biometric correctly failed verification")
    
    def test_verify_biometric_different_types(self, authenticated_session):
        """Test biometric verification with different verification types"""
        verification_types = ['facial', 'voiceprint', 'liveness']
        
        for v_type in verification_types:
            data = {
                'verification_type': v_type,
                'session_id': f'test_biometric_{v_type}_{datetime.now().timestamp()}',
                'confidence_score': '0.85'
            }
            
            response = authenticated_session.post(
                f"{BASE_URL}/api/ai/verify-biometric",
                data=data
            )
            
            assert response.status_code == 200, f"Biometric verification failed for type '{v_type}': {response.text}"
            result = response.json()
            assert result.get("success") == True
            print(f"✓ Biometric verification type '{v_type}' accepted")
    
    def test_verify_biometric_without_auth(self):
        """Test biometric verification without authentication - should fail"""
        session = requests.Session()
        
        data = {
            'verification_type': 'facial',
            'session_id': 'test_session',
            'confidence_score': '0.90'
        }
        
        response = session.post(
            f"{BASE_URL}/api/ai/verify-biometric",
            data=data
        )
        
        assert response.status_code in [401, 403], f"Unauthorized access not blocked: {response.status_code}"
        print(f"✓ Unauthorized biometric verification blocked: {response.status_code}")


class TestNotarizationRequestFlow:
    """Test the full notarization request flow"""
    
    def test_create_notarization_request(self, authenticated_session):
        """Test creating a notarization request after document analysis"""
        session_id = f'test_full_flow_{datetime.now().timestamp()}'
        
        # Step 1: Analyze document
        test_content = """
        LAST WILL AND TESTAMENT
        
        I, Mary Johnson, being of sound mind, declare this my last will.
        Executor: David Johnson
        Beneficiary: Sarah Johnson
        
        Date: January 20, 2026
        """
        
        files = {
            'file': ('will.txt', io.BytesIO(test_content.encode()), 'text/plain')
        }
        data = {
            'document_type': 'will',
            'session_id': session_id
        }
        
        analysis_response = authenticated_session.post(
            f"{BASE_URL}/api/ai/analyze-document",
            files=files,
            data=data
        )
        
        assert analysis_response.status_code == 200
        analysis_result = analysis_response.json()
        analysis_id = analysis_result.get("analysis_id")
        print(f"✓ Step 1: Document analyzed, ID: {analysis_id}")
        
        # Step 2: Verify biometric
        biometric_data = {
            'verification_type': 'facial',
            'session_id': session_id,
            'confidence_score': '0.92'
        }
        
        biometric_response = authenticated_session.post(
            f"{BASE_URL}/api/ai/verify-biometric",
            data=biometric_data
        )
        
        assert biometric_response.status_code == 200
        biometric_result = biometric_response.json()
        assert biometric_result.get("status") == "passed"
        print(f"✓ Step 2: Biometric verification passed")
        
        # Step 3: Create notarization request
        request_data = {
            "document_name": "Last Will and Testament",
            "document_type": "will",
            "notarization_type": "ron",
            "scheduled_time": "2026-02-01T10:00:00",
            "signers": [{"name": "Mary Johnson", "email": "mary@example.com"}],
            "notes": "Estate planning document",
            "session_id": session_id,
            "analysis_id": analysis_id,
            "biometric_verified": True
        }
        
        request_response = authenticated_session.post(
            f"{BASE_URL}/api/notary/requests",
            json=request_data
        )
        
        print(f"Notarization request response: {request_response.status_code}")
        print(f"Response body: {request_response.text}")
        
        assert request_response.status_code == 200, f"Failed to create notarization request: {request_response.text}"
        request_result = request_response.json()
        assert "id" in request_result
        print(f"✓ Step 3: Notarization request created, ID: {request_result.get('id')}")
        
        return request_result
    
    def test_get_my_requests(self, authenticated_session):
        """Test fetching user's notarization requests"""
        response = authenticated_session.get(f"{BASE_URL}/api/notary/requests/my")
        
        assert response.status_code == 200, f"Failed to get requests: {response.text}"
        requests_list = response.json()
        assert isinstance(requests_list, list)
        print(f"✓ Retrieved {len(requests_list)} notarization requests")


class TestSessionAnalysis:
    """Test session-based analysis retrieval"""
    
    def test_get_session_analysis(self, authenticated_session):
        """Test retrieving analysis for a session"""
        session_id = f'test_session_retrieval_{datetime.now().timestamp()}'
        
        # First, create an analysis
        files = {
            'file': ('test.txt', io.BytesIO(b'Test document content'), 'text/plain')
        }
        data = {
            'document_type': 'general',
            'session_id': session_id
        }
        
        authenticated_session.post(
            f"{BASE_URL}/api/ai/analyze-document",
            files=files,
            data=data
        )
        
        # Then retrieve session analysis
        response = authenticated_session.get(f"{BASE_URL}/api/ai/session/{session_id}/analysis")
        
        assert response.status_code == 200, f"Failed to get session analysis: {response.text}"
        result = response.json()
        assert "session_id" in result
        assert "document_analyses" in result
        assert "biometric_verifications" in result
        print(f"✓ Session analysis retrieved successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
