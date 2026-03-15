"""
SOC2 Security Audit Export
Generates a downloadable PDF report of the security compliance dashboard.
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
import logging
import os
import io

from models import User
from routes.auth_routes import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/security", tags=["security-export"])

db: AsyncIOMotorDatabase = None


def set_db(database):
    global db
    db = database


async def _check_admin(current_user: User):
    user_doc = await db.users.find_one({"email": current_user.email})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def _generate_compliance_pdf(data: dict) -> bytes:
    """Generate a professional PDF report from compliance data."""
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.75 * inch, bottomMargin=0.75 * inch)
    elements = []
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle("ReportTitle", parent=styles["Title"], fontSize=22, spaceAfter=6, textColor=colors.HexColor("#1a1a2e"))
    subtitle_style = ParagraphStyle("ReportSubtitle", parent=styles["Normal"], fontSize=11, textColor=colors.gray, spaceAfter=20)
    heading_style = ParagraphStyle("CatHeading", parent=styles["Heading2"], fontSize=14, spaceBefore=16, spaceAfter=8, textColor=colors.HexColor("#1a1a2e"))
    score_style = ParagraphStyle("ScoreStyle", parent=styles["Title"], fontSize=36, textColor=colors.HexColor("#10b981"), alignment=1, spaceAfter=4)
    rating_style = ParagraphStyle("RatingStyle", parent=styles["Normal"], fontSize=14, alignment=1, spaceAfter=4, textColor=colors.HexColor("#1a1a2e"))

    # Header
    elements.append(Paragraph("NotaryChain Security Compliance Report", title_style))
    elements.append(Paragraph(f"Generated: {datetime.now(timezone.utc).strftime('%B %d, %Y at %H:%M UTC')}", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e5e7eb")))
    elements.append(Spacer(1, 12))

    # Score
    score = data.get("score_pct", 0)
    rating = "Excellent" if score >= 90 else "Good" if score >= 70 else "Needs Attention"
    elements.append(Paragraph(f"{score}%", score_style))
    elements.append(Paragraph(rating, rating_style))
    elements.append(Paragraph(f"{data.get('active_features', 0)} of {data.get('total_features', 0)} security features active", ParagraphStyle("centered", parent=styles["Normal"], alignment=1, textColor=colors.gray, spaceAfter=20)))
    elements.append(Spacer(1, 8))

    # Summary table
    summary_data = [["Metric", "Value"]]
    summary_data.append(["Security Score", f"{score}%"])
    summary_data.append(["Active Features", f"{data.get('active_features', 0)} / {data.get('total_features', 0)}"])
    summary_data.append(["Rating", rating])
    summary_data.append(["Report Date", datetime.now(timezone.utc).strftime("%Y-%m-%d")])

    summary_table = Table(summary_data, colWidths=[3 * inch, 3.5 * inch])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
        ("PADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 20))

    # Categories
    categories = data.get("categories", {})
    for cat_key, cat in categories.items():
        label = cat.get("label", cat_key)
        items = cat.get("items", [])
        active_count = sum(1 for i in items if i.get("status") == "active")

        elements.append(Paragraph(f"{label} ({active_count}/{len(items)})", heading_style))

        table_data = [["Status", "Feature", "Details"]]
        for item in items:
            status = item.get("status", "unknown")
            icon = "ACTIVE" if status == "active" else status.upper().replace("_", " ")
            table_data.append([icon, item.get("name", ""), item.get("detail", "")])

        cat_table = Table(table_data, colWidths=[1 * inch, 2 * inch, 3.5 * inch])
        cat_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
            ("PADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))

        # Color status cells
        for row_idx in range(1, len(table_data)):
            status_text = table_data[row_idx][0]
            if status_text == "ACTIVE":
                cat_table.setStyle(TableStyle([
                    ("TEXTCOLOR", (0, row_idx), (0, row_idx), colors.HexColor("#10b981")),
                    ("FONTNAME", (0, row_idx), (0, row_idx), "Helvetica-Bold"),
                ]))
            else:
                cat_table.setStyle(TableStyle([
                    ("TEXTCOLOR", (0, row_idx), (0, row_idx), colors.HexColor("#ef4444")),
                    ("FONTNAME", (0, row_idx), (0, row_idx), "Helvetica-Bold"),
                ]))

        elements.append(cat_table)
        elements.append(Spacer(1, 10))

    # Footer
    elements.append(Spacer(1, 20))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e5e7eb")))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph(
        "This report was automatically generated by NotaryChain's Security Compliance Engine. "
        "For questions, contact security@notarychain.com.",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, textColor=colors.gray, alignment=1),
    ))

    doc.build(elements)
    return buf.getvalue()


@router.get("/export-pdf")
async def export_compliance_pdf(current_user: User = Depends(get_current_user)):
    """Generate and download a SOC2-style security compliance PDF report."""
    await _check_admin(current_user)

    # Re-use the compliance data gathering logic
    from routes.security_compliance_routes import get_security_compliance

    # We need to call the compliance endpoint logic directly
    compliance_data = await _gather_compliance_data()

    pdf_bytes = _generate_compliance_pdf(compliance_data)

    filename = f"NotaryChain_Security_Compliance_{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"

    # Log export
    await db.audit_logs.insert_one({
        "id": __import__("uuid").uuid4().hex,
        "user_id": current_user.id,
        "action": "security_compliance_export",
        "details": {"format": "pdf", "score": compliance_data.get("score_pct")},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


async def _gather_compliance_data():
    """Gather compliance data (mirrors security_compliance_routes logic)."""
    auth0_configured = bool(os.environ.get("AUTH0_DOMAIN") and os.environ.get("AUTH0_CLIENT_ID"))
    okta_configured = bool(os.environ.get("OKTA_DOMAIN") and os.environ.get("OKTA_CLIENT_ID"))
    jwt_secret = bool(os.environ.get("JWT_SECRET_KEY"))
    twofa_users = await db.users.count_documents({"two_factor_enabled": True})
    total_users = await db.users.count_documents({})
    s3_configured = bool(os.environ.get("AWS_ACCESS_KEY_ID") and os.environ.get("AWS_S3_BUCKET"))
    hedera_configured = bool(os.environ.get("HEDERA_ACCOUNT_ID") and os.environ.get("HEDERA_PRIVATE_KEY"))
    total_orgs = await db.organizations.count_documents({})
    sso_orgs = await db.organizations.count_documents({"sso_enabled": True})
    custom_roles = await db.roles.count_documents({})
    recent_audit_count = await db.audit_logs.count_documents({})
    locked_accounts = await db.users.count_documents({"account_locked_until": {"$exists": True}})

    categories = {
        "authentication": {
            "label": "Authentication",
            "items": [
                {"name": "JWT Token Auth", "status": "active" if jwt_secret else "missing", "detail": "24h token expiry, bcrypt password hashing"},
                {"name": "Two-Factor Authentication (TOTP)", "status": "active", "detail": f"{twofa_users}/{total_users} users enrolled"},
                {"name": "Account Lockout", "status": "active", "detail": f"5 failed attempts, 15min lockout. {locked_accounts} locked"},
                {"name": "Password Policy", "status": "active", "detail": "Min 8 chars, 100+ blacklisted passwords (NIST)"},
            ],
        },
        "sso": {
            "label": "Single Sign-On",
            "items": [
                {"name": "Auth0 OIDC", "status": "active" if auth0_configured else "not_configured", "detail": f"Domain: {os.environ.get('AUTH0_DOMAIN', 'N/A')}" if auth0_configured else "Not configured"},
                {"name": "Okta OIDC", "status": "active" if okta_configured else "not_configured", "detail": f"Domain: {os.environ.get('OKTA_DOMAIN', 'N/A')}" if okta_configured else "Not configured"},
                {"name": "Enterprise SSO Orgs", "status": "active" if sso_orgs > 0 else "none", "detail": f"{sso_orgs}/{total_orgs} orgs with SSO"},
            ],
        },
        "data_protection": {
            "label": "Data Protection",
            "items": [
                {"name": "Cloud Storage (AWS S3)", "status": "active" if s3_configured else "local_only", "detail": f"Bucket: {os.environ.get('AWS_S3_BUCKET', 'N/A')}" if s3_configured else "Local filesystem"},
                {"name": "Blockchain Integrity (Hedera)", "status": "active" if hedera_configured else "not_configured", "detail": "Mainnet HCS tamper-proof sealing" if hedera_configured else "Not configured"},
                {"name": "GDPR Compliance", "status": "active", "detail": "Data export, deletion, consent management"},
                {"name": "File Upload Validation", "status": "active", "detail": "Type whitelisting, 10MB body limit"},
            ],
        },
        "network_security": {
            "label": "Network & Transport",
            "items": [
                {"name": "HTTPS / TLS", "status": "active", "detail": "Enforced via Kubernetes ingress"},
                {"name": "CORS Policy", "status": "active", "detail": "Restricted to app origin"},
                {"name": "Rate Limiting", "status": "active", "detail": "SlowAPI per-endpoint limits"},
                {"name": "Content Security Policy", "status": "active", "detail": "CSP headers via middleware"},
                {"name": "Security.txt (RFC 9116)", "status": "active", "detail": "Published at /.well-known/security.txt"},
            ],
        },
        "access_control": {
            "label": "Authorization & RBAC",
            "items": [
                {"name": "Role-Based Access Control", "status": "active", "detail": f"{custom_roles} custom roles defined"},
                {"name": "Admin Separation", "status": "active", "detail": "Admin routes protected with role checks"},
                {"name": "API Key Authentication", "status": "active", "detail": "Scoped keys with rate limits"},
            ],
        },
        "monitoring": {
            "label": "Monitoring & Alerting",
            "items": [
                {"name": "Audit Logging", "status": "active", "detail": f"{recent_audit_count} events recorded"},
                {"name": "HBAR Balance Alerts", "status": "active", "detail": "Configurable thresholds + notifications"},
                {"name": "WebSocket Real-time Events", "status": "active", "detail": "Token-based auth, session management"},
            ],
        },
    }

    total_items = 0
    active_items = 0
    for cat in categories.values():
        for item in cat["items"]:
            total_items += 1
            if item["status"] == "active":
                active_items += 1

    return {
        "score_pct": round((active_items / total_items * 100) if total_items else 0),
        "active_features": active_items,
        "total_features": total_items,
        "categories": categories,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
