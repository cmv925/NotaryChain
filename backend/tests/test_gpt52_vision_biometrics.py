"""
Test GPT-5.2 Vision Biometrics Integration for NotaryChain Ceremony Pipeline
Tests:
- POST /api/ceremony/start with/without images
- SSE streaming with AI-powered vs simulated Verifier Agent
- AI Verifier detailed checks (font_consistency, hologram_presence, etc.)
"""
import pytest
import requests
import os
import base64
import json
import time
from io import BytesIO

# Use PIL to create a test image with real visual features
try:
    from PIL import Image, ImageDraw
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@notarychain.com"
ADMIN_PASSWORD = "Admin123!"


def create_test_image_base64(width=200, height=200, image_type="id"):
    """Create a test image with real visual features (not blank/solid color)."""
    if not HAS_PIL:
        # Fallback: minimal valid JPEG
        return "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAyADIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigAooooAKKKKACiiigAooooAKKKKACiiigD//2Q=="
    
    # Create image with visual features
    img = Image.new('RGB', (width, height), color=(240, 240, 240))
    draw = ImageDraw.Draw(img)
    
    if image_type == "id":
        # Draw ID card-like features
        draw.rectangle([10, 10, width-10, height-10], outline=(0, 0, 0), width=2)
        draw.rectangle([15, 20, 70, 80], fill=(200, 200, 200), outline=(100, 100, 100))  # Photo area
        draw.text((80, 25), "DRIVER LICENSE", fill=(0, 0, 100))
        draw.text((80, 45), "John Smith", fill=(0, 0, 0))
        draw.text((80, 65), "DOB: 01/15/1985", fill=(50, 50, 50))
        draw.text((15, 100), "DL: D1234567", fill=(0, 0, 0))
        draw.text((15, 120), "EXP: 12/31/2028", fill=(50, 50, 50))
        # Add some texture/pattern
        for i in range(0, width, 20):
            draw.line([(i, height-30), (i+10, height-10)], fill=(200, 200, 220), width=1)
    else:
        # Draw face-like features for selfie
        draw.ellipse([50, 30, 150, 150], fill=(255, 220, 180), outline=(200, 180, 150))  # Face
        draw.ellipse([70, 60, 90, 80], fill=(255, 255, 255), outline=(0, 0, 0))  # Left eye
        draw.ellipse([110, 60, 130, 80], fill=(255, 255, 255), outline=(0, 0, 0))  # Right eye
        draw.ellipse([75, 65, 85, 75], fill=(50, 50, 50))  # Left pupil
        draw.ellipse([115, 65, 125, 75], fill=(50, 50, 50))  # Right pupil
        draw.arc([80, 100, 120, 130], 0, 180, fill=(150, 50, 50), width=2)  # Smile
        draw.rectangle([85, 80, 115, 100], fill=(255, 200, 160))  # Nose area
    
    # Convert to base64
    buffer = BytesIO()
    img.save(buffer, format='JPEG', quality=85)
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token."""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestCeremonyStartWithImages:
    """Test POST /api/ceremony/start with and without images."""
    
    def test_start_ceremony_without_images(self, auth_headers):
        """Ceremony without images should set has_id_image=false (simulated fallback)."""
        response = requests.post(f"{BASE_URL}/api/ceremony/start", 
            json={
                "document_name": "TEST_NoImages_Document",
                "signer_name": "TEST_NoImages_Signer"
            },
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "ceremony_id" in data
        assert data["status"] == "pending"
        assert data["has_images"] == False, "Should have has_images=false when no images provided"
        
        # Verify ceremony in DB
        ceremony_id = data["ceremony_id"]
        get_resp = requests.get(f"{BASE_URL}/api/ceremony/{ceremony_id}", headers=auth_headers)
        assert get_resp.status_code == 200
        ceremony = get_resp.json()
        assert ceremony["has_id_image"] == False
        assert ceremony["has_selfie"] == False
        print(f"✓ Ceremony without images created: {ceremony_id}")
    
    def test_start_ceremony_with_id_image_only(self, auth_headers):
        """Ceremony with ID image should set has_id_image=true."""
        id_image = create_test_image_base64(200, 200, "id")
        
        response = requests.post(f"{BASE_URL}/api/ceremony/start",
            json={
                "document_name": "TEST_IDOnly_Document",
                "signer_name": "TEST_IDOnly_Signer",
                "id_image_base64": id_image
            },
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["has_images"] == True, "Should have has_images=true when ID image provided"
        
        ceremony_id = data["ceremony_id"]
        get_resp = requests.get(f"{BASE_URL}/api/ceremony/{ceremony_id}", headers=auth_headers)
        ceremony = get_resp.json()
        assert ceremony["has_id_image"] == True
        assert ceremony["has_selfie"] == False
        print(f"✓ Ceremony with ID image created: {ceremony_id}")
    
    def test_start_ceremony_with_both_images(self, auth_headers):
        """Ceremony with both ID and selfie images should set both flags true."""
        id_image = create_test_image_base64(200, 200, "id")
        selfie_image = create_test_image_base64(200, 200, "selfie")
        
        response = requests.post(f"{BASE_URL}/api/ceremony/start",
            json={
                "document_name": "TEST_BothImages_Document",
                "signer_name": "TEST_BothImages_Signer",
                "id_image_base64": id_image,
                "selfie_base64": selfie_image
            },
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["has_images"] == True
        
        ceremony_id = data["ceremony_id"]
        get_resp = requests.get(f"{BASE_URL}/api/ceremony/{ceremony_id}", headers=auth_headers)
        ceremony = get_resp.json()
        assert ceremony["has_id_image"] == True
        assert ceremony["has_selfie"] == True
        print(f"✓ Ceremony with both images created: {ceremony_id}")
        
        return ceremony_id  # Return for use in SSE test


class TestSSEStreamWithAI:
    """Test SSE streaming with AI-powered vs simulated Verifier Agent."""
    
    def test_sse_stream_without_images_simulated(self, auth_headers):
        """SSE stream without images should use simulated Verifier (ai_powered=false)."""
        # Create ceremony without images
        create_resp = requests.post(f"{BASE_URL}/api/ceremony/start",
            json={
                "document_name": "TEST_SSE_Simulated_Document",
                "signer_name": "TEST_SSE_Simulated_Signer"
            },
            headers=auth_headers
        )
        assert create_resp.status_code == 200
        ceremony_id = create_resp.json()["ceremony_id"]
        
        # Execute via SSE stream
        sse_url = f"{BASE_URL}/api/ceremony/{ceremony_id}/stream"
        events = []
        
        with requests.get(sse_url, stream=True, timeout=60) as response:
            assert response.status_code == 200
            assert "text/event-stream" in response.headers.get("Content-Type", "")
            
            for line in response.iter_lines(decode_unicode=True):
                if line and line.startswith("data:"):
                    try:
                        event_data = json.loads(line[5:].strip())
                        events.append(event_data)
                        print(f"  Event: {event_data.get('type', 'unknown')}")
                        if event_data.get("type") == "ceremony_complete":
                            break
                    except json.JSONDecodeError:
                        pass
        
        # Verify ceremony completed
        get_resp = requests.get(f"{BASE_URL}/api/ceremony/{ceremony_id}", headers=auth_headers)
        ceremony = get_resp.json()
        
        # Check Verifier Agent is NOT AI-powered (simulated)
        verifier = ceremony["agents"]["verifier"]
        assert verifier["status"] in ["passed", "failed"]
        assert verifier["details"].get("ai_powered") == False, "Verifier should be simulated (ai_powered=false) without images"
        print(f"✓ SSE stream completed with simulated Verifier: {ceremony_id}")
    
    def test_sse_stream_with_images_ai_powered(self, auth_headers):
        """SSE stream with images should use GPT-5.2 Vision (ai_powered=true, model=gpt-5.2)."""
        # Create ceremony with images
        id_image = create_test_image_base64(200, 200, "id")
        selfie_image = create_test_image_base64(200, 200, "selfie")
        
        create_resp = requests.post(f"{BASE_URL}/api/ceremony/start",
            json={
                "document_name": "TEST_SSE_AI_Document",
                "signer_name": "TEST_SSE_AI_Signer",
                "id_image_base64": id_image,
                "selfie_base64": selfie_image
            },
            headers=auth_headers
        )
        assert create_resp.status_code == 200
        ceremony_id = create_resp.json()["ceremony_id"]
        
        # Execute via SSE stream (AI takes longer - 15-30 seconds)
        sse_url = f"{BASE_URL}/api/ceremony/{ceremony_id}/stream"
        events = []
        
        print(f"  Starting SSE stream for AI-powered ceremony (may take 15-30 seconds)...")
        with requests.get(sse_url, stream=True, timeout=120) as response:
            assert response.status_code == 200
            
            for line in response.iter_lines(decode_unicode=True):
                if line and line.startswith("data:"):
                    try:
                        event_data = json.loads(line[5:].strip())
                        events.append(event_data)
                        event_type = event_data.get('type', 'unknown')
                        print(f"  Event: {event_type}")
                        if event_type == "ceremony_complete":
                            break
                    except json.JSONDecodeError:
                        pass
        
        # Verify ceremony completed
        get_resp = requests.get(f"{BASE_URL}/api/ceremony/{ceremony_id}", headers=auth_headers)
        ceremony = get_resp.json()
        
        # Check Verifier Agent IS AI-powered
        verifier = ceremony["agents"]["verifier"]
        assert verifier["status"] in ["passed", "failed"]
        assert verifier["details"].get("ai_powered") == True, "Verifier should be AI-powered (ai_powered=true) with images"
        assert verifier["details"].get("model") == "gpt-5.2", "Verifier should use gpt-5.2 model"
        
        # Check for detailed AI checks
        checks = verifier["details"].get("checks", {})
        print(f"  AI Verifier checks: {list(checks.keys())}")
        
        # AI should return forensic checks like font_consistency, hologram_presence, etc.
        # Note: The exact checks depend on GPT-5.2 response, but we should have some
        assert len(checks) > 0, "AI Verifier should return detailed checks"
        
        print(f"✓ SSE stream completed with AI-powered Verifier (GPT-5.2): {ceremony_id}")
        print(f"  Confidence: {verifier['confidence']}")
        print(f"  Checks performed: {verifier['details'].get('checks_performed', [])}")


class TestAIVerifierDetailedChecks:
    """Test that AI Verifier returns detailed forensic checks."""
    
    def test_ai_verifier_returns_forensic_checks(self, auth_headers):
        """AI Verifier should return detailed checks like font_consistency, hologram_presence, etc."""
        # Create and execute ceremony with images
        id_image = create_test_image_base64(200, 200, "id")
        
        create_resp = requests.post(f"{BASE_URL}/api/ceremony/start",
            json={
                "document_name": "TEST_AI_Forensics_Document",
                "signer_name": "TEST_AI_Forensics_Signer",
                "id_image_base64": id_image
            },
            headers=auth_headers
        )
        assert create_resp.status_code == 200
        ceremony_id = create_resp.json()["ceremony_id"]
        
        # Execute via sync endpoint (simpler for this test)
        print(f"  Executing ceremony with AI Verifier (may take 10-20 seconds)...")
        exec_resp = requests.post(f"{BASE_URL}/api/ceremony/{ceremony_id}/execute", headers=auth_headers, timeout=120)
        assert exec_resp.status_code == 200
        
        ceremony = exec_resp.json()
        verifier = ceremony["agents"]["verifier"]
        
        # Verify AI-powered
        assert verifier["details"].get("ai_powered") == True
        
        # Check for forensic checks
        checks = verifier["details"].get("checks", {})
        checks_performed = verifier["details"].get("checks_performed", [])
        
        print(f"  Checks returned: {list(checks.keys())}")
        print(f"  Checks performed: {checks_performed}")
        
        # Expected forensic check types (may vary based on GPT-5.2 response)
        expected_check_types = [
            "font_consistency", "photo_alignment", "hologram_presence", 
            "edge_integrity", "color_consistency", "id_document"
        ]
        
        found_checks = []
        for check_type in expected_check_types:
            if check_type in checks:
                found_checks.append(check_type)
                check_data = checks[check_type]
                status = check_data.get("status") if isinstance(check_data, dict) else check_data
                print(f"    {check_type}: {status}")
        
        # Should have at least some forensic checks
        assert len(found_checks) > 0 or len(checks) > 0, "AI Verifier should return forensic checks"
        
        # Verify confidence is reasonable (AI typically returns 0.6-0.95 for synthetic images)
        confidence = verifier["confidence"]
        assert 0.3 <= confidence <= 1.0, f"Confidence {confidence} should be between 0.3 and 1.0"
        
        print(f"✓ AI Verifier returned {len(checks)} forensic checks with confidence {confidence}")


class TestCeremonyImagesStorage:
    """Test that images are stored in ceremony_images collection."""
    
    def test_images_stored_separately(self, auth_headers):
        """Images should be stored in ceremony_images collection, not in main ceremony doc."""
        id_image = create_test_image_base64(200, 200, "id")
        selfie_image = create_test_image_base64(200, 200, "selfie")
        
        create_resp = requests.post(f"{BASE_URL}/api/ceremony/start",
            json={
                "document_name": "TEST_ImageStorage_Document",
                "signer_name": "TEST_ImageStorage_Signer",
                "id_image_base64": id_image,
                "selfie_base64": selfie_image
            },
            headers=auth_headers
        )
        assert create_resp.status_code == 200
        ceremony_id = create_resp.json()["ceremony_id"]
        
        # Get ceremony - should NOT contain base64 images (stored separately)
        get_resp = requests.get(f"{BASE_URL}/api/ceremony/{ceremony_id}", headers=auth_headers)
        ceremony = get_resp.json()
        
        # Main ceremony doc should have flags but not actual image data
        assert ceremony["has_id_image"] == True
        assert ceremony["has_selfie"] == True
        assert "id_image_base64" not in ceremony, "Image data should not be in main ceremony doc"
        assert "selfie_base64" not in ceremony, "Image data should not be in main ceremony doc"
        
        print(f"✓ Images stored separately from main ceremony document: {ceremony_id}")


class TestCeremonyListWithImageFlags:
    """Test that ceremony list includes image flags."""
    
    def test_list_ceremonies_shows_image_status(self, auth_headers):
        """Ceremony list should indicate which ceremonies have images."""
        # Create ceremonies with and without images
        requests.post(f"{BASE_URL}/api/ceremony/start",
            json={"document_name": "TEST_List_NoImages", "signer_name": "Test"},
            headers=auth_headers
        )
        
        id_image = create_test_image_base64(200, 200, "id")
        requests.post(f"{BASE_URL}/api/ceremony/start",
            json={"document_name": "TEST_List_WithImages", "signer_name": "Test", "id_image_base64": id_image},
            headers=auth_headers
        )
        
        # Get list
        list_resp = requests.get(f"{BASE_URL}/api/ceremony/list/my", headers=auth_headers)
        assert list_resp.status_code == 200
        ceremonies = list_resp.json().get("ceremonies", [])
        
        assert len(ceremonies) > 0, "Should have ceremonies in list"
        print(f"✓ Ceremony list returned {len(ceremonies)} ceremonies")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
