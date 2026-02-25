"""
RON (Remote Online Notarization) Compliance API Tests
Tests state rules database, validation engine, and admin endpoints
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
DEMO_EMAIL = "demo@test.com"
DEMO_PASSWORD = "Demo123!"

# Module-level token cache to avoid rate limits
_token_cache = {}


def get_token(email, password, cache_key=None):
    """Get token with caching to avoid rate limits"""
    cache_key = cache_key or email
    if cache_key in _token_cache:
        return _token_cache[cache_key]
    
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": email,
        "password": password
    })
    if response.status_code == 200:
        token = response.json().get("access_token")
        _token_cache[cache_key] = token
        return token
    elif response.status_code == 429:
        pytest.skip("Rate limited on login - please wait and retry")
    return None


class TestRONPublicEndpoints:
    """Public endpoints that don't require authentication"""

    def test_get_all_states_returns_51_jurisdictions(self):
        """GET /api/compliance/ron/states - Returns all 51 US states + DC with stats"""
        response = requests.get(f"{BASE_URL}/api/compliance/ron/states")
        assert response.status_code == 200
        data = response.json()
        
        # Validate structure
        assert "states" in data
        assert "stats" in data
        
        # Should have exactly 51 jurisdictions (50 states + DC)
        assert len(data["states"]) == 51, f"Expected 51 states, got {len(data['states'])}"
        
        # Validate stats
        stats = data["stats"]
        assert stats["total_jurisdictions"] == 51
        assert stats["full_ron"] == 48
        assert stats["limited_ron"] == 2
        assert stats["pending_legislation"] == 0
        assert stats["prohibited"] == 1
        assert stats["coverage_pct"] == 98.0
        print(f"PASS: Got {len(data['states'])} jurisdictions with stats: {stats}")

    def test_get_florida_full_ron_rules(self):
        """GET /api/compliance/ron/states/FL - Florida has full RON authorization"""
        response = requests.get(f"{BASE_URL}/api/compliance/ron/states/FL")
        assert response.status_code == 200
        data = response.json()
        
        assert data["state_code"] == "FL"
        assert data["name"] == "Florida"
        assert data["status"] == "full"
        assert data["effective_date"] == "2020-01-01"
        assert "knowledge_based" in data["id_requirements"]
        assert "credential_analysis" in data["id_requirements"]
        assert data["recording_required"] is True
        assert data["journal_required"] is True
        assert data["max_signers_per_session"] == 10
        assert "all" in data["allowed_doc_types"]
        print(f"PASS: Florida rules - {data}")

    def test_get_south_carolina_prohibited_state(self):
        """GET /api/compliance/ron/states/SC - South Carolina is prohibited for RON"""
        response = requests.get(f"{BASE_URL}/api/compliance/ron/states/SC")
        assert response.status_code == 200
        data = response.json()
        
        assert data["state_code"] == "SC"
        assert data["name"] == "South Carolina"
        assert data["status"] == "prohibited"
        assert data["effective_date"] is None
        assert data["max_signers_per_session"] == 0
        assert data["allowed_doc_types"] == []
        print(f"PASS: South Carolina is prohibited - {data}")

    def test_get_california_limited_ron_state(self):
        """GET /api/compliance/ron/states/CA - California has limited RON with restrictions"""
        response = requests.get(f"{BASE_URL}/api/compliance/ron/states/CA")
        assert response.status_code == 200
        data = response.json()
        
        assert data["state_code"] == "CA"
        assert data["name"] == "California"
        assert data["status"] == "limited"
        assert "biometric" in data["id_requirements"]
        assert data["max_signers_per_session"] == 5
        assert "real_estate" in data.get("restricted_doc_types", [])
        assert "trust" in data.get("restricted_doc_types", [])
        assert "will" in data.get("restricted_doc_types", [])
        print(f"PASS: California limited RON - restricted docs: {data.get('restricted_doc_types')}")

    def test_get_new_york_biometric_required(self):
        """GET /api/compliance/ron/states/NY - New York requires biometric verification"""
        response = requests.get(f"{BASE_URL}/api/compliance/ron/states/NY")
        assert response.status_code == 200
        data = response.json()
        
        assert data["state_code"] == "NY"
        assert data["name"] == "New York"
        assert data["status"] == "full"
        assert "biometric" in data["id_requirements"]
        assert data["max_signers_per_session"] == 6
        print(f"PASS: NY biometric required - ID requirements: {data['id_requirements']}")

    def test_get_louisiana_witness_required(self):
        """GET /api/compliance/ron/states/LA - Louisiana requires 2 witnesses"""
        response = requests.get(f"{BASE_URL}/api/compliance/ron/states/LA")
        assert response.status_code == 200
        data = response.json()
        
        assert data["state_code"] == "LA"
        assert data["name"] == "Louisiana"
        assert data["status"] == "limited"
        assert data["witnesses_required"] == 2
        assert data["max_signers_per_session"] == 5
        print(f"PASS: Louisiana requires {data['witnesses_required']} witnesses")

    def test_get_unknown_state_returns_404(self):
        """GET /api/compliance/ron/states/XX - Unknown state code returns 404"""
        response = requests.get(f"{BASE_URL}/api/compliance/ron/states/XX")
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data.get("detail", "").lower()
        print(f"PASS: Unknown state XX returns 404 - {data}")

    def test_get_compliance_stats(self):
        """GET /api/compliance/ron/stats - Returns coverage statistics"""
        response = requests.get(f"{BASE_URL}/api/compliance/ron/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert data["total_jurisdictions"] == 51
        assert data["full_ron"] == 48
        assert data["limited_ron"] == 2
        assert data["pending_legislation"] == 0
        assert data["prohibited"] == 1
        assert data["coverage_pct"] == 98.0
        print(f"PASS: Stats endpoint - coverage: {data['coverage_pct']}%")


class TestRONValidationEndpoint:
    """Tests for POST /api/compliance/ron/validate - requires authentication"""

    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Login and get demo user token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip(f"Login failed: {response.status_code}")

    def test_validate_florida_affidavit_compliant(self):
        """FL affidavit should be compliant (full RON state)"""
        response = requests.post(
            f"{BASE_URL}/api/compliance/ron/validate",
            json={
                "state_code": "FL",
                "document_type": "affidavit",
                "signer_count": 1
            },
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["compliant"] is True
        assert data["state_code"] == "FL"
        assert len(data["errors"]) == 0
        assert data["requirements"]["ron_status"] == "full"
        print(f"PASS: FL affidavit compliant - {data}")

    def test_validate_south_carolina_fails_prohibited(self):
        """SC any document type should fail (prohibited state)"""
        response = requests.post(
            f"{BASE_URL}/api/compliance/ron/validate",
            json={
                "state_code": "SC",
                "document_type": "affidavit",
                "signer_count": 1
            },
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["compliant"] is False
        assert data["state_code"] == "SC"
        assert len(data["errors"]) > 0
        assert "not authorized" in data["errors"][0].lower() or "prohibited" in data["errors"][0].lower()
        print(f"PASS: SC fails with prohibited error - {data['errors']}")

    def test_validate_california_real_estate_fails_restricted(self):
        """CA real_estate document type should fail (restricted doc type)"""
        response = requests.post(
            f"{BASE_URL}/api/compliance/ron/validate",
            json={
                "state_code": "CA",
                "document_type": "real_estate",
                "signer_count": 1
            },
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["compliant"] is False
        assert data["state_code"] == "CA"
        assert len(data["errors"]) > 0
        assert "restricted" in data["errors"][0].lower()
        print(f"PASS: CA real_estate restricted - {data['errors']}")

    def test_validate_california_affidavit_passes_with_warnings(self):
        """CA affidavit should pass with limited status warning and biometric warning"""
        response = requests.post(
            f"{BASE_URL}/api/compliance/ron/validate",
            json={
                "state_code": "CA",
                "document_type": "affidavit",
                "signer_count": 1
            },
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["compliant"] is True
        assert data["state_code"] == "CA"
        assert len(data["warnings"]) > 0
        # Should have limited status warning and biometric warning
        warning_text = " ".join(data["warnings"]).lower()
        assert "limited" in warning_text or "biometric" in warning_text
        print(f"PASS: CA affidavit compliant with warnings - {data['warnings']}")

    def test_validate_new_york_shows_biometric_warning(self):
        """NY validation should show biometric requirement warning"""
        response = requests.post(
            f"{BASE_URL}/api/compliance/ron/validate",
            json={
                "state_code": "NY",
                "document_type": "affidavit",
                "signer_count": 1
            },
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["compliant"] is True
        assert data["state_code"] == "NY"
        warning_text = " ".join(data["warnings"]).lower()
        assert "biometric" in warning_text
        print(f"PASS: NY biometric warning - {data['warnings']}")

    def test_validate_too_many_signers_fails(self):
        """NY with 10 signers should fail (max is 6)"""
        response = requests.post(
            f"{BASE_URL}/api/compliance/ron/validate",
            json={
                "state_code": "NY",
                "document_type": "affidavit",
                "signer_count": 10
            },
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["compliant"] is False
        assert len(data["errors"]) > 0
        assert "too many signers" in data["errors"][0].lower() or "maximum" in data["errors"][0].lower()
        print(f"PASS: Too many signers fails - {data['errors']}")

    def test_validate_unknown_state_returns_compliant_false(self):
        """Unknown state code should return compliant=False with error"""
        response = requests.post(
            f"{BASE_URL}/api/compliance/ron/validate",
            json={
                "state_code": "ZZ",
                "document_type": "affidavit",
                "signer_count": 1
            },
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["compliant"] is False
        assert "unknown" in data["errors"][0].lower()
        print(f"PASS: Unknown state error - {data['errors']}")

    def test_validate_requires_authentication(self):
        """Validate endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/compliance/ron/validate",
            json={
                "state_code": "FL",
                "document_type": "affidavit",
                "signer_count": 1
            }
            # No auth header
        )
        assert response.status_code in [401, 403]
        print(f"PASS: Validate requires auth - status {response.status_code}")


class TestRONAdminEndpoints:
    """Admin-only endpoints: violations and activity logs"""

    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.admin_token = response.json().get("access_token")
            self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        else:
            pytest.skip(f"Admin login failed: {response.status_code}")
        
        # Also get demo user token for non-admin tests
        demo_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        if demo_response.status_code == 200:
            self.demo_token = demo_response.json().get("access_token")
            self.demo_headers = {"Authorization": f"Bearer {self.demo_token}"}

    def test_admin_get_violations(self):
        """GET /api/compliance/ron/violations - Admin can view violations"""
        response = requests.get(
            f"{BASE_URL}/api/compliance/ron/violations?page_size=30",
            headers=self.admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "violations" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        print(f"PASS: Admin violations - total: {data['total']}, returned: {len(data['violations'])}")

    def test_admin_get_activity(self):
        """GET /api/compliance/ron/activity - Admin can view all activity"""
        response = requests.get(
            f"{BASE_URL}/api/compliance/ron/activity?page_size=30",
            headers=self.admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "activity" in data
        assert "total" in data
        assert "summary" in data
        
        summary = data["summary"]
        assert "total_checks" in summary
        assert "failed" in summary
        assert "with_warnings" in summary
        assert "pass_rate" in summary
        print(f"PASS: Admin activity - total: {data['total']}, summary: {summary}")

    def test_non_admin_violations_returns_403(self):
        """Non-admin user should get 403 on violations endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/compliance/ron/violations",
            headers=self.demo_headers
        )
        assert response.status_code == 403
        print(f"PASS: Non-admin violations returns 403")

    def test_non_admin_activity_returns_403(self):
        """Non-admin user should get 403 on activity endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/compliance/ron/activity",
            headers=self.demo_headers
        )
        assert response.status_code == 403
        print(f"PASS: Non-admin activity returns 403")


class TestRONValidationLogging:
    """Test that validations are logged to MongoDB"""

    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Login as admin and demo user"""
        # Admin login
        admin_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if admin_resp.status_code == 200:
            self.admin_token = admin_resp.json().get("access_token")
            self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        else:
            pytest.skip(f"Admin login failed")

        # Demo user login
        demo_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        if demo_resp.status_code == 200:
            self.demo_token = demo_resp.json().get("access_token")
            self.demo_headers = {"Authorization": f"Bearer {self.demo_token}"}
        else:
            pytest.skip(f"Demo login failed")

    def test_validation_is_logged_to_activity(self):
        """Validation requests should appear in activity log"""
        # Create a unique validation request
        unique_doc = f"TEST_logging_{int(time.time())}"
        
        # Make validation request
        validate_response = requests.post(
            f"{BASE_URL}/api/compliance/ron/validate",
            json={
                "state_code": "TX",
                "document_type": unique_doc,
                "signer_count": 2
            },
            headers=self.demo_headers
        )
        assert validate_response.status_code == 200
        
        # Check activity log as admin
        time.sleep(0.5)  # Small delay for DB write
        activity_response = requests.get(
            f"{BASE_URL}/api/compliance/ron/activity?page_size=50",
            headers=self.admin_headers
        )
        assert activity_response.status_code == 200
        
        activity = activity_response.json()
        # Find our unique validation in the activity log
        found = False
        for log in activity.get("activity", []):
            if log.get("document_type") == unique_doc and log.get("state_code") == "TX":
                found = True
                assert log["signer_count"] == 2
                assert log["compliant"] is True
                break
        
        assert found, f"Validation not found in activity log for doc_type={unique_doc}"
        print(f"PASS: Validation logged to activity - doc_type={unique_doc}")

    def test_failed_validation_appears_in_violations(self):
        """Failed validations should appear in violations list"""
        unique_doc = f"TEST_violation_{int(time.time())}"
        
        # Make failing validation request (SC is prohibited)
        validate_response = requests.post(
            f"{BASE_URL}/api/compliance/ron/validate",
            json={
                "state_code": "SC",
                "document_type": unique_doc,
                "signer_count": 1
            },
            headers=self.demo_headers
        )
        assert validate_response.status_code == 200
        assert validate_response.json()["compliant"] is False
        
        # Check violations log as admin
        time.sleep(0.5)
        violations_response = requests.get(
            f"{BASE_URL}/api/compliance/ron/violations?page_size=50",
            headers=self.admin_headers
        )
        assert violations_response.status_code == 200
        
        violations = violations_response.json()
        found = False
        for log in violations.get("violations", []):
            if log.get("document_type") == unique_doc and log.get("state_code") == "SC":
                found = True
                assert log["compliant"] is False
                assert len(log["errors"]) > 0
                break
        
        assert found, f"Failed validation not found in violations for doc_type={unique_doc}"
        print(f"PASS: Failed validation logged to violations - doc_type={unique_doc}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
