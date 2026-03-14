"""
HBAR Balance Alert Service
Periodically checks Hedera account balance and sends alerts at configurable thresholds.
Cooldown prevents re-alerting for the same threshold within 24 hours.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

db = None
notification_service = None
email_service_instance = None
hedera_service_instance = None

CHECK_INTERVAL_SECONDS = 1800  # 30 minutes

THRESHOLDS = [
    {"hbar": 50, "level": "warning", "label": "getting low"},
    {"hbar": 10, "level": "critical", "label": "critically low — service interruption risk"},
    {"hbar": 1, "level": "emergency", "label": "nearly empty — immediate action required"},
]

COOLDOWN_HOURS = 24

# Track last alert time per threshold to avoid spam
_last_alerted = {}


def set_dependencies(database, hedera_svc, notif_svc, email_svc):
    global db, hedera_service_instance, notification_service, email_service_instance
    db = database
    hedera_service_instance = hedera_svc
    notification_service = notif_svc
    email_service_instance = email_svc


async def _check_balance():
    """Check HBAR balance and alert if below any threshold."""
    if db is None or hedera_service_instance is None:
        return

    status = hedera_service_instance.get_status()
    if not status.get("configured"):
        return

    try:
        result = await hedera_service_instance.get_account_balance()
        if not result.get("success"):
            logger.warning("HBAR balance check failed: %s", result.get("error"))
            return
    except Exception as e:
        logger.warning("HBAR balance check error: %s", e)
        return

    balance = result.get("balance_hbar", 0)
    account_id = result.get("account_id", "unknown")
    network = status.get("network", "unknown")
    now = datetime.now(timezone.utc)

    for threshold in THRESHOLDS:
        hbar_limit = threshold["hbar"]
        level = threshold["level"]
        label = threshold["label"]
        cooldown_key = f"hbar_{hbar_limit}"

        if balance >= hbar_limit:
            # Balance recovered — clear cooldown for this and lower thresholds
            _last_alerted.pop(cooldown_key, None)
            continue

        # Check cooldown
        last = _last_alerted.get(cooldown_key)
        if last and (now - last) < timedelta(hours=COOLDOWN_HOURS):
            continue

        # Balance is below threshold — send alerts
        logger.warning(
            "HBAR balance alert [%s]: %.2f HBAR (threshold: %d) on %s account %s",
            level, balance, hbar_limit, network, account_id,
        )

        # In-app notification to all admins
        try:
            admins = await db.users.find(
                {"role": "admin"}, {"_id": 0, "id": 1, "email": 1, "full_name": 1}
            ).to_list(50)

            for admin in admins:
                await notification_service.create_notification(
                    user_id=admin["id"],
                    title=f"HBAR Balance {level.upper()}: {balance:.2f} HBAR",
                    message=(
                        f"Your Hedera {network} account ({account_id}) balance is "
                        f"{balance:.2f} HBAR — {label}. "
                        f"Fund the account to prevent notarization service interruption."
                    ),
                    notif_type=level,
                )
        except Exception as e:
            logger.error("Failed to create HBAR alert notification: %s", e)

        # Email alert to admins
        if email_service_instance:
            for admin in admins:
                try:
                    await email_service_instance.send_email(
                        to_email=admin.get("email"),
                        subject=f"[{level.upper()}] HBAR Balance Alert — {balance:.2f} HBAR",
                        html_content=_build_alert_email(
                            level=level,
                            balance=balance,
                            threshold=hbar_limit,
                            label=label,
                            account_id=account_id,
                            network=network,
                            admin_name=admin.get("full_name", "Admin"),
                        ),
                    )
                except Exception as e:
                    logger.warning("Failed to send HBAR alert email to %s: %s", admin.get("email"), e)

        # Log to audit collection
        try:
            await db.hbar_balance_alerts.insert_one({
                "level": level,
                "balance_hbar": balance,
                "threshold_hbar": hbar_limit,
                "account_id": account_id,
                "network": network,
                "alerted_at": now.isoformat(),
                "admins_notified": [a["email"] for a in admins],
            })
        except Exception as e:
            logger.warning("Failed to log HBAR alert: %s", e)

        _last_alerted[cooldown_key] = now
        break  # Only alert for the most severe triggered threshold


def _build_alert_email(level, balance, threshold, label, account_id, network, admin_name):
    colors = {
        "warning": {"bg": "#fef3c7", "border": "#f59e0b", "text": "#92400e", "badge": "#f59e0b"},
        "critical": {"bg": "#fee2e2", "border": "#ef4444", "text": "#991b1b", "badge": "#ef4444"},
        "emergency": {"bg": "#fecaca", "border": "#dc2626", "text": "#7f1d1d", "badge": "#dc2626"},
    }
    c = colors.get(level, colors["warning"])

    return f"""
    <!DOCTYPE html>
    <html>
    <head><style>body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0a; margin: 0; padding: 0; }}</style></head>
    <body>
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <span style="font-size: 28px; font-weight: bold; color: #00d4aa;">NotaryChain</span>
            </div>
            <div style="background: #1a1a2e; border-radius: 16px; padding: 40px; border: 1px solid #333;">
                <div style="background: {c['badge']}; color: #fff; display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 20px;">
                    {level.upper()} ALERT
                </div>
                <h1 style="color: #fff; margin: 0 0 16px 0; font-size: 22px;">HBAR Balance {label.title()}</h1>
                <p style="color: #b0b0b0; line-height: 1.7;">Hi {admin_name},</p>
                <p style="color: #b0b0b0; line-height: 1.7;">Your Hedera <strong style="color: #fff;">{network}</strong> account balance has dropped below the <strong style="color: #fff;">{threshold} HBAR</strong> threshold.</p>

                <div style="background: #0d1b2a; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid {c['border']};">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="color: #888; padding: 8px 0;">Current Balance</td><td style="color: {c['border']}; padding: 8px 0; text-align: right; font-weight: 700; font-size: 20px;">{balance:.2f} HBAR</td></tr>
                        <tr><td style="color: #888; padding: 8px 0;">Alert Threshold</td><td style="color: #fff; padding: 8px 0; text-align: right;">&lt; {threshold} HBAR</td></tr>
                        <tr><td style="color: #888; padding: 8px 0;">Account</td><td style="color: #fff; padding: 8px 0; text-align: right;">{account_id}</td></tr>
                        <tr><td style="color: #888; padding: 8px 0;">Network</td><td style="color: #fff; padding: 8px 0; text-align: right;">{network}</td></tr>
                    </table>
                </div>

                <p style="color: #b0b0b0; line-height: 1.7;">Transfer HBAR to account <strong style="color: #fff;">{account_id}</strong> to keep notarization services running without interruption.</p>
                <p style="color: #666; font-size: 13px; margin-top: 20px;">This alert won't repeat for the same threshold within 24 hours.</p>
            </div>
            <div style="text-align: center; margin-top: 30px; color: #555; font-size: 12px;">
                <p>&copy; {__import__('datetime').datetime.now().year} NotaryChain. Automated balance monitoring.</p>
            </div>
        </div>
    </body>
    </html>
    """


async def run_balance_checker():
    """Background loop that checks HBAR balance periodically."""
    logger.info("HBAR balance alert service started")
    # Initial delay to let other services start
    await asyncio.sleep(10)
    while True:
        try:
            await _check_balance()
        except Exception as e:
            logger.error("HBAR balance checker error: %s", e)
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
