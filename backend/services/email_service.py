"""
Email Service using Resend API
Handles all transactional email notifications for the NotaryChain platform
"""

import os
import asyncio
import logging
import resend
from typing import Optional
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Initialize Resend
resend.api_key = os.environ.get("RESEND_API_KEY")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
APP_NAME = "NotaryChain"


class EmailService:
    """Service for sending transactional emails"""
    
    @staticmethod
    async def send_email(
        to_email: str,
        subject: str,
        html_content: str
    ) -> dict:
        """Send an email using Resend API (non-blocking)"""
        params = {
            "from": f"{APP_NAME} <{SENDER_EMAIL}>",
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        
        try:
            # Run sync SDK in thread to keep FastAPI non-blocking
            result = await asyncio.to_thread(resend.Emails.send, params)
            logger.info(f"Email sent to {to_email}: {subject}")
            return {
                "success": True,
                "email_id": result.get("id"),
                "to": to_email
            }
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "to": to_email
            }
    
    # ===== User Authentication Emails =====
    
    @staticmethod
    async def send_welcome_email(email: str, full_name: str) -> dict:
        """Send welcome email after user registration"""
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0a; color: #ffffff; margin: 0; padding: 0; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
                .header {{ text-align: center; margin-bottom: 40px; }}
                .logo {{ font-size: 28px; font-weight: bold; color: #00d4aa; }}
                .content {{ background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 40px; border: 1px solid #333; }}
                h1 {{ color: #ffffff; margin: 0 0 20px 0; font-size: 24px; }}
                p {{ color: #b0b0b0; line-height: 1.8; margin: 0 0 16px 0; }}
                .highlight {{ color: #00d4aa; font-weight: 600; }}
                .button {{ display: inline-block; background: linear-gradient(135deg, #00d4aa 0%, #00a89d 100%); color: #000000; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 40px; color: #666; font-size: 12px; }}
                .features {{ margin: 30px 0; }}
                .feature {{ display: flex; align-items: center; margin: 12px 0; color: #b0b0b0; }}
                .check {{ color: #00d4aa; margin-right: 10px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">NotaryChain</div>
                </div>
                <div class="content">
                    <h1>Welcome to NotaryChain, {full_name}!</h1>
                    <p>Thank you for joining the future of digital notarization. Your account has been successfully created.</p>
                    
                    <div class="features">
                        <div class="feature"><span class="check">&#10003;</span> AI-Powered Document Analysis</div>
                        <div class="feature"><span class="check">&#10003;</span> Blockchain-Sealed Verification</div>
                        <div class="feature"><span class="check">&#10003;</span> Remote Online Notarization</div>
                        <div class="feature"><span class="check">&#10003;</span> Biometric Identity Verification</div>
                    </div>
                    
                    <p>You can now upload documents, request notarizations, and experience secure, tamper-proof document verification powered by <span class="highlight">Hedera Hashgraph</span>.</p>
                    
                    <p style="color: #888; font-size: 14px; margin-top: 30px;">If you have any questions, our support team is here to help.</p>
                </div>
                <div class="footer">
                    <p>&copy; {datetime.now().year} NotaryChain. All rights reserved.</p>
                    <p>Secure. Immutable. Trusted.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return await EmailService.send_email(
            to_email=email,
            subject=f"Welcome to {APP_NAME}!",
            html_content=html
        )
    
    # ===== Notarization Emails =====
    
    @staticmethod
    async def send_notarization_complete_email(
        email: str,
        full_name: str,
        request_id: str,
        document_type: str,
        seal_hash: Optional[str] = None,
        hcs_topic_id: Optional[str] = None
    ) -> dict:
        """Send notification when notarization is completed"""
        blockchain_info = ""
        if seal_hash or hcs_topic_id:
            blockchain_info = f"""
            <div style="background: #0d1b2a; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #00d4aa;">
                <p style="color: #00d4aa; font-weight: 600; margin: 0 0 10px 0;">Blockchain Verification</p>
                {"<p style='color: #888; font-size: 13px; margin: 5px 0;'>Seal Hash: <code style='background: #1a1a2e; padding: 2px 6px; border-radius: 4px;'>" + (seal_hash[:20] + "..." if seal_hash else "N/A") + "</code></p>" if seal_hash else ""}
                {"<p style='color: #888; font-size: 13px; margin: 5px 0;'>HCS Topic: <code style='background: #1a1a2e; padding: 2px 6px; border-radius: 4px;'>" + str(hcs_topic_id) + "</code></p>" if hcs_topic_id else ""}
            </div>
            """
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0a; color: #ffffff; margin: 0; padding: 0; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
                .header {{ text-align: center; margin-bottom: 40px; }}
                .logo {{ font-size: 28px; font-weight: bold; color: #00d4aa; }}
                .content {{ background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 40px; border: 1px solid #333; }}
                .success-badge {{ display: inline-block; background: #00d4aa; color: #000; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 20px; }}
                h1 {{ color: #ffffff; margin: 0 0 20px 0; font-size: 24px; }}
                p {{ color: #b0b0b0; line-height: 1.8; margin: 0 0 16px 0; }}
                .detail-row {{ display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #333; }}
                .detail-label {{ color: #888; }}
                .detail-value {{ color: #fff; font-weight: 500; }}
                .footer {{ text-align: center; margin-top: 40px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">NotaryChain</div>
                </div>
                <div class="content">
                    <span class="success-badge">NOTARIZATION COMPLETE</span>
                    <h1>Your Document Has Been Notarized</h1>
                    <p>Hi {full_name},</p>
                    <p>Great news! Your notarization request has been successfully completed and sealed on the blockchain.</p>
                    
                    <div style="margin: 30px 0;">
                        <div class="detail-row">
                            <span class="detail-label">Request ID</span>
                            <span class="detail-value">{request_id[:16]}...</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Document Type</span>
                            <span class="detail-value">{document_type}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Status</span>
                            <span class="detail-value" style="color: #00d4aa;">Completed & Sealed</span>
                        </div>
                    </div>
                    
                    {blockchain_info}
                    
                    <p>You can view the full details and blockchain audit trail in your dashboard.</p>
                </div>
                <div class="footer">
                    <p>&copy; {datetime.now().year} NotaryChain. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return await EmailService.send_email(
            to_email=email,
            subject=f"Notarization Complete - {document_type}",
            html_content=html
        )
    
    # ===== Notary Application Emails =====
    
    @staticmethod
    async def send_application_submitted_email(email: str, full_name: str) -> dict:
        """Send confirmation when notary application is submitted"""
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0a; color: #ffffff; margin: 0; padding: 0; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
                .header {{ text-align: center; margin-bottom: 40px; }}
                .logo {{ font-size: 28px; font-weight: bold; color: #00d4aa; }}
                .content {{ background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 40px; border: 1px solid #333; }}
                .pending-badge {{ display: inline-block; background: #ffd700; color: #000; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 20px; }}
                h1 {{ color: #ffffff; margin: 0 0 20px 0; font-size: 24px; }}
                p {{ color: #b0b0b0; line-height: 1.8; margin: 0 0 16px 0; }}
                .steps {{ margin: 30px 0; }}
                .step {{ display: flex; margin: 16px 0; }}
                .step-num {{ background: #00d4aa; color: #000; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; margin-right: 16px; flex-shrink: 0; }}
                .step-text {{ color: #b0b0b0; }}
                .footer {{ text-align: center; margin-top: 40px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">NotaryChain</div>
                </div>
                <div class="content">
                    <span class="pending-badge">APPLICATION RECEIVED</span>
                    <h1>Notary Application Submitted</h1>
                    <p>Hi {full_name},</p>
                    <p>Thank you for applying to become a certified notary on NotaryChain. We've received your application and our team will review it shortly.</p>
                    
                    <div class="steps">
                        <p style="color: #fff; font-weight: 600;">What happens next:</p>
                        <div class="step">
                            <span class="step-num">1</span>
                            <span class="step-text">Our team reviews your credentials and documents</span>
                        </div>
                        <div class="step">
                            <span class="step-num">2</span>
                            <span class="step-text">We verify your notary commission and certifications</span>
                        </div>
                        <div class="step">
                            <span class="step-num">3</span>
                            <span class="step-text">You'll receive an email with our decision</span>
                        </div>
                    </div>
                    
                    <p>Review typically takes 1-3 business days. Make sure you've uploaded all required documents to speed up the process.</p>
                </div>
                <div class="footer">
                    <p>&copy; {datetime.now().year} NotaryChain. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return await EmailService.send_email(
            to_email=email,
            subject=f"Notary Application Received - {APP_NAME}",
            html_content=html
        )
    
    @staticmethod
    async def send_application_approved_email(
        email: str,
        full_name: str,
        commission_number: Optional[str] = None
    ) -> dict:
        """Send notification when notary application is approved"""
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0a; color: #ffffff; margin: 0; padding: 0; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
                .header {{ text-align: center; margin-bottom: 40px; }}
                .logo {{ font-size: 28px; font-weight: bold; color: #00d4aa; }}
                .content {{ background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 40px; border: 1px solid #333; }}
                .approved-badge {{ display: inline-block; background: #00d4aa; color: #000; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 20px; }}
                h1 {{ color: #ffffff; margin: 0 0 20px 0; font-size: 24px; }}
                p {{ color: #b0b0b0; line-height: 1.8; margin: 0 0 16px 0; }}
                .highlight {{ color: #00d4aa; font-weight: 600; }}
                .button {{ display: inline-block; background: linear-gradient(135deg, #00d4aa 0%, #00a89d 100%); color: #000000; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 40px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">NotaryChain</div>
                </div>
                <div class="content">
                    <span class="approved-badge">APPROVED</span>
                    <h1>Congratulations, {full_name}!</h1>
                    <p>Your notary application has been <span class="highlight">approved</span>! You are now a certified notary on the NotaryChain platform.</p>
                    
                    {"<p>Commission Number: <span class='highlight'>" + commission_number + "</span></p>" if commission_number else ""}
                    
                    <p>You can now:</p>
                    <ul style="color: #b0b0b0; line-height: 2;">
                        <li>Accept notarization requests from clients</li>
                        <li>Conduct remote online notarizations</li>
                        <li>Seal documents on the Hedera blockchain</li>
                        <li>Access the Notary Dashboard</li>
                    </ul>
                    
                    <p>Log in to your dashboard to start accepting requests.</p>
                </div>
                <div class="footer">
                    <p>&copy; {datetime.now().year} NotaryChain. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return await EmailService.send_email(
            to_email=email,
            subject=f"Notary Application Approved - Welcome to {APP_NAME}!",
            html_content=html
        )
    
    @staticmethod
    async def send_application_rejected_email(
        email: str,
        full_name: str,
        reason: Optional[str] = None
    ) -> dict:
        """Send notification when notary application is rejected"""
        reason_section = ""
        if reason:
            reason_section = f"""
            <div style="background: #2d1f1f; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #ff6b6b;">
                <p style="color: #ff6b6b; font-weight: 600; margin: 0 0 10px 0;">Reason for Rejection</p>
                <p style="color: #b0b0b0; margin: 0;">{reason}</p>
            </div>
            """
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0a; color: #ffffff; margin: 0; padding: 0; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
                .header {{ text-align: center; margin-bottom: 40px; }}
                .logo {{ font-size: 28px; font-weight: bold; color: #00d4aa; }}
                .content {{ background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 40px; border: 1px solid #333; }}
                .rejected-badge {{ display: inline-block; background: #ff6b6b; color: #fff; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 20px; }}
                h1 {{ color: #ffffff; margin: 0 0 20px 0; font-size: 24px; }}
                p {{ color: #b0b0b0; line-height: 1.8; margin: 0 0 16px 0; }}
                .footer {{ text-align: center; margin-top: 40px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">NotaryChain</div>
                </div>
                <div class="content">
                    <span class="rejected-badge">NOT APPROVED</span>
                    <h1>Application Update</h1>
                    <p>Hi {full_name},</p>
                    <p>Thank you for your interest in becoming a notary on NotaryChain. After careful review, we were unable to approve your application at this time.</p>
                    
                    {reason_section}
                    
                    <p>If you believe this decision was made in error, or if you have additional documentation to provide, please contact our support team.</p>
                    
                    <p>You may reapply after addressing the concerns mentioned above.</p>
                </div>
                <div class="footer">
                    <p>&copy; {datetime.now().year} NotaryChain. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return await EmailService.send_email(
            to_email=email,
            subject=f"Notary Application Update - {APP_NAME}",
            html_content=html
        )
    
    # ===== Notarization Request Emails =====
    
    @staticmethod
    async def send_request_assigned_email(
        email: str,
        full_name: str,
        request_id: str,
        notary_name: str,
        document_type: str
    ) -> dict:
        """Send notification when a notary is assigned to a request"""
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0a; color: #ffffff; margin: 0; padding: 0; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
                .header {{ text-align: center; margin-bottom: 40px; }}
                .logo {{ font-size: 28px; font-weight: bold; color: #00d4aa; }}
                .content {{ background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 40px; border: 1px solid #333; }}
                .info-badge {{ display: inline-block; background: #3b82f6; color: #fff; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 20px; }}
                h1 {{ color: #ffffff; margin: 0 0 20px 0; font-size: 24px; }}
                p {{ color: #b0b0b0; line-height: 1.8; margin: 0 0 16px 0; }}
                .highlight {{ color: #00d4aa; font-weight: 600; }}
                .detail-box {{ background: #0d1b2a; border-radius: 8px; padding: 20px; margin: 20px 0; }}
                .detail-row {{ display: flex; justify-content: space-between; padding: 8px 0; }}
                .detail-label {{ color: #888; }}
                .detail-value {{ color: #fff; }}
                .footer {{ text-align: center; margin-top: 40px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">NotaryChain</div>
                </div>
                <div class="content">
                    <span class="info-badge">NOTARY ASSIGNED</span>
                    <h1>Your Request Has Been Assigned</h1>
                    <p>Hi {full_name},</p>
                    <p>Great news! A certified notary has been assigned to your notarization request.</p>
                    
                    <div class="detail-box">
                        <div class="detail-row">
                            <span class="detail-label">Notary</span>
                            <span class="detail-value">{notary_name}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Document</span>
                            <span class="detail-value">{document_type}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Request ID</span>
                            <span class="detail-value">{request_id[:16]}...</span>
                        </div>
                    </div>
                    
                    <p>The notary will contact you to schedule the video session. Please ensure your documents are ready for review.</p>
                </div>
                <div class="footer">
                    <p>&copy; {datetime.now().year} NotaryChain. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return await EmailService.send_email(
            to_email=email,
            subject=f"Notary Assigned to Your Request - {APP_NAME}",
            html_content=html
        )


# Singleton instance
email_service = EmailService()
