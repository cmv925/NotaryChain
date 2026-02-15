import os
import asyncio
from typing import Dict, List, Optional
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
from dotenv import load_dotenv
import json

load_dotenv()

class DocumentAnalyzer:
    def __init__(self):
        self.api_key = os.environ.get('EMERGENT_LLM_KEY', '')
        
    async def analyze_document(self, file_path: str, mime_type: str, document_type: str = "general") -> Dict:
        """
        Analyze a document for discrepancies, missing information, and authenticity.
        
        Args:
            file_path: Path to the document file
            mime_type: MIME type of the document
            document_type: Type of document being analyzed
            
        Returns:
            Dict containing analysis results with discrepancies, confidence score, etc.
        """
        
        # Create LlmChat instance with Gemini
        chat = LlmChat(
            api_key=self.api_key,
            session_id=f"doc_analysis_{os.path.basename(file_path)}",
            system_message="""
You are an expert document analyst for a notary service. Your job is to:
1. Carefully examine documents for any discrepancies, inconsistencies, or missing information
2. Identify potential fraud indicators (altered text, inconsistent formatting, suspicious signatures)
3. Verify that all required fields are present and properly filled
4. Check for date inconsistencies or logical errors
5. Provide a confidence score (0-100) for document authenticity
6. IMPORTANT: Detect and analyze any existing signatures in the document

Respond ONLY with a valid JSON object in this exact format:
{
  "confidence_score": <number 0-100>,
  "status": "<verified|needs_review|suspicious>",
  "discrepancies": [
    {
      "type": "<missing_field|inconsistency|suspicious_content|formatting_issue|signature_issue>",
      "severity": "<low|medium|high>",
      "location": "<where in document>",
      "description": "<what was found>",
      "recommendation": "<what to do>"
    }
  ],
  "key_information": {
    "names": ["list of names found"],
    "dates": ["list of dates found"],
    "addresses": ["list of addresses found"],
    "document_date": "date if found",
    "signatures_present": <true|false>
  },
  "signature_analysis": {
    "signatures_found": <number of signatures detected>,
    "signature_locations": ["location descriptions of each signature"],
    "signature_types": ["handwritten|digital|stamp|initials"],
    "signature_quality": "<clear|partial|unclear|none>",
    "all_required_signatures_present": <true|false>,
    "missing_signatures": ["list of missing signature lines if any"],
    "signature_concerns": ["any concerns about signature authenticity"]
  },
  "summary": "<brief summary of findings>",
  "recommendations": ["list of recommended actions"]
}
"""
        ).with_model("gemini", "gemini-2.5-pro")
        
        # Create file attachment
        file_attachment = FileContentWithMimeType(
            file_path=file_path,
            mime_type=mime_type
        )
        
        # Create analysis prompt based on document type
        prompt = self._get_analysis_prompt(document_type)
        
        # Send message with file attachment
        user_message = UserMessage(
            text=prompt,
            file_contents=[file_attachment]
        )
        
        try:
            response = await chat.send_message(user_message)
            
            # Parse JSON response
            # Clean response to extract JSON
            response_text = response.strip()
            if response_text.startswith('```json'):
                response_text = response_text[7:-3].strip()
            elif response_text.startswith('```'):
                response_text = response_text[3:-3].strip()
            
            analysis_result = json.loads(response_text)
            return analysis_result
            
        except json.JSONDecodeError as e:
            # Fallback if JSON parsing fails
            return {
                "confidence_score": 50,
                "status": "needs_review",
                "discrepancies": [{
                    "type": "analysis_error",
                    "severity": "high",
                    "location": "AI Analysis",
                    "description": "Unable to parse AI response. Manual review required.",
                    "recommendation": "Review document manually"
                }],
                "key_information": {},
                "summary": "AI analysis encountered an error. Manual review required.",
                "recommendations": ["Conduct manual document review"]
            }
        except Exception as e:
            return {
                "confidence_score": 0,
                "status": "needs_review",
                "discrepancies": [{
                    "type": "analysis_error",
                    "severity": "high",
                    "location": "AI Analysis",
                    "description": f"Analysis failed: {str(e)}",
                    "recommendation": "Review document manually"
                }],
                "key_information": {},
                "summary": f"Analysis failed: {str(e)}",
                "recommendations": ["Retry analysis or conduct manual review"]
            }
    
    def _get_analysis_prompt(self, document_type: str) -> str:
        """Get specialized prompt based on document type"""
        
        prompts = {
            "power_of_attorney": """
Analyze this Power of Attorney document. Check for:
- Principal and agent names clearly stated
- Powers granted are specific and clear
- Effective dates and expiration dates
- Signature lines and witness requirements
- State-specific requirements
- No ambiguous language
""",
            "real_estate": """
Analyze this real estate document. Check for:
- Property address and legal description
- Buyer and seller information
- Purchase price and terms
- Closing date
- Contingencies clearly stated
- All required disclosures
""",
            "affidavit": """
Analyze this affidavit. Check for:
- Affiant's name and statement
- Facts are stated clearly
- Notary acknowledgment section
- Date and place of execution
- Oath or affirmation language
""",
            "will": """
Analyze this Last Will & Testament. Check for:
- Testator's name and declarations
- Executor designation
- Beneficiary information
- Asset distribution instructions
- Witness requirements (typically 2 witnesses)
- Testamentary capacity language
""",
            "contract": """
Analyze this contract. Check for:
- Parties to the agreement clearly identified
- Consideration (exchange of value)
- Terms and conditions clearly stated
- Obligations of each party
- Termination clauses
- Signature blocks for all parties
"""
        }
        
        specific_prompt = prompts.get(document_type, """
Analyze this document thoroughly. Check for:
- All parties clearly identified
- Dates are consistent and logical
- Required signatures and witness lines
- No missing or incomplete information
- Proper formatting and structure
- Any suspicious alterations or irregularities
""")
        
        return f"""
Please analyze the attached document.

{specific_prompt}

Provide your analysis in the required JSON format with confidence score, discrepancies, key information, and recommendations.
"""