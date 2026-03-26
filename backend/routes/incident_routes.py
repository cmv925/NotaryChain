"""
Incident Report Routes
Auto-generates timeline reports from service degradation events.
Includes downloadable PDF for stakeholder communication.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone, timedelta
import logging
import io

from models import User
from routes.auth_routes import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/incidents", tags=["incidents"])

db: AsyncIOMotorDatabase = None


def set_db(database):
    global db
    db = database


async def _check_admin(current_user: User):
    user_doc = await db.users.find_one({"email": current_user.email})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def _build_incidents_from_alerts(alerts):
    """Group sequential degradation/recovery alerts into incidents."""
    incidents = []
    open_incidents = {}  # service -> incident dict

    for alert in alerts:
        service = alert["service"]
        ts = alert["timestamp"]
        status = alert["status"]

        if status in ("degraded", "error"):
            if service not in open_incidents:
                open_incidents[service] = {
                    "service": service,
                    "started_at": ts,
                    "ended_at": None,
                    "duration_minutes": None,
                    "status": "ongoing",
                    "events": [],
                }
            open_incidents[service]["events"].append({
                "timestamp": ts,
                "status": status,
                "detail": alert.get("detail", ""),
            })
        elif status == "recovered":
            if service in open_incidents:
                inc = open_incidents.pop(service)
                inc["ended_at"] = ts
                inc["status"] = "resolved"
                inc["events"].append({
                    "timestamp": ts,
                    "status": "recovered",
                    "detail": alert.get("detail", ""),
                })
                try:
                    start = datetime.fromisoformat(inc["started_at"])
                    end = datetime.fromisoformat(ts)
                    inc["duration_minutes"] = round((end - start).total_seconds() / 60, 1)
                except Exception:
                    pass
                incidents.append(inc)

    # Add still-open incidents
    for inc in open_incidents.values():
        try:
            start = datetime.fromisoformat(inc["started_at"])
            inc["duration_minutes"] = round((datetime.now(timezone.utc) - start).total_seconds() / 60, 1)
        except Exception:
            pass
        incidents.append(inc)

    incidents.sort(key=lambda x: x["started_at"], reverse=True)
    return incidents


@router.get("")
async def list_incidents(
    days: int = Query(default=7, ge=1, le=90),
    current_user: User = Depends(get_current_user),
):
    """List all service incidents within a time window."""
    await _check_admin(current_user)

    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    alerts = await db.service_health_alerts.find(
        {"timestamp": {"$gte": cutoff}},
        {"_id": 0},
    ).sort("timestamp", 1).to_list(500)

    incidents = _build_incidents_from_alerts(alerts)

    summary = {
        "total_incidents": len(incidents),
        "resolved": sum(1 for i in incidents if i["status"] == "resolved"),
        "ongoing": sum(1 for i in incidents if i["status"] == "ongoing"),
        "services_affected": list(set(i["service"] for i in incidents)),
    }

    return {
        "incidents": incidents,
        "summary": summary,
        "period_days": days,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/export-pdf")
async def export_incident_pdf(
    days: int = Query(default=7, ge=1, le=90),
    current_user: User = Depends(get_current_user),
):
    """Generate a PDF incident report for stakeholder communication."""
    await _check_admin(current_user)

    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    alerts = await db.service_health_alerts.find(
        {"timestamp": {"$gte": cutoff}},
        {"_id": 0},
    ).sort("timestamp", 1).to_list(500)

    incidents = _build_incidents_from_alerts(alerts)
    pdf_bytes = _generate_incident_pdf(incidents, days)

    filename = f"NotaryChain_Incident_Report_{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def _generate_incident_pdf(incidents, days):
    """Generate a professional incident report PDF."""
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.75 * inch, bottomMargin=0.75 * inch)
    elements = []
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle("Title", parent=styles["Title"], fontSize=20, spaceAfter=6, textColor=colors.HexColor("#1a1a2e"))
    subtitle_style = ParagraphStyle("Sub", parent=styles["Normal"], fontSize=10, textColor=colors.gray, spaceAfter=16)
    heading_style = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=13, spaceBefore=14, spaceAfter=8, textColor=colors.HexColor("#1a1a2e"))

    now = datetime.now(timezone.utc)
    elements.append(Paragraph("NotaryChain Incident Report", title_style))
    elements.append(Paragraph(f"Period: Last {days} days | Generated: {now.strftime('%B %d, %Y %H:%M UTC')}", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e5e7eb")))
    elements.append(Spacer(1, 12))

    # Summary
    resolved = sum(1 for i in incidents if i["status"] == "resolved")
    ongoing = sum(1 for i in incidents if i["status"] == "ongoing")
    services = list(set(i["service"] for i in incidents))

    summary_data = [
        ["Metric", "Value"],
        ["Total Incidents", str(len(incidents))],
        ["Resolved", str(resolved)],
        ["Ongoing", str(ongoing)],
        ["Services Affected", ", ".join(services) if services else "None"],
        ["Report Period", f"{days} days"],
    ]

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
    elements.append(Spacer(1, 16))

    if not incidents:
        elements.append(Paragraph("No incidents recorded during this period. All services operating normally.", styles["Normal"]))
    else:
        elements.append(Paragraph("Incident Timeline", heading_style))

        for i, inc in enumerate(incidents):
            status_text = "RESOLVED" if inc["status"] == "resolved" else "ONGOING"
            status_color = colors.HexColor("#10b981") if inc["status"] == "resolved" else colors.HexColor("#ef4444")
            duration = f"{inc['duration_minutes']} min" if inc.get("duration_minutes") else "N/A"

            inc_data = [
                ["#", "Service", "Status", "Started", "Duration"],
                [str(i + 1), inc["service"], status_text, inc["started_at"][:19], duration],
            ]

            inc_table = Table(inc_data, colWidths=[0.4 * inch, 1.5 * inch, 1 * inch, 2 * inch, 1.5 * inch])
            inc_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
                ("PADDING", (0, 0), (-1, -1), 6),
                ("TEXTCOLOR", (2, 1), (2, 1), status_color),
                ("FONTNAME", (2, 1), (2, 1), "Helvetica-Bold"),
            ]))
            elements.append(inc_table)

            # Events timeline
            if inc.get("events"):
                for evt in inc["events"]:
                    evt_color = "#ef4444" if evt["status"] in ("degraded", "error") else "#10b981"
                    elements.append(Paragraph(
                        f"<font color='{evt_color}'>{evt['status'].upper()}</font> at {evt['timestamp'][:19]} — {evt.get('detail', '')[:80]}",
                        ParagraphStyle("evt", parent=styles["Normal"], fontSize=8, leftIndent=20, textColor=colors.gray, spaceAfter=2),
                    ))

            elements.append(Spacer(1, 8))

    # Footer
    elements.append(Spacer(1, 20))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e5e7eb")))
    elements.append(Paragraph(
        "Generated by NotaryChain Service Health Monitor. For questions, contact ops@notarychain.com.",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, textColor=colors.gray, alignment=1),
    ))

    doc.build(elements)
    return buf.getvalue()
