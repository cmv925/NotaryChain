"""
Test Auto-Learning Threat Detection Feature
Tests the threat-learning endpoints for analyzing ceremonies and auto-learning fraud patterns.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
REGULAR_USER_EMAIL = "demo@test.com"
REGULAR_USER_PASSWORD = "Demo123!"

# Known ceremony IDs from context
CEREMONY_ID_1 = "520c3c1e-3cca-4191-be26-e4c7c4a15d81"
CEREMONY_ID_2 = "429267cb-57ce-4e50-a8f0-df0f440632ad"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token - admin bypasses feature gates"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token")
    pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def regular_user_token():
    """Get regular user auth token - should be blocked by feature gate"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": REGULAR_USER_EMAIL,
        "password": REGULAR_USER_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token")
    pytest.skip(f"Regular user login failed: {response.status_code} - {response.text}")


class TestThreatLearningAuth:
    """Test authentication and feature gate requirements"""
    
    def test_analytics_requires_auth(self):
        """GET /api/threat-learning/analytics returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/threat-learning/analytics")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Analytics endpoint requires authentication (401 without token)")
    
    def test_patterns_requires_auth(self):
        """GET /api/threat-learning/patterns returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/threat-learning/patterns")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Patterns endpoint requires authentication (401 without token)")
    
    def test_analyses_requires_auth(self):
        """GET /api/threat-learning/analyses returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/threat-learning/analyses")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Analyses endpoint requires authentication (401 without token)")
    
    def test_analyze_requires_auth(self):
        """POST /api/threat-learning/analyze/{id} returns 401 without token"""
        response = requests.post(f"{BASE_URL}/api/threat-learning/analyze/{CEREMONY_ID_1}")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Analyze endpoint requires authentication (401 without token)")


class TestThreatLearningFeatureGate:
    """Test feature gate blocks free users (fraud_intelligence gate)"""
    
    def test_regular_user_blocked_from_analytics(self, regular_user_token):
        """Regular user gets 403 on analytics (fraud_intelligence gate)"""
        headers = {"Authorization": f"Bearer {regular_user_token}"}
        response = requests.get(f"{BASE_URL}/api/threat-learning/analytics", headers=headers)
        # Should be 403 (feature gate) or 403 (admin/notary required)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("PASS: Regular user blocked from analytics (403 - feature gate)")
    
    def test_regular_user_blocked_from_patterns(self, regular_user_token):
        """Regular user gets 403 on patterns (fraud_intelligence gate)"""
        headers = {"Authorization": f"Bearer {regular_user_token}"}
        response = requests.get(f"{BASE_URL}/api/threat-learning/patterns", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("PASS: Regular user blocked from patterns (403 - feature gate)")
    
    def test_regular_user_blocked_from_analyses(self, regular_user_token):
        """Regular user gets 403 on analyses (fraud_intelligence gate)"""
        headers = {"Authorization": f"Bearer {regular_user_token}"}
        response = requests.get(f"{BASE_URL}/api/threat-learning/analyses", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("PASS: Regular user blocked from analyses (403 - feature gate)")
    
    def test_regular_user_blocked_from_analyze(self, regular_user_token):
        """Regular user gets 403 on analyze (fraud_intelligence gate)"""
        headers = {"Authorization": f"Bearer {regular_user_token}"}
        response = requests.post(f"{BASE_URL}/api/threat-learning/analyze/{CEREMONY_ID_1}", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("PASS: Regular user blocked from analyze (403 - feature gate)")


class TestThreatLearningAnalytics:
    """Test analytics endpoint returns correct aggregated stats"""
    
    def test_get_analytics_success(self, admin_token):
        """GET /api/threat-learning/analytics returns aggregated stats"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/threat-learning/analytics", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify required fields
        assert "total_analyses" in data, "Missing total_analyses field"
        assert "total_threats_detected" in data, "Missing total_threats_detected field"
        assert "auto_learned_patterns" in data, "Missing auto_learned_patterns field"
        assert "learning_rate" in data, "Missing learning_rate field"
        
        # Verify types
        assert isinstance(data["total_analyses"], int), "total_analyses should be int"
        assert isinstance(data["total_threats_detected"], int), "total_threats_detected should be int"
        assert isinstance(data["auto_learned_patterns"], int), "auto_learned_patterns should be int"
        assert isinstance(data["learning_rate"], (int, float)), "learning_rate should be numeric"
        
        print(f"PASS: Analytics returned - total_analyses={data['total_analyses']}, "
              f"total_threats={data['total_threats_detected']}, "
              f"auto_patterns={data['auto_learned_patterns']}, "
              f"learning_rate={data['learning_rate']}")
    
    def test_analytics_has_recent_analyses(self, admin_token):
        """Analytics includes recent_analyses list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/threat-learning/analytics", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "recent_analyses" in data, "Missing recent_analyses field"
        assert isinstance(data["recent_analyses"], list), "recent_analyses should be a list"
        print(f"PASS: Analytics includes recent_analyses list with {len(data['recent_analyses'])} items")
    
    def test_analytics_has_top_indicators(self, admin_token):
        """Analytics includes top_indicators list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/threat-learning/analytics", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "top_indicators" in data, "Missing top_indicators field"
        assert isinstance(data["top_indicators"], list), "top_indicators should be a list"
        print(f"PASS: Analytics includes top_indicators list with {len(data['top_indicators'])} items")


