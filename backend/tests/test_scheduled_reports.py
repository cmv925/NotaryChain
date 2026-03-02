"""
Test Scheduled Reports Feature
Tests for configurable scheduled reports with PDF generation, download, and preview.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"
DEMO_EMAIL = "demo@test.com"
DEMO_PASSWORD = "Demo123!"


class TestScheduledReportsBackend:
    """Scheduled Reports API tests"""

    @pytest.fixture(scope="class")
    def admin_auth(self):
        """Get admin authentication token and org_id"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        token = data.get("access_token") or data.get("token")
        
        # Get organizations to find org_id
        headers = {"Authorization": f"Bearer {token}"}
        orgs_res = requests.get(f"{BASE_URL}/api/organizations/", headers=headers)
        assert orgs_res.status_code == 200, f"Failed to get orgs: {orgs_res.text}"
        orgs = orgs_res.json().get("organizations", [])
        assert len(orgs) > 0, "Admin has no organizations"
        
        # Find org where admin is owner/admin
        org_id = None
        for org in orgs:
            if org.get("my_role") in ("owner", "admin"):
                org_id = org["id"]
                break
        assert org_id, "No org found where admin is owner/admin"
        
        return {"token": token, "org_id": org_id, "headers": headers}

    @pytest.fixture(scope="class")
    def demo_auth(self):
        """Get demo user authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        assert response.status_code == 200, f"Demo login failed: {response.text}"
        data = response.json()
        token = data.get("access_token") or data.get("token")
        return {"token": token, "headers": {"Authorization": f"Bearer {token}"}}

    # --- Section 1: Report Sections Endpoint ---
    
    def test_get_report_sections(self, admin_auth):
        """GET /api/organizations/{org_id}/reports/sections - list available sections"""
        response = requests.get(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports/sections",
            headers=admin_auth['headers']
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should return 5 sections
        assert "sections" in data, "Missing 'sections' field"
        sections = data["sections"]
        assert len(sections) == 5, f"Expected 5 sections, got {len(sections)}"
        
        # Check section structure
        section_keys = [s["key"] for s in sections]
        expected_keys = ["activity", "notarizations", "members", "webhooks", "billing"]
        for key in expected_keys:
            assert key in section_keys, f"Missing section: {key}"
        
        # Each section should have key, label, description
        for section in sections:
            assert "key" in section, "Section missing 'key'"
            assert "label" in section, "Section missing 'label'"
            assert "description" in section, "Section missing 'description'"

    # --- Section 2: Report Config Endpoints ---
    
    def test_get_report_config_initial(self, admin_auth):
        """GET /api/organizations/{org_id}/reports/config - get config (may or may not exist)"""
        response = requests.get(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports/config",
            headers=admin_auth['headers']
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should have 'configured' field
        assert "configured" in data, "Missing 'configured' field"
        # If configured, should have frequency and sections
        if data["configured"]:
            assert "frequency" in data, "Config missing 'frequency'"
            assert "sections" in data, "Config missing 'sections'"
            assert data["frequency"] in ("weekly", "monthly"), f"Invalid frequency: {data['frequency']}"
            assert len(data["sections"]) >= 1, "Config should have at least one section"

    def test_create_update_report_config(self, admin_auth):
        """POST /api/organizations/{org_id}/reports/config - create/update config"""
        response = requests.post(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports/config",
            headers=admin_auth['headers'],
            json={
                "frequency": "weekly",
                "sections": ["activity", "notarizations", "members"],
                "is_active": True
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["frequency"] == "weekly", f"Expected 'weekly', got {data['frequency']}"
        assert set(data["sections"]) == {"activity", "notarizations", "members"}, f"Sections mismatch: {data['sections']}"
        assert data["is_active"] == True, f"Expected is_active=True, got {data['is_active']}"
        assert "org_id" in data, "Missing org_id in response"

    def test_update_config_to_monthly(self, admin_auth):
        """POST /api/organizations/{org_id}/reports/config - update to monthly"""
        response = requests.post(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports/config",
            headers=admin_auth['headers'],
            json={
                "frequency": "monthly",
                "sections": ["activity", "billing", "webhooks", "members"],
                "is_active": True
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["frequency"] == "monthly"
        assert len(data["sections"]) == 4

    def test_config_invalid_frequency(self, admin_auth):
        """POST config with invalid frequency returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports/config",
            headers=admin_auth['headers'],
            json={
                "frequency": "daily",  # Invalid
                "sections": ["activity"],
                "is_active": True
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "weekly" in response.text.lower() or "monthly" in response.text.lower()

    def test_config_invalid_sections(self, admin_auth):
        """POST config with invalid section returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports/config",
            headers=admin_auth['headers'],
            json={
                "frequency": "weekly",
                "sections": ["activity", "invalid_section"],
                "is_active": True
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "invalid" in response.text.lower()

    def test_config_empty_sections(self, admin_auth):
        """POST config with empty sections returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports/config",
            headers=admin_auth['headers'],
            json={
                "frequency": "weekly",
                "sections": [],
                "is_active": True
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "at least one" in response.text.lower()

    # --- Section 3: Generate Report Now ---
    
    def test_generate_report_now(self, admin_auth):
        """POST /api/organizations/{org_id}/reports/generate - generate report"""
        response = requests.post(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports/generate",
            headers=admin_auth['headers']
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check report record structure
        assert "id" in data, "Missing report id"
        assert "filename" in data, "Missing filename"
        assert data["filename"].endswith(".pdf"), f"Expected PDF filename, got {data['filename']}"
        assert "sections" in data, "Missing sections"
        assert "period_days" in data, "Missing period_days"
        assert "generated_at" in data, "Missing generated_at"
        assert "data_snapshot" in data, "Missing data_snapshot"
        
        # Store report id for later tests
        admin_auth['generated_report_id'] = data["id"]
        admin_auth['generated_report_filename'] = data["filename"]

    # --- Section 4: List Reports ---
    
    def test_list_reports(self, admin_auth):
        """GET /api/organizations/{org_id}/reports - list generated reports"""
        response = requests.get(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports",
            headers=admin_auth['headers']
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "total" in data, "Missing 'total' field"
        assert "page" in data, "Missing 'page' field"
        assert "reports" in data, "Missing 'reports' field"
        assert data["total"] >= 1, "Should have at least 1 report"
        
        # Check report structure (no data_snapshot in list)
        if data["reports"]:
            report = data["reports"][0]
            assert "id" in report, "Report missing id"
            assert "filename" in report, "Report missing filename"
            assert "generated_at" in report, "Report missing generated_at"
            # data_snapshot should NOT be in list response (performance)
            assert "data_snapshot" not in report or report.get("data_snapshot") is None, "data_snapshot should be excluded from list"

    def test_list_reports_pagination(self, admin_auth):
        """GET /api/organizations/{org_id}/reports - test pagination"""
        response = requests.get(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports?page=1&page_size=5",
            headers=admin_auth['headers']
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["page"] == 1
        assert len(data["reports"]) <= 5

    # --- Section 5: Get Report Detail ---
    
    def test_get_report_detail(self, admin_auth):
        """GET /api/organizations/{org_id}/reports/{id} - get report with data_snapshot"""
        # First get a report id
        list_res = requests.get(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports",
            headers=admin_auth['headers']
        )
        assert list_res.status_code == 200
        reports = list_res.json()["reports"]
        assert len(reports) > 0, "No reports to test"
        
        report_id = reports[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports/{report_id}",
            headers=admin_auth['headers']
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "id" in data, "Missing id"
        assert "data_snapshot" in data, "Missing data_snapshot"
        assert data["data_snapshot"] is not None, "data_snapshot should not be null"
        
        # Check data_snapshot structure
        snapshot = data["data_snapshot"]
        assert "period_days" in snapshot, "Snapshot missing period_days"
        assert "generated_at" in snapshot, "Snapshot missing generated_at"
        assert "org_name" in snapshot, "Snapshot missing org_name"

    def test_get_report_detail_not_found(self, admin_auth):
        """GET report detail with invalid id returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports/nonexistent-id-12345",
            headers=admin_auth['headers']
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"

    # --- Section 6: Download PDF ---
    
    def test_download_report_pdf(self, admin_auth):
        """GET /api/organizations/{org_id}/reports/{id}/download - download PDF"""
        # Get a report id
        list_res = requests.get(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports",
            headers=admin_auth['headers']
        )
        reports = list_res.json()["reports"]
        report_id = reports[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports/{report_id}/download",
            headers=admin_auth['headers']
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Check content type
        content_type = response.headers.get("content-type", "")
        assert "application/pdf" in content_type, f"Expected PDF, got {content_type}"
        
        # Check we got actual content
        assert len(response.content) > 0, "Empty PDF content"
        
        # PDF files start with %PDF
        assert response.content[:4] == b'%PDF', "Content is not a valid PDF"

    def test_download_nonexistent_report(self, admin_auth):
        """GET download with invalid report id returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports/nonexistent-id/download",
            headers=admin_auth['headers']
        )
        assert response.status_code == 404

    # --- Section 7: Delete Report ---
    
    def test_delete_report(self, admin_auth):
        """DELETE /api/organizations/{org_id}/reports/{id} - delete report"""
        # First generate a new report to delete
        gen_res = requests.post(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports/generate",
            headers=admin_auth['headers']
        )
        assert gen_res.status_code == 200
        report_id = gen_res.json()["id"]
        
        # Delete it
        response = requests.delete(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports/{report_id}",
            headers=admin_auth['headers']
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify it's gone
        get_res = requests.get(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports/{report_id}",
            headers=admin_auth['headers']
        )
        assert get_res.status_code == 404, "Report should be deleted"

    def test_delete_nonexistent_report(self, admin_auth):
        """DELETE nonexistent report returns 404"""
        response = requests.delete(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports/nonexistent-id",
            headers=admin_auth['headers']
        )
        assert response.status_code == 404

    # --- Section 8: Admin-Only Access ---
    
    def test_non_admin_cannot_access_sections(self, admin_auth, demo_auth):
        """Non-admin user should get 403 on sections endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports/sections",
            headers=demo_auth['headers']
        )
        # Demo user is not a member of admin's org, should be 403
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"

    def test_non_admin_cannot_access_config(self, admin_auth, demo_auth):
        """Non-admin user should get 403 on config endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports/config",
            headers=demo_auth['headers']
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"

    def test_non_admin_cannot_generate(self, admin_auth, demo_auth):
        """Non-admin user should get 403 on generate endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports/generate",
            headers=demo_auth['headers']
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"

    def test_non_admin_cannot_list_reports(self, admin_auth, demo_auth):
        """Non-admin user should get 403 on list reports endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports",
            headers=demo_auth['headers']
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"

    def test_non_admin_cannot_download(self, admin_auth, demo_auth):
        """Non-admin user should get 403 on download endpoint"""
        # Get a report id first
        list_res = requests.get(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports",
            headers=admin_auth['headers']
        )
        reports = list_res.json()["reports"]
        if reports:
            report_id = reports[0]["id"]
            response = requests.get(
                f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports/{report_id}/download",
                headers=demo_auth['headers']
            )
            assert response.status_code == 403, f"Expected 403, got {response.status_code}"

    # --- Section 9: Data Snapshot Validation ---
    
    def test_report_data_snapshot_has_correct_sections(self, admin_auth):
        """Verify data_snapshot contains data for configured sections"""
        # Update config with all sections
        requests.post(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports/config",
            headers=admin_auth['headers'],
            json={
                "frequency": "weekly",
                "sections": ["activity", "notarizations", "members", "webhooks", "billing"],
                "is_active": True
            }
        )
        
        # Generate report
        gen_res = requests.post(
            f"{BASE_URL}/api/organizations/{admin_auth['org_id']}/reports/generate",
            headers=admin_auth['headers']
        )
        assert gen_res.status_code == 200
        report = gen_res.json()
        
        snapshot = report["data_snapshot"]
        
        # Check all sections are in snapshot
        assert "activity" in snapshot, "Missing activity in snapshot"
        assert "notarizations" in snapshot, "Missing notarizations in snapshot"
        assert "members" in snapshot, "Missing members in snapshot"
        assert "webhooks" in snapshot, "Missing webhooks in snapshot"
        assert "billing" in snapshot, "Missing billing in snapshot"
        
        # Check activity structure
        assert "total_events" in snapshot["activity"], "Activity missing total_events"
        assert "by_action" in snapshot["activity"], "Activity missing by_action"
        
        # Check notarizations structure
        assert "total_documents" in snapshot["notarizations"], "Notarizations missing total_documents"
        
        # Check members structure
        assert "total_active" in snapshot["members"], "Members missing total_active"
        
        # Check webhooks structure
        assert "success_rate" in snapshot["webhooks"], "Webhooks missing success_rate"
        
        # Check billing structure
        assert "total_revenue" in snapshot["billing"], "Billing missing total_revenue"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
