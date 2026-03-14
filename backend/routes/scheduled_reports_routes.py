"""
Scheduled Reports Routes
Generates downloadable PDF reports for organizations with configurable schedules.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import FileResponse, RedirectResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
import asyncio
import os
import logging

from routes.auth_routes import get_current_user
from services.storage_service import storage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/organizations", tags=["scheduled-reports"])

db: AsyncIOMotorDatabase = None

REPORTS_DIR = "/app/backend/generated_reports"

def set_db(database):
    global db
    db = database
    os.makedirs(REPORTS_DIR, exist_ok=True)


REPORT_SECTIONS = [
    {"key": "activity", "label": "Activity Summary", "description": "Overview of org actions and events"},
    {"key": "notarizations", "label": "Notarizations", "description": "Document notarization counts and trends"},
    {"key": "members", "label": "Member Changes", "description": "Joins, removals, and role changes"},
    {"key": "webhooks", "label": "Webhook Delivery", "description": "Webhook success rates and failures"},
    {"key": "billing", "label": "Billing & Usage", "description": "Subscription usage and payment activity"},
]
SECTION_KEYS = [s["key"] for s in REPORT_SECTIONS]


# --- Models ---

class ReportConfigRequest(BaseModel):
    frequency: str  # weekly, monthly
    sections: List[str]
    is_active: bool = True

class UpdateReportConfigRequest(BaseModel):
    frequency: Optional[str] = None
    sections: Optional[List[str]] = None
    is_active: Optional[bool] = None


# --- Helpers ---

async def _require_admin(org_id: str, user_id: str):
    membership = await db.org_members.find_one(
        {"org_id": org_id, "user_id": user_id, "status": "active"}, {"_id": 0}
    )
    if not membership or membership["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return membership


async def _aggregate_report_data(org_id: str, days: int, sections: list) -> dict:
    """Aggregate data from various collections for report generation."""
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    data = {"period_days": days, "generated_at": datetime.now(timezone.utc).isoformat()}

    org = await db.organizations.find_one({"id": org_id}, {"_id": 0, "name": 1, "slug": 1, "member_count": 1})
    data["org_name"] = org.get("name", "Organization") if org else "Organization"
    data["org_slug"] = org.get("slug", "") if org else ""
    data["member_count"] = org.get("member_count", 0) if org else 0

    if "activity" in sections:
        total = await db.org_activity_logs.count_documents({"org_id": org_id, "timestamp": {"$gte": start_date}})
        pipeline = [
            {"$match": {"org_id": org_id, "timestamp": {"$gte": start_date}}},
            {"$group": {"_id": "$action", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]
        by_action = await db.org_activity_logs.aggregate(pipeline).to_list(50)
        data["activity"] = {
            "total_events": total,
            "by_action": {item["_id"]: item["count"] for item in by_action},
        }

    if "notarizations" in sections:
        total_docs = await db.documents.count_documents({"created_at": {"$gte": start_date}})
        sealed = await db.documents.count_documents({"created_at": {"$gte": start_date}, "blockchain_sealed": True})
        pending = await db.notary_requests.count_documents({"created_at": {"$gte": start_date}, "status": "pending"})
        completed = await db.notary_requests.count_documents({"created_at": {"$gte": start_date}, "status": "completed"})
        data["notarizations"] = {
            "total_documents": total_docs,
            "blockchain_sealed": sealed,
            "requests_pending": pending,
            "requests_completed": completed,
        }

    if "members" in sections:
        joined = await db.org_members.count_documents({"org_id": org_id, "joined_at": {"$gte": start_date}})
        total_active = await db.org_members.count_documents({"org_id": org_id, "status": "active"})
        roles_count = await db.rbac_roles.count_documents({"org_id": org_id})
        data["members"] = {
            "new_members": joined,
            "total_active": total_active,
            "custom_roles": roles_count,
        }

    if "webhooks" in sections:
        total_wh = await db.org_webhooks.count_documents({"org_id": org_id})
        active_wh = await db.org_webhooks.count_documents({"org_id": org_id, "is_active": True})
        delivered = await db.webhook_deliveries.count_documents({"org_id": org_id, "status": "delivered", "created_at": {"$gte": start_date}})
        failed = await db.webhook_deliveries.count_documents({"org_id": org_id, "status": "failed", "created_at": {"$gte": start_date}})
        data["webhooks"] = {
            "total_webhooks": total_wh,
            "active_webhooks": active_wh,
            "deliveries_success": delivered,
            "deliveries_failed": failed,
            "success_rate": round(delivered / max(delivered + failed, 1) * 100, 1),
        }

    if "billing" in sections:
        members_with_sub = await db.subscriptions.count_documents({"status": {"$in": ["active", "trialing"]}})
        pipeline = [
            {"$match": {"created_at": {"$gte": datetime.now(timezone.utc) - timedelta(days=days)}, "payment_status": "paid"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        ]
        billing_agg = await db.payment_transactions.aggregate(pipeline).to_list(1)
        billing = billing_agg[0] if billing_agg else {"total": 0, "count": 0}
        data["billing"] = {
            "active_subscriptions": members_with_sub,
            "total_revenue": round(billing.get("total", 0), 2),
            "total_transactions": billing.get("count", 0),
        }

    return data


def _generate_pdf(data: dict, org_id: str) -> str:
    """Generate a PDF report from aggregated data."""
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    filename = f"report_{org_id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.pdf"
    filepath = os.path.join(REPORTS_DIR, filename)

    doc = SimpleDocTemplate(filepath, pagesize=letter, topMargin=0.5 * inch, bottomMargin=0.5 * inch)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('ReportTitle', parent=styles['Title'], fontSize=22, textColor=colors.HexColor('#1a1a2e'), spaceAfter=6)
    subtitle_style = ParagraphStyle('ReportSubtitle', parent=styles['Normal'], fontSize=11, textColor=colors.HexColor('#666666'), spaceAfter=20)
    section_style = ParagraphStyle('SectionHeader', parent=styles['Heading2'], fontSize=14, textColor=colors.HexColor('#0d47a1'), spaceBefore=18, spaceAfter=8)
    body_style = ParagraphStyle('BodyText', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor('#333333'), spaceAfter=4)

    elements = []

    # Header
    elements.append(Paragraph("NotaryChain Report", title_style))
    elements.append(Paragraph(f"{data['org_name']} &bull; {data['period_days']}-day period &bull; Generated {datetime.now(timezone.utc).strftime('%B %d, %Y')}", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e0e0e0')))
    elements.append(Spacer(1, 12))

    # Activity Section
    if "activity" in data:
        act = data["activity"]
        elements.append(Paragraph("Activity Summary", section_style))
        elements.append(Paragraph(f"Total events in period: <b>{act['total_events']}</b>", body_style))
        if act["by_action"]:
            table_data = [["Action", "Count"]]
            for action, count in list(act["by_action"].items())[:10]:
                table_data.append([action.replace(".", " ").title(), str(count)])
            t = Table(table_data, colWidths=[3.5 * inch, 1.5 * inch])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e3f2fd')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#0d47a1')),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fafafa')]),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(t)
        elements.append(Spacer(1, 8))

    # Notarizations Section
    if "notarizations" in data:
        nz = data["notarizations"]
        elements.append(Paragraph("Notarizations", section_style))
        table_data = [
            ["Metric", "Value"],
            ["Total Documents", str(nz["total_documents"])],
            ["Blockchain Sealed", str(nz["blockchain_sealed"])],
            ["Requests Pending", str(nz["requests_pending"])],
            ["Requests Completed", str(nz["requests_completed"])],
        ]
        t = Table(table_data, colWidths=[3.5 * inch, 1.5 * inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e8f5e9')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#1b5e20')),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fafafa')]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 8))

    # Members Section
    if "members" in data:
        mb = data["members"]
        elements.append(Paragraph("Member Changes", section_style))
        table_data = [
            ["Metric", "Value"],
            ["New Members (period)", str(mb["new_members"])],
            ["Total Active Members", str(mb["total_active"])],
            ["Custom RBAC Roles", str(mb["custom_roles"])],
        ]
        t = Table(table_data, colWidths=[3.5 * inch, 1.5 * inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#fff3e0')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#e65100')),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fafafa')]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 8))

    # Webhooks Section
    if "webhooks" in data:
        wh = data["webhooks"]
        elements.append(Paragraph("Webhook Delivery", section_style))
        table_data = [
            ["Metric", "Value"],
            ["Total Webhooks", str(wh["total_webhooks"])],
            ["Active Webhooks", str(wh["active_webhooks"])],
            ["Deliveries (Success)", str(wh["deliveries_success"])],
            ["Deliveries (Failed)", str(wh["deliveries_failed"])],
            ["Success Rate", f"{wh['success_rate']}%"],
        ]
        t = Table(table_data, colWidths=[3.5 * inch, 1.5 * inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#fce4ec')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#880e4f')),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fafafa')]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 8))

    # Billing Section
    if "billing" in data:
        bl = data["billing"]
        elements.append(Paragraph("Billing & Usage", section_style))
        table_data = [
            ["Metric", "Value"],
            ["Active Subscriptions", str(bl["active_subscriptions"])],
            ["Total Revenue (period)", f"${bl['total_revenue']:.2f}"],
            ["Total Transactions", str(bl["total_transactions"])],
        ]
        t = Table(table_data, colWidths=[3.5 * inch, 1.5 * inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ede7f6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#4a148c')),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fafafa')]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(t)

    # Footer
    elements.append(Spacer(1, 24))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0')))
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#999999'), spaceAfter=0)
    elements.append(Paragraph(f"Generated by NotaryChain &bull; {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", footer_style))

    doc.build(elements)
    return filename


# --- Routes ---

@router.get("/{org_id}/reports/sections")
async def list_report_sections(org_id: str, current_user: dict = Depends(get_current_user)):
    """List available report sections."""
    await _require_admin(org_id, current_user.id)
    return {"sections": REPORT_SECTIONS}


@router.get("/{org_id}/reports/config")
async def get_report_config(org_id: str, current_user: dict = Depends(get_current_user)):
    """Get report configuration for an org."""
    await _require_admin(org_id, current_user.id)
    config = await db.report_configs.find_one({"org_id": org_id}, {"_id": 0})
    if not config:
        return {"configured": False}
    return {"configured": True, **config}


@router.post("/{org_id}/reports/config")
async def create_or_update_config(org_id: str, body: ReportConfigRequest, current_user: dict = Depends(get_current_user)):
    """Create or update report schedule config."""
    await _require_admin(org_id, current_user.id)

    if body.frequency not in ("weekly", "monthly"):
        raise HTTPException(status_code=400, detail="Frequency must be 'weekly' or 'monthly'")
    invalid = [s for s in body.sections if s not in SECTION_KEYS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid sections: {', '.join(invalid)}")
    if not body.sections:
        raise HTTPException(status_code=400, detail="At least one section is required")

    now = datetime.now(timezone.utc).isoformat()
    existing = await db.report_configs.find_one({"org_id": org_id})

    config = {
        "org_id": org_id,
        "frequency": body.frequency,
        "sections": body.sections,
        "is_active": body.is_active,
        "updated_at": now,
        "updated_by": current_user.id,
    }

    if existing:
        await db.report_configs.update_one({"org_id": org_id}, {"$set": config})
    else:
        config["id"] = str(uuid.uuid4())
        config["created_at"] = now
        await db.report_configs.insert_one(config)

    result = await db.report_configs.find_one({"org_id": org_id}, {"_id": 0})
    return result


@router.post("/{org_id}/reports/generate")
async def generate_report_now(org_id: str, current_user: dict = Depends(get_current_user)):
    """Manually generate a report now."""
    await _require_admin(org_id, current_user.id)

    config = await db.report_configs.find_one({"org_id": org_id}, {"_id": 0})
    sections = config["sections"] if config else SECTION_KEYS
    days = 7 if (config and config.get("frequency") == "weekly") else 30

    data = await _aggregate_report_data(org_id, days, sections)
    filename = _generate_pdf(data, org_id)

    # Upload generated PDF to storage service
    filepath = os.path.join(REPORTS_DIR, filename)
    with open(filepath, "rb") as f:
        pdf_content = f.read()
    storage_meta = await storage_service.upload(pdf_content, filename, folder="reports")

    # Clean up local file after upload to S3
    if storage_meta["storage_backend"] == "s3":
        try:
            os.remove(filepath)
        except OSError:
            pass

    now = datetime.now(timezone.utc).isoformat()
    report_record = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "filename": filename,
        "stored_path": storage_meta["path"],
        "storage_backend": storage_meta["storage_backend"],
        "sections": sections,
        "period_days": days,
        "generated_by": current_user.id,
        "generated_at": now,
        "data_snapshot": data,
    }
    await db.generated_reports.insert_one(report_record)

    report_record.pop("_id", None)
    return report_record


@router.get("/{org_id}/reports")
async def list_reports(
    org_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    """List generated reports for an org."""
    await _require_admin(org_id, current_user.id)

    query = {"org_id": org_id}
    total = await db.generated_reports.count_documents(query)
    skip = (page - 1) * page_size
    reports = await db.generated_reports.find(
        query, {"_id": 0, "data_snapshot": 0}
    ).sort("generated_at", -1).skip(skip).limit(page_size).to_list(page_size)

    return {"total": total, "page": page, "reports": reports}


@router.get("/{org_id}/reports/{report_id}")
async def get_report_detail(org_id: str, report_id: str, current_user: dict = Depends(get_current_user)):
    """Get full report data (including snapshot)."""
    await _require_admin(org_id, current_user.id)

    report = await db.generated_reports.find_one({"id": report_id, "org_id": org_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.get("/{org_id}/reports/{report_id}/download")
async def download_report(org_id: str, report_id: str, current_user: dict = Depends(get_current_user)):
    """Download a generated PDF report."""
    await _require_admin(org_id, current_user.id)

    report = await db.generated_reports.find_one({"id": report_id, "org_id": org_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    backend = report.get("storage_backend", "local")
    stored_path = report.get("stored_path", report["filename"])

    # Try presigned URL for S3
    if backend == "s3":
        url = storage_service.get_presigned_url(stored_path)
        if url:
            return RedirectResponse(url=url, status_code=307)

    # Fallback to local file
    local_path = await storage_service.get_file_path(stored_path, backend)
    if not local_path:
        # Legacy: try reports dir directly
        filepath = os.path.join(REPORTS_DIR, report["filename"])
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Report file not found")
        local_path = filepath

    return FileResponse(local_path, media_type="application/pdf", filename=report["filename"])


@router.delete("/{org_id}/reports/{report_id}")
async def delete_report(org_id: str, report_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a generated report."""
    await _require_admin(org_id, current_user.id)

    report = await db.generated_reports.find_one({"id": report_id, "org_id": org_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Delete from storage
    backend = report.get("storage_backend", "local")
    stored_path = report.get("stored_path", report["filename"])
    await storage_service.delete(stored_path, backend)

    # Also clean up legacy local file if exists
    filepath = os.path.join(REPORTS_DIR, report["filename"])
    if os.path.exists(filepath):
        os.remove(filepath)

    await db.generated_reports.delete_one({"id": report_id})
    return {"message": "Report deleted"}


# --- Background Scheduler ---

CHECK_INTERVAL = 3600  # Check hourly

async def _check_scheduled_reports():
    """Check for orgs with scheduled reports that need generation."""
    if db is None:
        return
    now = datetime.now(timezone.utc)
    configs = await db.report_configs.find({"is_active": True}, {"_id": 0}).to_list(100)

    for config in configs:
        org_id = config["org_id"]
        freq = config.get("frequency", "monthly")

        # Check last generation time
        last_report = await db.generated_reports.find_one(
            {"org_id": org_id}, sort=[("generated_at", -1)]
        )

        should_generate = False
        if not last_report:
            should_generate = True
        else:
            last_time = datetime.fromisoformat(last_report["generated_at"].replace("Z", "+00:00")) if isinstance(last_report["generated_at"], str) else last_report["generated_at"]
            if freq == "weekly" and (now - last_time).days >= 7:
                should_generate = True
            elif freq == "monthly" and (now - last_time).days >= 30:
                should_generate = True

        if should_generate:
            try:
                days = 7 if freq == "weekly" else 30
                data = await _aggregate_report_data(org_id, days, config["sections"])
                filename = _generate_pdf(data, org_id)

                # Upload to storage
                filepath = os.path.join(REPORTS_DIR, filename)
                with open(filepath, "rb") as f:
                    pdf_content = f.read()
                storage_meta = await storage_service.upload(pdf_content, filename, folder="reports")
                if storage_meta["storage_backend"] == "s3":
                    try:
                        os.remove(filepath)
                    except OSError:
                        pass

                report_record = {
                    "id": str(uuid.uuid4()),
                    "org_id": org_id,
                    "filename": filename,
                    "stored_path": storage_meta["path"],
                    "storage_backend": storage_meta["storage_backend"],
                    "sections": config["sections"],
                    "period_days": days,
                    "generated_by": "system",
                    "generated_at": now.isoformat(),
                    "data_snapshot": data,
                }
                await db.generated_reports.insert_one(report_record)
                logger.info(f"Auto-generated {freq} report for org {org_id}")
            except Exception as e:
                logger.error(f"Failed to generate scheduled report for org {org_id}: {e}")


async def start_report_scheduler():
    """Background loop that checks for due scheduled reports."""
    logger.info("Scheduled report checker started")
    while True:
        try:
            await _check_scheduled_reports()
        except Exception as e:
            logger.error(f"Report scheduler error: {e}")
        await asyncio.sleep(CHECK_INTERVAL)
