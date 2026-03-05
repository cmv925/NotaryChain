"""
Tests for Investor Deck Routes - Password-protected investor presentation
Tests: verify-password endpoint (correct/wrong password) and contact form submission
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

class TestInvestorDeckPasswordVerification:
    """Password verification endpoint tests"""
    
    def test_verify_password_correct(self):
        """Test: POST /api/investor-deck/verify-password with correct password returns {verified: true}"""
        response = requests.post(
            f"{BASE_URL}/api/investor-deck/verify-password",
            json={"password": "NotaryChain2026!"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "verified" in data
        assert data["verified"] is True
    
    def test_verify_password_wrong(self):
        """Test: POST /api/investor-deck/verify-password with wrong password returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/investor-deck/verify-password",
            json={"password": "wrongpassword"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "Invalid" in data["detail"]
    
    def test_verify_password_empty(self):
        """Test: POST /api/investor-deck/verify-password with empty password returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/investor-deck/verify-password",
            json={"password": ""},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401


class TestInvestorDeckContactForm:
    """Contact form endpoint tests"""
    
    def test_contact_form_success(self):
        """Test: POST /api/investor-deck/contact with valid data returns success message"""
        response = requests.post(
            f"{BASE_URL}/api/investor-deck/contact",
            json={
                "name": "TEST Investor",
                "email": "test@investorfund.com",
                "company": "Test Ventures",
                "message": "Interested in Series A investment opportunity."
            },
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert data["success"] is True
        assert "message" in data
        assert "Thank you" in data["message"]
    
    def test_contact_form_missing_name(self):
        """Test: POST /api/investor-deck/contact without name returns 422"""
        response = requests.post(
            f"{BASE_URL}/api/investor-deck/contact",
            json={
                "email": "test@investorfund.com",
                "company": "Test Ventures",
                "message": "Test message"
            },
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422
    
    def test_contact_form_missing_email(self):
        """Test: POST /api/investor-deck/contact without email returns 422"""
        response = requests.post(
            f"{BASE_URL}/api/investor-deck/contact",
            json={
                "name": "Test User",
                "company": "Test Ventures",
                "message": "Test message"
            },
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422
    
    def test_contact_form_missing_company(self):
        """Test: POST /api/investor-deck/contact without company returns 422"""
        response = requests.post(
            f"{BASE_URL}/api/investor-deck/contact",
            json={
                "name": "Test User",
                "email": "test@investorfund.com",
                "message": "Test message"
            },
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422
    
    def test_contact_form_missing_message(self):
        """Test: POST /api/investor-deck/contact without message returns 422"""
        response = requests.post(
            f"{BASE_URL}/api/investor-deck/contact",
            json={
                "name": "Test User",
                "email": "test@investorfund.com",
                "company": "Test Ventures"
            },
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422