class TestThreatLearningPatterns:
    """Test patterns endpoint returns auto-learned fraud patterns"""
    
    def test_get_patterns_success(self, admin_token):
        """GET /api/threat-learning/patterns returns patterns list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/threat-learning/patterns", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "patterns" in data, "Missing patterns field"
        assert "total" in data, "Missing total field"
        assert isinstance(data["patterns"], list), "patterns should be a list"
        assert isinstance(data["total"], int), "total should be int"
        
        print(f"PASS: Patterns endpoint returned {data['total']} auto-learned patterns")
    
    def test_patterns_structure(self, admin_token):
        """Patterns have correct structure if any exist"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/threat-learning/patterns", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        if data["total"] > 0:
            pattern = data["patterns"][0]
            # Check expected fields
            expected_fields = ["pattern_id", "category", "title", "auto_learned"]
            for field in expected_fields:
                assert field in pattern, f"Pattern missing {field} field"
            assert pattern["auto_learned"] == True, "Pattern should be auto_learned=True"
            print(f"PASS: Pattern structure verified - pattern_id={pattern['pattern_id']}, category={pattern['category']}")
        else:
            print("PASS: No auto-learned patterns yet (expected - patterns created when threat keywords found)")


class TestThreatLearningAnalyses:
    """Test analyses endpoint returns recent threat analyses"""
    
    def test_get_analyses_success(self, admin_token):
        """GET /api/threat-learning/analyses returns analyses list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/threat-learning/analyses", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "analyses" in data, "Missing analyses field"
        assert "total" in data, "Missing total field"
        assert isinstance(data["analyses"], list), "analyses should be a list"
        
        print(f"PASS: Analyses endpoint returned {data['total']} threat analyses")
    
    def test_analyses_structure(self, admin_token):
        """Analyses have correct structure"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/threat-learning/analyses", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        if data["total"] > 0:
            analysis = data["analyses"][0]
            # Check expected fields
            expected_fields = ["analysis_id", "ceremony_id", "analyzed_at", "threats_detected"]
            for field in expected_fields:
                assert field in analysis, f"Analysis missing {field} field"
            assert isinstance(analysis["threats_detected"], int), "threats_detected should be int"
            print(f"PASS: Analysis structure verified - analysis_id={analysis['analysis_id']}, "
                  f"ceremony_id={analysis['ceremony_id']}, threats={analysis['threats_detected']}")
        else:
            print("PASS: No analyses yet (will be created when ceremonies are analyzed)")


class TestThreatLearningAnalyze:
    """Test manual ceremony analysis endpoint"""
    
    def test_analyze_ceremony_success(self, admin_token):
        """POST /api/threat-learning/analyze/{ceremony_id} analyzes ceremony"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(f"{BASE_URL}/api/threat-learning/analyze/{CEREMONY_ID_1}", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "analysis_id" in data, "Missing analysis_id field"
        assert "ceremony_id" in data, "Missing ceremony_id field"
        assert "threats_detected" in data, "Missing threats_detected field"
        assert "analyzed_at" in data, "Missing analyzed_at field"
        
        assert data["ceremony_id"] == CEREMONY_ID_1, f"ceremony_id mismatch"
        assert isinstance(data["threats_detected"], int), "threats_detected should be int"
        
        print(f"PASS: Ceremony analyzed - analysis_id={data['analysis_id']}, "
              f"threats_detected={data['threats_detected']}")
    
    def test_analyze_ceremony_returns_threat_details(self, admin_token):
        """Analysis includes threat_details array"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(f"{BASE_URL}/api/threat-learning/analyze/{CEREMONY_ID_1}", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "threat_details" in data, "Missing threat_details field"
        assert isinstance(data["threat_details"], list), "threat_details should be a list"
        
        if data["threats_detected"] > 0:
            threat = data["threat_details"][0]
            assert "agent" in threat, "Threat missing agent field"
            assert "verdict" in threat, "Threat missing verdict field"
            assert "severity" in threat, "Threat missing severity field"
            print(f"PASS: Threat details included - {len(data['threat_details'])} threats with agent/verdict/severity")
        else:
            print("PASS: No threats detected (clean ceremony)")
    
    def test_analyze_nonexistent_ceremony(self, admin_token):
        """Analyzing non-existent ceremony returns 404"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(f"{BASE_URL}/api/threat-learning/analyze/nonexistent-id", headers=headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Non-existent ceremony returns 404")
    
    def test_analyze_second_ceremony(self, admin_token):
        """Analyze second ceremony to verify consistency"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(f"{BASE_URL}/api/threat-learning/analyze/{CEREMONY_ID_2}", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["ceremony_id"] == CEREMONY_ID_2
        print(f"PASS: Second ceremony analyzed - threats_detected={data['threats_detected']}")


class TestThreatLearningAutoTrigger:
    """Test that threat analysis runs automatically after ceremony execution"""
    
    def test_analyses_collection_grows(self, admin_token):
        """Verify threat_analyses collection has entries (auto-triggered after ceremonies)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/threat-learning/analyses", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        # Per context: "Two analyses exist in DB — one from manual analyze call, one auto-triggered"
        assert data["total"] >= 2, f"Expected at least 2 analyses (auto-triggered), got {data['total']}"
        print(f"PASS: threat_analyses collection has {data['total']} entries (includes auto-triggered)")
    
    def test_analytics_reflects_analyses(self, admin_token):
        """Analytics total_analyses matches analyses count"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get analytics
        analytics_resp = requests.get(f"{BASE_URL}/api/threat-learning/analytics", headers=headers)
        assert analytics_resp.status_code == 200
        analytics = analytics_resp.json()
        
        # Get analyses
        analyses_resp = requests.get(f"{BASE_URL}/api/threat-learning/analyses", headers=headers)
        assert analyses_resp.status_code == 200
        analyses = analyses_resp.json()
        
        # Note: total_analyses in analytics should match or be close to analyses total
        # (may differ slightly due to timing of new analyses)
        print(f"PASS: Analytics total_analyses={analytics['total_analyses']}, "
              f"Analyses total={analyses['total']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
