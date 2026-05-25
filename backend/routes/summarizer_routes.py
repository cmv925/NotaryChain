"""
AI Document Summarizer Routes
Upload any document and get AI-generated summary + key terms.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from models import User
from routes.auth_routes import get_current_user
from middleware.security import limiter
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
from services.storage_service import storage_service
from datetime import datetime, timezone
import os
import uuid
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai-summarizer", tags=["ai-summarizer"])

db: AsyncIOMotorDatabase = None
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

MIME_MAP = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.webp': 'image/webp',
    '.txt': 'text/plain',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}


def set_db(database):
    global db
    db = database


@router.post("/summarize")
@limiter.limit("5/minute")
async def summarize_document(
    request: Request,
    file: UploadFile = File(...),
    detail_level: str = Form("standard"),
    current_user: User = Depends(get_current_user),
):
    """Upload a document and get an AI-generated summary with key terms."""
    file_ext = os.path.splitext(file.filename)[1].lower()

    if file_ext not in MIME_MAP:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_ext}")

    # Upload file to storage
    content = await file.read()
    storage_meta = await storage_service.upload(content, file.filename, folder="summarizer")
    # Get local path for text extraction
    file_path = await storage_service.get_file_path(storage_meta["path"], storage_meta["storage_backend"])

    detail_instruction = {
        "brief": "Provide a 2-3 sentence summary.",
        "standard": "Provide a comprehensive summary in 1-2 paragraphs.",
        "detailed": "Provide a thorough, section-by-section summary.",
    }.get(detail_level, "Provide a comprehensive summary.")

    prompt = f"""{detail_instruction}

Also extract:
1. Key terms and definitions found in the document
2. Important dates, deadlines, or time periods
3. Parties involved and their roles
4. Key obligations, rights, or conditions
5. Any notable clauses or provisions

Return as JSON:
{{
  "summary": "...",
  "document_type_detected": "contract|agreement|will|affidavit|deed|letter|report|other",
  "key_terms": [
    {{"term": "...", "definition": "..."}}
  ],
  "important_dates": [
    {{"date": "...", "context": "..."}}
  ],
  "parties": [
    {{"name": "...", "role": "..."}}
  ],
  "key_obligations": ["..."],
  "notable_clauses": ["..."],
  "page_count_estimate": 0,
  "language": "en",
  "complexity_level": "simple|moderate|complex"
}}"""

    try:
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"summarize_{current_user.id}_{datetime.now().timestamp()}",
            system_message="You are a document analysis expert. Respond with valid JSON only.",
        )
        # Read file content for text files, for other types just summarize based on filename
        file_text = ""
        if file_ext in ['.txt', '.doc', '.docx']:
            try:
                with open(file_path, 'r', errors='ignore') as f:
                    file_text = f.read()[:10000]  # Limit to 10k chars
            except Exception:
                pass
        
        full_prompt = f"{prompt}\n\nDocument content (if available):\n{file_text}" if file_text else prompt
        text = await chat.send_message(UserMessage(text=full_prompt))
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        result = json.loads(text)
    except json.JSONDecodeError:
        result = {"summary": "Unable to parse AI response. The document may be too complex or in an unsupported format.", "key_terms": [], "parties": []}
    except Exception as e:
        logger.error(f"Summarizer error: {e}")
        # Clean up from storage
        try:
            await storage_service.delete(storage_meta["path"], storage_meta["storage_backend"])
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="AI summarization failed")

    # Save record
    record = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "file_name": file.filename,
        "file_type": file_ext,
        "detail_level": detail_level,
        "result": result,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.ai_summaries.insert_one(record)
    record.pop("_id", None)

    # Clean up temp file from storage after processing
    try:
        await storage_service.delete(storage_meta["path"], storage_meta["storage_backend"])
    except Exception:
        pass

    return record


@router.get("/history")
async def get_summary_history(
    current_user: User = Depends(get_current_user),
):
    """Get user's summarization history."""
    docs = await db.ai_summaries.find(
        {"user_id": current_user.id},
        {"_id": 0, "id": 1, "file_name": 1, "file_type": 1, "detail_level": 1, "created_at": 1, "result.summary": 1, "result.document_type_detected": 1},
    ).sort("created_at", -1).to_list(30)
    return {"summaries": docs}


@router.get("/history/{summary_id}")
async def get_summary(
    summary_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get a specific summary."""
    doc = await db.ai_summaries.find_one(
        {"id": summary_id, "user_id": current_user.id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Summary not found")
    return doc
