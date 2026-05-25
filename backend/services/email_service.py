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
from services.task_manager import task_manager

load_dotenv()

logger = logging.getLogger(__name__)

# ─── Custom Domain Auto-Switch ─────────────────────────────────────────────
# If RESEND_API_KEY_CUSTOM is set, we activate the NotaryChain custom domain
# (email.notarychain.app) with a dedicated key. Otherwise we use the default
# Resend key, which may already have the custom domain verified under the
# same account.
_CUSTOM_KEY = os.environ.get("RESEND_API_KEY_CUSTOM", "").strip()
_CUSTOM_SENDER = os.environ.get("CUSTOM_SENDER_EMAIL", "").strip()
_CUSTOM_DOMAIN = os.environ.get("CUSTOM_EMAIL_DOMAIN", "").strip()
_DEFAULT_KEY = os.environ.get("RESEND_API_KEY", "").strip()
_DEFAULT_SENDER = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev").strip()

if _CUSTOM_KEY and _CUSTOM_SENDER:
    resend.api_key = _CUSTOM_KEY
    SENDER_EMAIL = _CUSTOM_SENDER
    EMAIL_MODE = "custom_domain"
    logger.info(f"Resend email service using CUSTOM key + domain: {SENDER_EMAIL}")
else:
    resend.api_key = _DEFAULT_KEY
    SENDER_EMAIL = _DEFAULT_SENDER
    # Determine mode from the *active* sender domain, not just the key presence.
    # If the sender already uses the NotaryChain custom domain, we are in
    # production custom_domain mode regardless of which key is in use.
    _sender_domain = SENDER_EMAIL.split("@")[-1].lower() if "@" in SENDER_EMAIL else ""
    if _CUSTOM_DOMAIN and _sender_domain == _CUSTOM_DOMAIN.lower():
        EMAIL_MODE = "custom_domain"
        logger.info(f"Resend email service using CUSTOM domain under default key: {SENDER_EMAIL}")
    else:
        EMAIL_MODE = "sandbox"
        logger.info(f"Resend email service using sandbox sender: {SENDER_EMAIL}")

APP_NAME = "NotaryChain"


