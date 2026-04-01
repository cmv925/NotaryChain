"""
Test AI Intelligence Hub - 5 AI Features
1. Risk Scoring - POST /api/ai-intelligence/risk-score
2. Document Summarization - POST /api/ai-intelligence/summarize
3. Smart Notary Matching - POST /api/ai-intelligence/match-notary
4. Fraud Detection Dashboard - GET /api/ai-intelligence/fraud-analytics (admin/notary only)
5. Voice Authentication - POST /api/ai-intelligence/voice-auth
6. History - GET /api/ai-intelligence/history
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
USER_EMAIL = "demo@test.com"
USER_PASSWORD = "Demo123!"
NOTARY_EMAIL = "notarytest@test.com"
NOTARY_PASSWORD = "Test123!"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def user_token():
    """Get regular user authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": USER_EMAIL,
        "password": USER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"User login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def notary_token():
    """Get notary authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": NOTARY_EMAIL,
        "password": NOTARY_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Notary login failed: {response.status_code} - {response.text}")


class TestRiskScoring:
    """Test AI Document Risk Scoring endpoint"""
    
    def test_risk_score_success(self, user_token):
        """Test risk scoring with valid document text"""
        response = requests.post(
            f"{BASE_URL}/api/ai-intelligence/risk-score",
            json={
                "document_text": "This is a sample purchase agreement between Party A and Party B for the sale of real property located at 123 Main Street. The purchase price is $500,000.",
                "document_name": "TEST_Purchase_Agreement.pdf"
            },
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "analysis_id" in data, "Missing analysis_id"
        assert "overall_risk_score" in data, "Missing overall_risk_score"
        assert "risk_level" in data, "Missing risk_level"
        assert "risks" in data, "Missing risks array"
        assert "missing_clauses" in data, "Missing missing_clauses array"
        assert "anomalies" in data, "Missing anomalies array"
        
        # Verify data types
        assert isinstance(data["overall_risk_score"], (int, float))
        assert data["risk_level"] in ["low", "medium", "high", "critical"]
        assert isinstance(data["risks"], list)
        assert isinstance(data["missing_clauses"], list)
        assert isinstance(data["anomalies"], list)
        
        print(f"Risk Score: {data['overall_risk_score']}, Level: {data['risk_level']}")
    
    def test_risk_score_unauthorized(self):
        """Test risk scoring without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/ai-intelligence/risk-score",
            json={
                "document_text": "Test document",
                "document_name": "test.pdf"
            }
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestDocumentSummarization:
    """Test AI Document Summarization endpoint"""
    
    def test_summarize_success(self, user_token):
        """Test document summarization with valid text"""
        response = requests.post(
            f"{BASE_URL}/api/ai-intelligence/summarize",
            json={
                "document_text": "This Agreement is entered into as of January 1, 2026, by and between ABC Corporation (Buyer) and XYZ Holdings (Seller). The Buyer agrees to purchase all assets of the Seller for a total consideration of $1,000,000. Payment shall be made in three installments.",
                "document_name": "TEST_Asset_Purchase_Agreement.pdf"
            },
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "analysis_id" in data, "Missing analysis_id"
        assert "summary" in data, "Missing summary"
        assert "key_terms" in data, "Missing key_terms"
        assert "parties_involved" in data, "Missing parties_involved"
        assert "critical_dates" in data, "Missing critical_dates"
        assert "financial_obligations" in data, "Missing financial_obligations"
        
        # Verify data types
        assert isinstance(data["summary"], str)
        assert isinstance(data["key_terms"], list)
        assert isinstance(data["parties_involved"], list)
        
        print(f"Summary length: {len(data['summary'])} chars, Key terms: {len(data['key_terms'])}")
    
    def test_summarize_unauthorized(self):
        """Test summarization without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/ai-intelligence/summarize",
            json={
                "document_text": "Test document",
                "document_name": "test.pdf"
            }
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestSmartNotaryMatching:
    """Test Smart Notary Matching endpoint"""
    
    def test_match_notary_success(self, user_token):
        """Test notary matching with valid parameters"""
        response = requests.post(
            f"{BASE_URL}/api/ai-intelligence/match-notary",
            json={
                "document_type": "real_estate",
                "jurisdiction": "California",
                "urgency": "normal"
            },
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "recommendations" in data, "Missing recommendations"
        assert "total_notaries" in data, "Missing total_notaries"
        assert "document_type" in data, "Missing document_type"
        assert "jurisdiction" in data, "Missing jurisdiction"
        assert "urgency" in data, "Missing urgency"
        
        # Verify recommendations structure
        assert isinstance(data["recommendations"], list)
        assert len(data["recommendations"]) > 0, "No notary recommendations returned"
        
        # Check first recommendation structure
        rec = data["recommendations"][0]
        assert "match_score" in rec, "Missing match_score in recommendation"
        assert "notary" in rec, "Missing notary in recommendation"
        assert "name" in rec["notary"], "Missing notary name"
        
        print(f"Found {len(data['recommendations'])} notary recommendations, top score: {rec['match_score']}")
    
    def test_match_notary_urgent(self, user_token):
        """Test notary matching with urgent flag"""
        response = requests.post(
            f"{BASE_URL}/api/ai-intelligence/match-notary",
            json={
                "document_type": "contract",
                "jurisdiction": "All States",
                "urgency": "urgent"
            },
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["urgency"] == "urgent"
        assert len(data["recommendations"]) > 0
    
    def test_match_notary_unauthorized(self):
        """Test notary matching without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/ai-intelligence/match-notary",
            json={
                "document_type": "contract",
                "jurisdiction": "California",
                "urgency": "normal"
            }
        )
        assert response.status_code == 401


