"""
Unified scheduler manager — starts all cron-style background jobs exactly once
on the pod that holds the MongoDB leader lease (see leader_election.py).

This replaces the previous "fire all schedulers on every pod at startup" pattern,
which would run each job N times across N replicas. Followers stay idle; if the
leader dies, another pod takes over (via leader_election.heartbeat_loop) and calls
start_all() then.
"""
import asyncio
import logging

logger = logging.getLogger(__name__)

_started = False


def reset():
    global _started
    _started = False


async def start_all():
    """Start every background scheduler once. Safe to call multiple times."""
    global _started
    if _started:
        logger.info("[scheduler_manager] already started on this pod — skipping")
        return
    _started = True

    # Imported lazily so module import order in server.py stays unchanged.
    from services import (
        expiry_service,
        reminder_service,
        salv_service as salv_service_module,
        hbar_alert_service,
        service_health_monitor,
        pcv_service,
        soc2_cron_service,
        acn_oracle_service,
    )
    from routes import scheduled_reports_routes

    jobs = [
        ("expiry", expiry_service.run_expiry_checker),
        ("reminders", reminder_service.run_reminder_checks),
        ("salv", salv_service_module.run_salv_scheduler),
        ("scheduled_reports", scheduled_reports_routes.start_report_scheduler),
        ("hbar_alerts", hbar_alert_service.run_balance_checker),
        ("health_monitor", service_health_monitor.run_service_monitor),
        ("pcv", pcv_service.run_pcv_scheduler),
        ("soc2_cron", soc2_cron_service.run_scheduler),
        ("acn_oracle", acn_oracle_service.run_scheduler),
    ]
    for name, coro_fn in jobs:
        try:
            asyncio.create_task(coro_fn())
        except Exception as e:
            logger.warning("[scheduler_manager] failed to start %s: %s", name, e)
    logger.info("[scheduler_manager] started %d schedulers on the leader pod", len(jobs))