class EmailService:
    """Service for sending transactional emails"""
    
    @staticmethod
    async def send_email(
        to_email: str,
        subject: str,
        html_content: str
    ) -> dict:
        """Send an email using Resend API (non-blocking) with job tracking"""
        job_id = task_manager.create_job("email", f"Sending email: {subject} to {to_email}")
        task_manager.start_job(job_id)

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
            task_manager.complete_job(job_id, {"email_id": result.get("id"), "to": to_email})
            return {
                "success": True,
                "email_id": result.get("id"),
                "to": to_email,
                "job_id": job_id
            }
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            task_manager.fail_job(job_id, str(e))
            return {
                "success": False,
                "error": str(e),
                "to": to_email,
                "job_id": job_id
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
        hcs_topic_id: Optional[str] = None,
        package_data: Optional[dict] = None
    ) -> dict:
        """Send comprehensive notarization completion email with full session package"""

        # --- Blockchain Verification Section ---
        blockchain_section = ""
        explorer_url = ""
        if package_data and package_data.get("blockchain_seal"):
            bs = package_data["blockchain_seal"]
            explorer_url = bs.get("explorer_url", "")
            blockchain_section = f"""
            <div style="background: #0d1b2a; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #00d4aa;">
                <p style="color: #00d4aa; font-weight: 700; margin: 0 0 16px 0; font-size: 15px;">Hedera Blockchain Proof</p>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="color: #888; padding: 6px 0; font-size: 13px;">Network</td><td style="color: #fff; padding: 6px 0; font-size: 13px; text-align: right;">{package_data.get('network', 'mainnet')}</td></tr>
                    {f'<tr><td style="color: #888; padding: 6px 0; font-size: 13px;">Seal Hash</td><td style="color: #fff; padding: 6px 0; font-size: 13px; text-align: right; word-break: break-all;"><code style="background: #1a1a2e; padding: 2px 6px; border-radius: 4px; font-size: 11px;">{seal_hash[:32]}...</code></td></tr>' if seal_hash else ''}
                    {f'<tr><td style="color: #888; padding: 6px 0; font-size: 13px;">HCS Topic</td><td style="color: #fff; padding: 6px 0; font-size: 13px; text-align: right;">{hcs_topic_id}</td></tr>' if hcs_topic_id else ''}
                    {f'<tr><td style="color: #888; padding: 6px 0; font-size: 13px;">Transaction ID</td><td style="color: #fff; padding: 6px 0; font-size: 13px; text-align: right;">{bs.get("transaction_id", "N/A")}</td></tr>' if bs.get("transaction_id") else ''}
                    {f'<tr><td style="color: #888; padding: 6px 0; font-size: 13px;">Package ID</td><td style="color: #fff; padding: 6px 0; font-size: 13px; text-align: right;">{package_data.get("package_id", "")[:16]}...</td></tr>' if package_data.get("package_id") else ''}
                </table>
                {f'<a href="{explorer_url}" style="display: inline-block; background: rgba(0,212,170,0.15); color: #00d4aa; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px; font-size: 13px; border: 1px solid rgba(0,212,170,0.3);">View on HashScan Explorer</a>' if explorer_url else ''}
            </div>
            """
        elif seal_hash or hcs_topic_id:
            blockchain_section = f"""
            <div style="background: #0d1b2a; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #00d4aa;">
                <p style="color: #00d4aa; font-weight: 700; margin: 0 0 12px 0;">Blockchain Verification</p>
                {"<p style='color: #888; font-size: 13px; margin: 5px 0;'>Seal Hash: <code style='background: #1a1a2e; padding: 2px 6px; border-radius: 4px;'>" + (seal_hash[:20] + "..." if seal_hash else "N/A") + "</code></p>" if seal_hash else ""}
                {"<p style='color: #888; font-size: 13px; margin: 5px 0;'>HCS Topic: <code style='background: #1a1a2e; padding: 2px 6px; border-radius: 4px;'>" + str(hcs_topic_id) + "</code></p>" if hcs_topic_id else ""}
            </div>
            """

        # --- AI Document Analysis Section ---
        ai_section = ""
        if package_data and package_data.get("document_analysis"):
            da = package_data["document_analysis"]
            count = da.get("total_analyses", 0)
            ai_section = f"""
            <div style="background: #0d1b2a; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #3b82f6;">
                <p style="color: #3b82f6; font-weight: 700; margin: 0 0 12px 0; font-size: 15px;">AI Document Analysis</p>
                <p style="color: #b0b0b0; font-size: 13px; margin: 0;">{count} document{'s' if count != 1 else ''} analyzed by AI for authenticity, completeness, and compliance.</p>
                {''.join(f'<div style="background: #111827; border-radius: 8px; padding: 12px; margin-top: 10px;"><p style="color: #fff; font-size: 13px; margin: 0 0 4px 0;">{a.get("filename", "Document")}</p><p style="color: #888; font-size: 12px; margin: 0;">Type: {a.get("document_type", "General")} | Status: <span style="color: #00d4aa;">Verified</span></p></div>' for a in da.get("analyses", [])[:3])}
            </div>
            """

        # --- Biometric Verification Section ---
        bio_section = ""
        if package_data and package_data.get("biometric_verification"):
            bv = package_data["biometric_verification"]
            summary = bv.get("summary", {})
            status_color = "#00d4aa" if summary.get("status") == "verified" else "#ffd700" if summary.get("status") == "partial" else "#ff6b6b"
            status_text = summary.get("status", "none").upper()
            bio_section = f"""
            <div style="background: #0d1b2a; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid {status_color};">
                <p style="color: {status_color}; font-weight: 700; margin: 0 0 12px 0; font-size: 15px;">Biometric Verification</p>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="color: #888; padding: 4px 0; font-size: 13px;">Status</td><td style="color: {status_color}; padding: 4px 0; font-size: 13px; text-align: right; font-weight: 600;">{status_text}</td></tr>
                    <tr><td style="color: #888; padding: 4px 0; font-size: 13px;">Verifications Performed</td><td style="color: #fff; padding: 4px 0; font-size: 13px; text-align: right;">{summary.get('total', 0)}</td></tr>
                    <tr><td style="color: #888; padding: 4px 0; font-size: 13px;">Passed</td><td style="color: #00d4aa; padding: 4px 0; font-size: 13px; text-align: right;">{summary.get('passed', 0)}</td></tr>
                    {f'<tr><td style="color: #888; padding: 4px 0; font-size: 13px;">Avg Confidence</td><td style="color: #fff; padding: 4px 0; font-size: 13px; text-align: right;">{summary.get("average_confidence", 0)}%</td></tr>' if summary.get('average_confidence') else ''}
                </table>
            </div>
            """

        # --- Notary Session Section ---
        notary_section = ""
        if package_data and package_data.get("participants", {}).get("notary"):
            n = package_data["participants"]["notary"]
            vs = package_data.get("video_sessions", {}).get("summary", {})
            notary_section = f"""
            <div style="background: #0d1b2a; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #a855f7;">
                <p style="color: #a855f7; font-weight: 700; margin: 0 0 12px 0; font-size: 15px;">Notary Session Details</p>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="color: #888; padding: 4px 0; font-size: 13px;">Notary</td><td style="color: #fff; padding: 4px 0; font-size: 13px; text-align: right;">{n.get('full_name', 'N/A')}</td></tr>
                    {f'<tr><td style="color: #888; padding: 4px 0; font-size: 13px;">License #</td><td style="color: #fff; padding: 4px 0; font-size: 13px; text-align: right;">{n.get("license_number")}</td></tr>' if n.get('license_number') else ''}
                    {f'<tr><td style="color: #888; padding: 4px 0; font-size: 13px;">State</td><td style="color: #fff; padding: 4px 0; font-size: 13px; text-align: right;">{n.get("license_state")}</td></tr>' if n.get('license_state') else ''}
                    {'<tr><td style="color: #888; padding: 4px 0; font-size: 13px;">RON Certified</td><td style="color: #00d4aa; padding: 4px 0; font-size: 13px; text-align: right;">Yes</td></tr>' if n.get('ron_certified') else ''}
                    {f'<tr><td style="color: #888; padding: 4px 0; font-size: 13px;">Video Sessions</td><td style="color: #fff; padding: 4px 0; font-size: 13px; text-align: right;">{vs.get("completed_sessions", 0)} completed ({vs.get("total_duration_minutes", 0)} min)</td></tr>' if vs.get("total_sessions") else ''}
                </table>
            </div>
            """

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0a; color: #ffffff; margin: 0; padding: 0; }}
                .container {{ max-width: 640px; margin: 0 auto; padding: 40px 20px; }}
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
                    <p>Great news! Your notarization request has been successfully completed, verified, and permanently sealed on the Hedera blockchain. Below is your complete session package.</p>
                    
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
                    
                    {ai_section}
                    {bio_section}
                    {notary_section}
                    {blockchain_section}
                    
                    <p style="margin-top: 24px;">You can view the full details, download your certificate, and verify the blockchain audit trail in your <strong style="color: #fff;">dashboard</strong>.</p>
                    <p style="color: #888; font-size: 13px;">This notarization is permanently recorded on the Hedera Hashgraph public ledger and cannot be altered or revoked.</p>
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
            subject=f"Notarization Complete - {document_type} | Full Session Package",
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
    async def send_expiry_notification_email(
        email: str,
        full_name: str,
        document_name: str,
        expiry_label: str,
        is_expired: bool = False,
    ) -> dict:
        """Send notification when a document is nearing expiry or has expired"""
        if is_expired:
            badge_text = "EXPIRED"
            heading = "Your Document Has Expired"
            body_text = f'Your document <span class="highlight">"{document_name}"</span> has expired. Please renew or re-notarize it to maintain its validity.'
            badge_bg = "#ff6b6b"
        else:
            badge_text = f"EXPIRES IN {expiry_label.upper()}"
            heading = "Document Expiring Soon"
            body_text = f'Your document <span class="highlight">"{document_name}"</span> will expire in <strong>{expiry_label}</strong>. Please take action before it becomes invalid.'
            badge_bg = "#ffd700"

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
                .badge {{ display: inline-block; background: {badge_bg}; color: #000; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 20px; }}
                h1 {{ color: #ffffff; margin: 0 0 20px 0; font-size: 24px; }}
                p {{ color: #b0b0b0; line-height: 1.8; margin: 0 0 16px 0; }}
                .highlight {{ color: #00d4aa; font-weight: 600; }}
                .footer {{ text-align: center; margin-top: 40px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">NotaryChain</div>
                </div>
                <div class="content">
                    <span class="badge">{badge_text}</span>
                    <h1>{heading}</h1>
                    <p>Hi {full_name},</p>
                    <p>{body_text}</p>
                    <p>Log in to your dashboard to manage your documents and set up renewals.</p>
                </div>
                <div class="footer">
                    <p>&copy; {datetime.now().year} NotaryChain. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """

        subject = f"Document {'Expired' if is_expired else 'Expiring Soon'}: {document_name}"
        return await EmailService.send_email(to_email=email, subject=subject, html_content=html)

    @staticmethod
    async def send_booking_notification_email(
        email: str,
        notary_name: str,
        user_name: str,
        date: str,
        time_slot: str,
        document_name: str,
        is_new: bool = True,
    ) -> dict:
        """Send booking notification to notary (new) or user (confirmed)"""
        if is_new:
            heading = "New Booking Request"
            body = f'<strong>{user_name}</strong> has booked a notarization session with you.'
            badge_text = "NEW BOOKING"
            badge_bg = "#00d4aa"
        else:
            heading = "Booking Confirmed"
            body = f'Your notarization session with <strong>{notary_name}</strong> has been confirmed.'
            badge_text = "CONFIRMED"
            badge_bg = "#4CAF50"

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
                .badge {{ display: inline-block; background: {badge_bg}; color: #000; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 20px; }}
                h1 {{ color: #ffffff; margin: 0 0 20px 0; font-size: 24px; }}
                p {{ color: #b0b0b0; line-height: 1.8; margin: 0 0 16px 0; }}
                .detail {{ background: rgba(0,212,170,0.1); border: 1px solid rgba(0,212,170,0.3); border-radius: 12px; padding: 16px; margin: 20px 0; }}
                .detail-row {{ display: flex; justify-content: space-between; padding: 4px 0; }}
                .detail-label {{ color: #888; font-size: 14px; }}
                .detail-value {{ color: #fff; font-weight: 600; font-size: 14px; }}
                .footer {{ text-align: center; margin-top: 40px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header"><div class="logo">NotaryChain</div></div>
                <div class="content">
                    <span class="badge">{badge_text}</span>
                    <h1>{heading}</h1>
                    <p>{body}</p>
                    <div class="detail">
                        <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">{date}</span></div>
                        <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">{time_slot}</span></div>
                        <div class="detail-row"><span class="detail-label">Document</span><span class="detail-value">{document_name}</span></div>
                    </div>
                    <p>Log in to your dashboard to manage this booking.</p>
                </div>
                <div class="footer"><p>&copy; {datetime.now().year} NotaryChain. All rights reserved.</p></div>
            </div>
        </body>
        </html>
        """

        subject = f"{'New Booking' if is_new else 'Booking Confirmed'}: {date} {time_slot}"
        return await EmailService.send_email(to_email=email, subject=subject, html_content=html)

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
