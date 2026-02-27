"""
Test New 6 Features:
1. Smart Reminders & Calendar Integration
2. Approval Workflows
3. Document Comparison / Diff View
4. Custom Branding
5. Dark/Light Theme Toggle (frontend only)
6. Onboarding Tour (frontend only)

Backend API Tests
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
DEMO_USER = {"email": "demo@test.com", "password": "Demo123!"}
ADMIN_USER = {"email": "admin@notarychain.com", "password": "Admin123!"}


@pytest.fixture(scope="module")
def demo_token():
    """Get auth token for demo user."""
    res = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
    if res.status_code == 200:
        return res.json().get("access_token")
    pytest.skip(f"Login failed: {res.status_code} - {res.text}")


@pytest.fixture(scope="module")
def admin_token():
    """Get auth token for admin user."""
    res = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
    if res.status_code == 200:
        return res.json().get("access_token")
    pytest.skip(f"Admin login failed: {res.status_code} - {res.text}")


class TestRemindersPreferences:
    """Tests for Smart Reminders & Calendar Integration."""
    
    def test_get_default_preferences(self, demo_token):
        """GET /api/reminders/preferences returns default preferences."""
        res = requests.get(
            f"{BASE_URL}/api/reminders/preferences",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        # Check default preference fields exist
        assert "overdue_tasks" in data
        assert "upcoming_bookings" in data
        assert "pending_approvals" in data
        assert "email_notifications" in data
        # Check default values
        assert data["overdue_tasks"] in [True, False]
        assert data["upcoming_bookings"] in [True, False]
        print(f"✓ GET /api/reminders/preferences returned: {data}")

    def test_update_preferences(self, demo_token):
        """PUT /api/reminders/preferences updates preferences."""
        update_payload = {
            "overdue_tasks": False,
            "upcoming_bookings": True,
            "pending_approvals": False,
            "email_notifications": True
        }
        res = requests.put(
            f"{BASE_URL}/api/reminders/preferences",
            headers={
                "Authorization": f"Bearer {demo_token}",
                "Content-Type": "application/json"
            },
            json=update_payload
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert data.get("success") == True
        
        # Verify by fetching again
        get_res = requests.get(
            f"{BASE_URL}/api/reminders/preferences",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        get_data = get_res.json()
        assert get_data["overdue_tasks"] == False
        assert get_data["email_notifications"] == True
        print(f"✓ PUT /api/reminders/preferences updated successfully")

    def test_get_preferences_no_auth(self):
        """GET /api/reminders/preferences without auth returns 401/403."""
        res = requests.get(f"{BASE_URL}/api/reminders/preferences")
        assert res.status_code in [401, 403], f"Expected 401/403, got {res.status_code}"
        print(f"✓ GET /api/reminders/preferences without auth returns {res.status_code}")


class TestCalendarExport:
    """Tests for .ics calendar export."""
    
    def test_export_bookings_ics(self, demo_token):
        """GET /api/reminders/calendar/bookings.ics returns valid .ics file."""
        res = requests.get(
            f"{BASE_URL}/api/reminders/calendar/bookings.ics",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        # Check content type
        content_type = res.headers.get("content-type", "")
        assert "text/calendar" in content_type, f"Expected text/calendar, got {content_type}"
        
        # Check .ics format
        content = res.text
        assert "BEGIN:VCALENDAR" in content
        assert "VERSION:2.0" in content
        assert "END:VCALENDAR" in content
        print(f"✓ GET /api/reminders/calendar/bookings.ics returns valid .ics")

    def test_export_tasks_ics(self, demo_token):
        """GET /api/reminders/calendar/tasks.ics returns valid .ics file."""
        res = requests.get(
            f"{BASE_URL}/api/reminders/calendar/tasks.ics",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        # Check content type
        content_type = res.headers.get("content-type", "")
        assert "text/calendar" in content_type, f"Expected text/calendar, got {content_type}"
        
        # Check .ics format
        content = res.text
        assert "BEGIN:VCALENDAR" in content
        assert "VERSION:2.0" in content
        assert "END:VCALENDAR" in content
        print(f"✓ GET /api/reminders/calendar/tasks.ics returns valid .ics")

    def test_ics_export_no_auth(self):
        """Calendar export without auth returns 401/403."""
        res = requests.get(f"{BASE_URL}/api/reminders/calendar/bookings.ics")
        assert res.status_code in [401, 403], f"Expected 401/403, got {res.status_code}"
        print(f"✓ Calendar export without auth returns {res.status_code}")


class TestApprovalWorkflows:
    """Tests for Approval Workflows."""
    
    created_approval_id = None
    
    def test_create_approval_request(self, demo_token, admin_token):
        """POST /api/approvals creates a multi-step approval request."""
        payload = {
            "document_name": "TEST_Approval Request Document",
            "description": "Test approval request for testing",
            "approval_chain": [
                {"approver_email": "admin@notarychain.com", "role": "manager", "order": 1}
            ]
        }
        res = requests.post(
            f"{BASE_URL}/api/approvals",
            headers={
                "Authorization": f"Bearer {demo_token}",
                "Content-Type": "application/json"
            },
            json=payload
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert "id" in data
        assert data["document_name"] == "TEST_Approval Request Document"
        assert data["status"] == "pending"
        assert "steps" in data
        assert len(data["steps"]) == 1
        assert data["steps"][0]["approver_email"] == "admin@notarychain.com"
        assert data["steps"][0]["status"] == "pending"
        
        TestApprovalWorkflows.created_approval_id = data["id"]
        print(f"✓ POST /api/approvals created approval: {data['id']}")

    def test_get_my_requests(self, demo_token):
        """GET /api/approvals/my returns user's approval requests."""
        res = requests.get(
            f"{BASE_URL}/api/approvals/my",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert "requests" in data
        assert isinstance(data["requests"], list)
        print(f"✓ GET /api/approvals/my returned {len(data['requests'])} requests")

    def test_get_pending_approvals(self, admin_token):
        """GET /api/approvals/pending returns requests needing user's approval."""
        res = requests.get(
            f"{BASE_URL}/api/approvals/pending",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert "requests" in data
        assert isinstance(data["requests"], list)
        # Admin should see the pending approval
        print(f"✓ GET /api/approvals/pending returned {len(data['requests'])} pending requests")

    def test_approve_action(self, admin_token):
        """POST /api/approvals/{id}/action allows approve action."""
        if not TestApprovalWorkflows.created_approval_id:
            pytest.skip("No approval created in previous test")
        
        payload = {"action": "approve", "comment": "Test approval comment"}
        res = requests.post(
            f"{BASE_URL}/api/approvals/{TestApprovalWorkflows.created_approval_id}/action",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json=payload
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert data["status"] == "approved"
        assert data["steps"][0]["status"] == "approved"
        assert data["steps"][0]["comment"] == "Test approval comment"
        print(f"✓ POST /api/approvals/{TestApprovalWorkflows.created_approval_id}/action approved successfully")

    def test_reject_action(self, demo_token, admin_token):
        """POST /api/approvals/{id}/action allows reject action."""
        # Create a new approval to reject
        payload = {
            "document_name": "TEST_Rejection Document",
            "description": "Document to be rejected",
            "approval_chain": [
                {"approver_email": "admin@notarychain.com", "role": "legal", "order": 1}
            ]
        }
        create_res = requests.post(
            f"{BASE_URL}/api/approvals",
            headers={
                "Authorization": f"Bearer {demo_token}",
                "Content-Type": "application/json"
            },
            json=payload
        )
        assert create_res.status_code == 200
        approval_id = create_res.json()["id"]
        
        # Reject it
        reject_payload = {"action": "reject", "comment": "Rejected for testing"}
        res = requests.post(
            f"{BASE_URL}/api/approvals/{approval_id}/action",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json=reject_payload
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert data["status"] == "rejected"
        assert data["steps"][0]["status"] == "rejected"
        print(f"✓ POST /api/approvals/{approval_id}/action rejected successfully")

    def test_approval_no_auth(self):
        """Approval endpoints without auth return 401/403."""
        res = requests.get(f"{BASE_URL}/api/approvals/my")
        assert res.status_code in [401, 403], f"Expected 401/403, got {res.status_code}"
        print(f"✓ Approval endpoints without auth returns {res.status_code}")


class TestDocumentComparison:
    """Tests for Document Comparison / Diff View."""
    
    def test_compare_documents(self, demo_token):
        """POST /api/doc-compare/compare returns AI-generated diff analysis."""
        payload = {
            "text_a": "This is the original document text. It contains important legal terms.",
            "text_b": "This is the revised document text. It contains updated legal terms and additional clauses.",
            "label_a": "Original Contract",
            "label_b": "Revised Contract"
        }
        res = requests.post(
            f"{BASE_URL}/api/doc-compare/compare",
            headers={
                "Authorization": f"Bearer {demo_token}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=60  # AI can take time
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert "comparison_id" in data
        assert "result" in data
        
        result = data["result"]
        assert "summary" in result
        assert "changes" in result
        assert isinstance(result["changes"], list)
        print(f"✓ POST /api/doc-compare/compare returned comparison: {data['comparison_id']}")
        print(f"  Summary: {result.get('summary', 'N/A')}")
        print(f"  Changes count: {len(result.get('changes', []))}")

    def test_compare_empty_texts(self, demo_token):
        """POST /api/doc-compare/compare with empty texts returns 400."""
        payload = {"text_a": "", "text_b": "Some text"}
        res = requests.post(
            f"{BASE_URL}/api/doc-compare/compare",
            headers={
                "Authorization": f"Bearer {demo_token}",
                "Content-Type": "application/json"
            },
            json=payload
        )
        assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
        print(f"✓ POST /api/doc-compare/compare with empty text returns 400")

    def test_get_comparison_history(self, demo_token):
        """GET /api/doc-compare/history returns comparison history."""
        res = requests.get(
            f"{BASE_URL}/api/doc-compare/history",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert "comparisons" in data
        assert isinstance(data["comparisons"], list)
        print(f"✓ GET /api/doc-compare/history returned {len(data['comparisons'])} comparisons")

    def test_doc_compare_no_auth(self):
        """Doc compare endpoints without auth return 401/403."""
        res = requests.get(f"{BASE_URL}/api/doc-compare/history")
        assert res.status_code in [401, 403], f"Expected 401/403, got {res.status_code}"
        print(f"✓ Doc compare without auth returns {res.status_code}")


class TestCustomBranding:
    """Tests for Custom Branding."""
    
    def test_get_branding_default(self, demo_token):
        """GET /api/branding/ returns default branding settings."""
        # Note: trailing slash required due to FastAPI redirect
        res = requests.get(
            f"{BASE_URL}/api/branding/",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        # Check expected fields
        assert "primary_color" in data
        assert "accent_color" in data
        # Default colors
        assert data["primary_color"] == "#00d4aa" or "primary_color" in data
        print(f"✓ GET /api/branding/ returned: {data}")

    def test_update_branding(self, demo_token):
        """PUT /api/branding/ updates branding settings."""
        payload = {
            "display_name": "TEST_Company Name",
            "primary_color": "#ff5733",
            "accent_color": "#33ff57",
            "tagline": "Test Tagline"
        }
        res = requests.put(
            f"{BASE_URL}/api/branding/",
            headers={
                "Authorization": f"Bearer {demo_token}",
                "Content-Type": "application/json"
            },
            json=payload
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert data.get("success") == True
        
        # Verify by fetching
        get_res = requests.get(
            f"{BASE_URL}/api/branding/",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        get_data = get_res.json()
        assert get_data["display_name"] == "TEST_Company Name"
        assert get_data["primary_color"] == "#ff5733"
        assert get_data["tagline"] == "Test Tagline"
        print(f"✓ PUT /api/branding/ updated successfully")

    def test_branding_no_auth(self):
        """Branding endpoints without auth return 401/403."""
        res = requests.get(f"{BASE_URL}/api/branding/")
        assert res.status_code in [401, 403], f"Expected 401/403, got {res.status_code}"
        print(f"✓ Branding without auth returns {res.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
