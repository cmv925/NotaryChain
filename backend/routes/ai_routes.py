from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from motor.motor_asyncio import AsyncIOMotorDatabase
from models import User
from routes.auth_routes import get_current_user
from ai_document_analyzer import DocumentAnalyzer
from datetime import datetime, timezone
import os
import uuid
import shutil

router = APIRouter(prefix="/api/ai", tags=["ai-analysis"])

db: AsyncIOMotorDatabase = None

def set_db(database):
    global db
    db = database

# Ensure uploads directory exists
UPLOAD_DIR = "/tmp/notary_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/analyze-document")
async def analyze_document(
    file: UploadFile = File(...),
    document_type: str = Form("general"),
    session_id: str = Form(None),
    current_user: User = Depends(get_current_user)
):
    """
    Analyze an uploaded document using AI
    """
    try:
        # Generate unique filename
        file_ext = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        # Save uploaded file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Determine MIME type
        mime_types = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.txt': 'text/plain',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        }
        mime_type = mime_types.get(file_ext.lower(), 'application/octet-stream')
        
        # Analyze document
        analyzer = DocumentAnalyzer()
        analysis_result = await analyzer.analyze_document(
            file_path=file_path,
            mime_type=mime_type,
            document_type=document_type
        )
        
        # Store analysis result in database
        analysis_record = {
            "id": str(uuid.uuid4()),
            "user_id": current_user.id,
            "session_id": session_id,
            "filename": file.filename,
            "document_type": document_type,
            "analysis_result": analysis_result,
            "timestamp": datetime.now(timezone.utc),
            "file_path": file_path
        }
        
        await db.document_analyses.insert_one(analysis_record)
        
        # Clean up file after analysis (optional - keep for audit trail)
        # os.remove(file_path)
        
        return {
            "success": True,
            "analysis_id": analysis_record["id"],
            "analysis": analysis_result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.post("/verify-biometric")
async def verify_biometric(
    verification_type: str = Form(...),  # facial, voiceprint, liveness
    session_id: str = Form(...),
    confidence_score: float = Form(0.0),
    current_user: User = Depends(get_current_user)
):
    """
    Record biometric verification result
    """
    
    # In production, this would integrate with actual biometric verification services
    # For now, we'll simulate the verification
    
    verification_record = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "user_id": current_user.id,
        "verification_type": verification_type,
        "status": "passed" if confidence_score >= 0.7 else "failed",
        "confidence_score": confidence_score,
        "timestamp": datetime.now(timezone.utc),
        "metadata": {
            "device": "web",
            "ip_address": "simulated"
        }
    }
    
    await db.biometric_verifications.insert_one(verification_record)
    
    return {
        "success": True,
        "verification_id": verification_record["id"],
        "status": verification_record["status"],
        "confidence_score": confidence_score
    }

@router.get("/session/{session_id}/analysis")
async def get_session_analysis(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get all analysis results for a session
    """
    
    analyses = await db.document_analyses.find({
        "session_id": session_id
    }, {"_id": 0}).to_list(100)
    
    verifications = await db.biometric_verifications.find({
        "session_id": session_id
    }, {"_id": 0}).to_list(100)
    
    return {
        "session_id": session_id,
        "document_analyses": analyses,
        "biometric_verifications": verifications
    }

@router.get("/analysis/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get specific analysis result
    """
    
    analysis = await db.document_analyses.find_one({
        "id": analysis_id,
        "user_id": current_user.id
    }, {"_id": 0})
    
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    return analysis