class TestFraudAnalytics:
    """Test Fraud Detection Dashboard endpoint - Admin/Notary only"""
    
    def test_fraud_analytics_admin_success(self, admin_token):
        """Test fraud analytics with admin access"""
        response = requests.get(
            f"{BASE_URL}/api/ai-intelligence/fraud-analytics",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "threat_level" in data, "Missing threat_level"
        assert "stats" in data, "Missing stats"
        assert "alerts" in data, "Missing alerts"
        assert "total_alerts" in data, "Missing total_alerts"
        
        # Verify threat level values
        assert data["threat_level"] in ["normal", "elevated", "critical"]
        
        # Verify stats structure
        stats = data["stats"]
        assert "total_ceremonies" in stats
        assert "failed_ceremonies" in stats
        assert "total_documents" in stats
        
        # Verify alerts structure
        assert isinstance(data["alerts"], list)
        
        print(f"Threat Level: {data['threat_level']}, Total Alerts: {data['total_alerts']}")
    
    def test_fraud_analytics_notary_success(self, notary_token):
        """Test fraud analytics with notary access"""
        response = requests.get(
            f"{BASE_URL}/api/ai-intelligence/fraud-analytics",
            headers={"Authorization": f"Bearer {notary_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "threat_level" in data
        assert "alerts" in data
    
    def test_fraud_analytics_user_forbidden(self, user_token):
        """Test fraud analytics with regular user - should be forbidden"""
        response = requests.get(
            f"{BASE_URL}/api/ai-intelligence/fraud-analytics",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for regular user, got {response.status_code}"
    
    def test_fraud_analytics_unauthorized(self):
        """Test fraud analytics without authentication"""
        response = requests.get(f"{BASE_URL}/api/ai-intelligence/fraud-analytics")
        assert response.status_code == 401


class TestVoiceAuthentication:
    """Test Voice Biometric Authentication endpoint"""
    
    def test_voice_auth_demo_mode(self, user_token):
        """Test voice auth in demo mode (no audio provided)"""
        response = requests.post(
            f"{BASE_URL}/api/ai-intelligence/voice-auth",
            json={
                "audio_base64": "",
                "party_name": "John Smith",
                "expected_phrase": None
            },
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "verification_id" in data, "Missing verification_id"
        assert "voice_verified" in data, "Missing voice_verified"
        assert "confidence" in data, "Missing confidence"
        assert "phrase_match" in data, "Missing phrase_match"
        assert "liveness_indicators" in data, "Missing liveness_indicators"
        
        # Verify data types
        assert isinstance(data["voice_verified"], bool)
        assert isinstance(data["confidence"], (int, float))
        assert isinstance(data["liveness_indicators"], list)
        
        print(f"Voice Verified: {data['voice_verified']}, Confidence: {data['confidence']}")
    
    def test_voice_auth_with_custom_phrase(self, user_token):
        """Test voice auth with custom verification phrase"""
        response = requests.post(
            f"{BASE_URL}/api/ai-intelligence/voice-auth",
            json={
                "audio_base64": "",
                "party_name": "Jane Doe",
                "expected_phrase": "I confirm my identity for this notarization."
            },
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "voice_verified" in data
        assert "party_name" in data
        assert data["party_name"] == "Jane Doe"
    
    def test_voice_auth_unauthorized(self):
        """Test voice auth without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/ai-intelligence/voice-auth",
            json={
                "audio_base64": "",
                "party_name": "Test User"
            }
        )
        assert response.status_code == 401


class TestAnalysisHistory:
    """Test AI Analysis History endpoint"""
    
    def test_history_success(self, user_token):
        """Test getting analysis history"""
        response = requests.get(
            f"{BASE_URL}/api/ai-intelligence/history",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "analyses" in data, "Missing analyses"
        assert "total" in data, "Missing total"
        
        # Verify data types
        assert isinstance(data["analyses"], list)
        assert isinstance(data["total"], int)
        
        print(f"Total analyses in history: {data['total']}")
    
    def test_history_with_limit(self, user_token):
        """Test history with custom limit"""
        response = requests.get(
            f"{BASE_URL}/api/ai-intelligence/history?limit=5",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["analyses"]) <= 5
    
    def test_history_unauthorized(self):
        """Test history without authentication"""
        response = requests.get(f"{BASE_URL}/api/ai-intelligence/history")
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
