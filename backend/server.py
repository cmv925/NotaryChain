from fastapi import FastAPI, APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.gzip import GZipMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import asyncio
import logging
from pathlib import Path

# Load env vars BEFORE any route/service imports so all modules see them
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Import route modules
from routes import auth_routes, document_routes, notary_routes, ai_routes, blockchain_routes, payment_routes, video_routes, crypto_routes, audit_routes, admin_routes, package_routes, email_routes, transaction_routes, twofa_routes, jobs_routes, notification_routes, subscription_routes, notary_professional_routes, gdpr_routes, infra_routes, ws_routes, api_key_routes, public_api_routes, ron_compliance_routes, webhook_routes, template_routes, organization_routes, draft_routes, vault_routes, expiry_routes, draft_collab_routes, bulk_routes, marketplace_routes, embed_routes, booking_routes, copilot_routes, ai_generator_routes, summarizer_routes, witness_routes, remediation_routes, biometric_passport_routes, conductor_routes, evidence_package_routes, timeline_routes, reminder_routes, approval_routes, doc_compare_routes, branding_routes, rbac_routes, sso_routes, auth0_routes, okta_routes, org_activity_routes, org_webhook_routes, scheduled_reports_routes, investor_deck_routes, ops_dashboard_routes, alert_settings_routes, security_compliance_routes, soc2_export_routes, incident_routes, ceremony_routes, escrow_routes, anan_routes, fraud_intelligence_routes, ai_intelligence_routes, platform_features_routes, hts_routes, threat_learning_routes, ghl_routes, living_identity_routes, verify_routes, trustlayer_routes, salv_routes, fl_compliance_routes, kba_routes, fl_ceremony_routes, fl_journal_routes, fl_launch_routes, field_scanner_routes, sdk_routes, compliance_states_routes, salv_phase2_routes, compliance_phase2_routes
from middleware.security import setup_security, health_check, limiter
from services.notification_service import set_db as set_notification_db, set_ws_manager
from services.ws_manager import ws_manager
from services import expiry_service
from services import reminder_service
from services import hbar_alert_service
from services import service_health_monitor

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Inject db into route modules
auth_routes.set_db(db)
document_routes.set_db(db)
notary_routes.set_db(db)
ai_routes.set_db(db)
blockchain_routes.set_db(db)
payment_routes.set_db(db)
video_routes.set_db(db)
crypto_routes.set_db(db)
audit_routes.set_db(db)
admin_routes.set_db(db)
package_routes.set_db(db)
email_routes.set_db(db)
transaction_routes.set_db(db)
twofa_routes.set_db(db)
notification_routes.set_db(db)
subscription_routes.set_db(db)
notary_professional_routes.set_db(db)
gdpr_routes.set_db(db)
infra_routes.set_db(db)
ws_routes.set_db(db)
api_key_routes.set_db(db)
public_api_routes.set_db(db)
ron_compliance_routes.set_db(db)
webhook_routes.set_db(db)
template_routes.set_db(db)
organization_routes.set_db(db)
draft_routes.set_db(db)
vault_routes.set_db(db)
expiry_routes.set_db(db)
draft_collab_routes.set_db(db)
bulk_routes.set_db(db)
marketplace_routes.set_db(db)
embed_routes.set_db(db)
booking_routes.set_db(db)
copilot_routes.set_db(db)
ai_generator_routes.set_db(db)
summarizer_routes.set_db(db)
witness_routes.set_db(db)
remediation_routes.set_db(db)
biometric_passport_routes.set_db(db)
conductor_routes.set_db(db)
evidence_package_routes.set_db(db)
timeline_routes.set_db(db)
reminder_routes.set_db(db)
approval_routes.set_db(db)
doc_compare_routes.set_db(db)
branding_routes.set_db(db)
rbac_routes.set_db(db)
sso_routes.set_db(db)
org_activity_routes.set_db(db)
org_webhook_routes.set_db(db)
scheduled_reports_routes.set_db(db)
investor_deck_routes.set_db(db)
ops_dashboard_routes.set_db(db)
alert_settings_routes.set_db(db)
security_compliance_routes.set_db(db)
soc2_export_routes.set_db(db)
incident_routes.set_db(db)
ceremony_routes.set_db(db)
escrow_routes.set_db(db)
anan_routes.set_db(db)
fraud_intelligence_routes.set_db(db)
ai_intelligence_routes.set_db(db)
platform_features_routes.set_db(db)
hts_routes.set_db(db)
threat_learning_routes.set_db(db)
ghl_routes.set_db(db)
living_identity_routes.set_db(db)
verify_routes.set_db(db)
trustlayer_routes.set_db(db)
salv_routes.set_db(db)
fl_compliance_routes.set_db(db)
kba_routes.set_db(db)
fl_ceremony_routes.set_db(db)
fl_journal_routes.set_db(db)
fl_launch_routes.set_db(db)
field_scanner_routes.set_db(db)
sdk_routes.set_db(db)
compliance_states_routes.set_db(db)
salv_phase2_routes.set_db(db)
compliance_phase2_routes.set_db(db)

# PCV service + routes
from routes import pcv_routes
from services import pcv_service
from services.hedera_service import hedera_service as _hedera_for_pcv
from services import email_service as _email_for_pcv
pcv_routes.set_db(db)
pcv_service.set_dependencies(db, hedera_svc=_hedera_for_pcv, email_svc=_email_for_pcv)

# Batch certificate generation + audit log export
from routes import admin_certs_routes, audit_export_routes
admin_certs_routes.set_db(db)
audit_export_routes.set_db(db)

# Weekly SOC 2 / ISO export cron + email to compliance officer
from services import soc2_cron_service
soc2_cron_service.set_db(db)

# Per-org scheduled export configs (CRUD)
from routes import scheduled_export_routes
scheduled_export_routes.set_db(db)

# Autonomous Cross-Border Notarization Network (ACN)
from routes import acn_routes
acn_routes.set_db(db)

# ACN Regulatory Oracle — live rule-change feed
from services import acn_oracle_service
acn_oracle_service.set_db(db)

# Per-admin Oracle watchlists (email + Slack alerts)
from services import oracle_watchlist_service
oracle_watchlist_service.set_db(db)

# Feature gate middleware needs db
from middleware.feature_gate import set_db as set_gate_db
set_gate_db(db)

# Webhook service needs db too
from services import webhook_service
webhook_service.set_db(db)

set_notification_db(db)

# Initialize notification service WS manager
set_ws_manager(ws_manager)

# Initialize expiry service dependencies
from services.email_service import email_service
from services import notification_service as notif_svc_module
expiry_service.set_dependencies(db, notif_svc_module, email_service)
reminder_service.set_dependencies(db, notif_svc_module)
from services import salv_service as salv_service_module
import services.email_service as email_service_module
salv_service_module.set_dependencies(db, email_service_module)
from services.hedera_service import hedera_service, hedera_bond_service
hedera_bond_service.set_db(db)
hbar_alert_service.set_dependencies(db, hedera_service, notif_svc_module, email_service)
service_health_monitor.set_dependencies(db, notif_svc_module, email_service)

# Create the main app without a prefix
app = FastAPI(
    title="NotaryChain API",
    description="Enterprise-grade digital notarization platform with AI and blockchain",
    version="1.0.0"
)

# Setup security middleware (rate limiting, headers, logging, sentry)
setup_security(app)

# Compress responses >1KB (JSON/HTML) — large payload reduction with near-zero cost
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Create a router with the /api prefix for legacy routes
api_router = APIRouter(prefix="/api")

# Health check endpoints
@api_router.get("/")
async def root():
    return {"message": "NotaryChain API", "status": "operational"}

@api_router.get("/health")
async def api_health():
    """Comprehensive health check endpoint"""
    return await health_check()

@app.get("/health")
async def root_health():
    """Root health check for load balancers"""
    return await health_check()

# Include the router in the main app
app.include_router(api_router)

# Include auth and document routes (they already have /api prefix)
app.include_router(auth_routes.router)
app.include_router(document_routes.router)
app.include_router(notary_routes.router)
app.include_router(ai_routes.router)
app.include_router(blockchain_routes.router)
app.include_router(payment_routes.router)
app.include_router(video_routes.router)
app.include_router(crypto_routes.router)
app.include_router(audit_routes.router)
app.include_router(admin_routes.router)
app.include_router(package_routes.router)
app.include_router(email_routes.router)
app.include_router(transaction_routes.router)
app.include_router(twofa_routes.router)
app.include_router(jobs_routes.router)
app.include_router(notification_routes.router)
app.include_router(subscription_routes.router)
app.include_router(notary_professional_routes.router)
app.include_router(gdpr_routes.router)
app.include_router(infra_routes.router)
app.include_router(ws_routes.router)
app.include_router(api_key_routes.router)
app.include_router(public_api_routes.router)
app.include_router(ron_compliance_routes.router)
app.include_router(webhook_routes.router)
app.include_router(template_routes.router)
app.include_router(organization_routes.router)
app.include_router(draft_routes.router)
app.include_router(vault_routes.router)
app.include_router(expiry_routes.router)
app.include_router(draft_collab_routes.router)
app.include_router(bulk_routes.router)
app.include_router(marketplace_routes.router)
app.include_router(embed_routes.router)
app.include_router(booking_routes.router)
app.include_router(copilot_routes.router)
app.include_router(ai_generator_routes.router)
app.include_router(summarizer_routes.router)
app.include_router(witness_routes.router)
app.include_router(remediation_routes.router)
app.include_router(biometric_passport_routes.router)
app.include_router(conductor_routes.router)
app.include_router(evidence_package_routes.router)
app.include_router(timeline_routes.router)
app.include_router(reminder_routes.router)
app.include_router(approval_routes.router)
app.include_router(doc_compare_routes.router)
app.include_router(branding_routes.router)
app.include_router(rbac_routes.router)
app.include_router(sso_routes.router)
app.include_router(auth0_routes.router)
app.include_router(okta_routes.router)
app.include_router(org_activity_routes.router)
app.include_router(org_webhook_routes.router)
app.include_router(scheduled_reports_routes.router)
app.include_router(investor_deck_routes.router)
app.include_router(ops_dashboard_routes.router)
app.include_router(alert_settings_routes.router)
app.include_router(security_compliance_routes.router)
app.include_router(soc2_export_routes.router)
app.include_router(incident_routes.router)
app.include_router(ceremony_routes.router)
app.include_router(escrow_routes.router)
app.include_router(anan_routes.router)
app.include_router(fraud_intelligence_routes.router)
app.include_router(ai_intelligence_routes.router)
app.include_router(platform_features_routes.router)
app.include_router(hts_routes.router)
app.include_router(threat_learning_routes.router)
app.include_router(ghl_routes.router)
app.include_router(living_identity_routes.router)
app.include_router(verify_routes.router)
app.include_router(trustlayer_routes.router)
app.include_router(salv_routes.router)
app.include_router(fl_compliance_routes.router)
app.include_router(kba_routes.router)
app.include_router(fl_ceremony_routes.router)
app.include_router(fl_journal_routes.router)
app.include_router(fl_launch_routes.router)
app.include_router(field_scanner_routes.router)
app.include_router(sdk_routes.router)
app.include_router(compliance_states_routes.router)
app.include_router(salv_phase2_routes.router)
app.include_router(compliance_phase2_routes.router)
app.include_router(pcv_routes.router)
app.include_router(admin_certs_routes.router)
app.include_router(audit_export_routes.router)
app.include_router(acn_routes.router)
app.include_router(acn_routes.public_router)
app.include_router(acn_oracle_service.router)

# Per-admin Oracle Watchlists (admin-gated; email + Slack alerts)
from routes import oracle_watchlist_routes
oracle_watchlist_routes.set_db(db)
app.include_router(oracle_watchlist_routes.router)
app.include_router(scheduled_export_routes.router)

# Dashboard Telemetry — audit stream for admin/notary surfaces + tour analytics
from routes import telemetry_routes
telemetry_routes.set_db(db)
app.include_router(telemetry_routes.router)

# Dashboard "Next Action" nudge — single decisive CTA for the current user
from routes import next_action_routes
next_action_routes.set_db(db)
app.include_router(next_action_routes.router)

# Enhanced In-House KBA — interim identity verification (doc + selfie + quiz)
from routes import enhanced_kba_routes
enhanced_kba_routes.set_db(db)
app.include_router(enhanced_kba_routes.router)

from routes import contract_template_routes
contract_template_routes.set_db(db)
app.include_router(contract_template_routes.router)

from routes import ceremony_video_routes
ceremony_video_routes.set_db(db)
app.include_router(ceremony_video_routes.router)

from routes import template_marketplace_routes
template_marketplace_routes.set_db(db)
app.include_router(template_marketplace_routes.router)

from routes import seo_routes
seo_routes.set_db(db)
app.include_router(seo_routes.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


# M4: Global request body size limit (10MB)
MAX_BODY_SIZE = 10 * 1024 * 1024

class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_BODY_SIZE:
            return JSONResponse(status_code=413, content={"detail": "Request body too large. Maximum size is 10MB."})
        return await call_next(request)

app.add_middleware(BodySizeLimitMiddleware)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


@app.on_event("startup")
async def create_indexes():
    """Create database indexes for query performance"""
    try:
        # Users collection
        await db.users.create_index("email", unique=True)
        await db.users.create_index("role")

        # Document seals
        await db.document_seals.create_index("user_id")
        await db.document_seals.create_index("timestamp")

        # Notarization requests
        await db.notarization_requests.create_index("user_id")
        await db.notarization_requests.create_index("notary_id")
        await db.notarization_requests.create_index("status")
        await db.notarization_requests.create_index([("status", 1), ("created_at", -1)])

        # Notary applications
        await db.notary_applications.create_index("user_id")
        await db.notary_applications.create_index("status")

        # Transactions
        await db.transactions.create_index("ownerId")
        await db.transactions.create_index("status")

        # Audit logs
        await db.audit_logs.create_index("user_id")
        await db.audit_logs.create_index("timestamp")
        await db.audit_logs.create_index("action")

        # Notifications
        await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
        await db.notifications.create_index([("user_id", 1), ("read", 1)])

        # Subscriptions
        await db.subscriptions.create_index([("user_id", 1), ("status", 1)])
        await db.subscription_payments.create_index("session_id", unique=True)

        # Notary journal & seals
        await db.notary_journal.create_index([("notary_id", 1), ("created_at", -1)])
        await db.notary_seals.create_index("notary_id")
        await db.deletion_requests.create_index([("user_id", 1), ("status", 1)])

        # Templates
        await db.templates.create_index("id", unique=True)
        await db.templates.create_index("category")

        # Organizations
        await db.organizations.create_index("id", unique=True)
        await db.organizations.create_index("slug", unique=True)
        await db.org_members.create_index([("org_id", 1), ("user_id", 1)], unique=True)
        await db.org_members.create_index("user_id")
        await db.org_invites.create_index("token", unique=True)
        await db.org_invites.create_index([("org_id", 1), ("email", 1)])

        # Template Drafts
        await db.template_drafts.create_index("id", unique=True)
        await db.template_drafts.create_index("user_id")
        await db.template_drafts.create_index("share_token", sparse=True)

        # Vault
        await db.vault_documents.create_index("id", unique=True)
        await db.vault_documents.create_index([("org_id", 1), ("created_at", -1)])
        await db.vault_documents.create_index([("org_id", 1), ("category", 1)])
        await db.vault_audit.create_index([("document_id", 1), ("timestamp", -1)])

        # TrustLayer
        await db.trust_partners.create_index("partner_id", unique=True)
        await db.trust_partners.create_index("slug", unique=True)
        await db.trust_partners.create_index("api_key_hash")
        await db.trust_attestations.create_index("attestation_id", unique=True)
        await db.trust_attestations.create_index([("subject_user_id", 1), ("signed_at", -1)])
        await db.trust_attestations.create_index("partner_id")

        # SALV (Smart Asset Life-Cycle Vault)
        await db.salv_vaults.create_index("vault_id", unique=True)
        await db.salv_vaults.create_index("owner_id")
        await db.salv_assets.create_index("asset_id", unique=True)
        await db.salv_assets.create_index([("owner_id", 1), ("created_at", -1)])
        await db.salv_assets.create_index([("vault_id", 1), ("status", 1)])
        await db.salv_assets.create_index("next_verification_at")
        await db.salv_beneficiaries.create_index("beneficiary_id", unique=True)
        await db.salv_beneficiaries.create_index([("asset_id", 1), ("created_at", -1)])
        await db.salv_beneficiaries.create_index("vault_id")
        await db.salv_events.create_index([("vault_id", 1), ("created_at", -1)])
        await db.salv_events.create_index([("asset_id", 1), ("created_at", -1)])
        await db.salv_handoff_tokens.create_index("token_hash", unique=True)
        await db.salv_handoff_tokens.create_index("beneficiary_id")

        # Florida Compliance
        await db.fl_notary_credentials.create_index("user_id", unique=True)
        await db.fl_notary_credentials.create_index("fl_commission_number", unique=True)
        await db.fl_notary_credentials.create_index([("verified", 1), ("verified_at", -1)])
        await db.state_compliance_profiles.create_index("state_code", unique=True)

        # KBA (Knowledge-Based Authentication)
        await db.kba_sessions.create_index("session_id", unique=True)
        await db.kba_sessions.create_index([("user_id", 1), ("started_at", -1)])
        await db.kba_attempts.create_index([("user_id", 1), ("completed_at", -1)])
        await db.kba_attempts.create_index("attempt_id", unique=True)
        await db.fraud_signals.create_index([("type", 1), ("detected_at", -1)])
        await db.fraud_signals.create_index([("user_id", 1), ("detected_at", -1)])

        # Florida ceremony pipeline (M3)
        await db.fl_jurisdiction_qualifications.create_index([("ceremony_id", 1), ("user_id", 1)], unique=True)
        await db.fl_will_witnesses.create_index("witness_id", unique=True)
        await db.fl_will_witnesses.create_index("ceremony_id")
        await db.fl_will_witnesses.create_index("token_hash", unique=True)
        await db.fl_av_quality_reports.create_index("ceremony_id", unique=True)
        await db.fl_retention_tags.create_index("tag_id", unique=True)
        await db.fl_retention_tags.create_index([("ceremony_id", 1), ("tagged_at", 1)])

        # Seed default templates
        await template_routes.seed_templates()

        # Batch notarization indexes
        await db.notarization_batches.create_index("id", unique=True)
        await db.notarization_batches.create_index("user_id")

        # Marketplace reviews
        await db.notary_reviews.create_index("id", unique=True)
        await db.notary_reviews.create_index("notary_id")
        await db.notary_reviews.create_index([("user_id", 1), ("request_id", 1)], unique=True)

        # RBAC Roles
        await db.rbac_roles.create_index("id", unique=True)
        await db.rbac_roles.create_index([("org_id", 1), ("name", 1)], unique=True)
        await db.rbac_roles.create_index([("org_id", 1), ("system_key", 1)], sparse=True)

        # Org Activity Logs
        await db.org_activity_logs.create_index("id", unique=True)
        await db.org_activity_logs.create_index([("org_id", 1), ("timestamp", -1)])
        await db.org_activity_logs.create_index([("org_id", 1), ("action", 1)])

        # Org Webhooks
        await db.org_webhooks.create_index("id", unique=True)
        await db.org_webhooks.create_index("org_id")
        await db.webhook_deliveries.create_index("id", unique=True)
        await db.webhook_deliveries.create_index([("webhook_id", 1), ("created_at", -1)])

        # Scheduled Reports
        await db.report_configs.create_index("org_id", unique=True)
        await db.generated_reports.create_index("id", unique=True)
        await db.generated_reports.create_index([("org_id", 1), ("generated_at", -1)])

        # Bookings
        await db.bookings.create_index("id", unique=True)
        await db.bookings.create_index("user_id")
        await db.bookings.create_index("notary_id")
        await db.bookings.create_index([("notary_id", 1), ("date", 1), ("start_time", 1)])
        await db.notary_availability.create_index("notary_id", unique=True)

        # HTS Token indexes
        await db.hts_tokens.create_index("escrow_id", unique=True)
        await db.hts_tokens.create_index("created_by")
        await db.hts_tokens.create_index("token_id")

        # ANAN indexes
        await db.anan_ceremonies.create_index("ceremony_id", unique=True)
        await db.anan_ceremonies.create_index("initiated_by")
        await db.anan_escalations.create_index("escalation_id")
        await db.anan_agent_accuracy.create_index([("agent", 1), ("recorded_at", -1)])
        await db.fraud_patterns.create_index("pattern_id")
        await db.ron_rules.create_index("jurisdiction", unique=True)

        # Smart Document Studio + Template Marketplace + Escrow/Anchor (recent collections)
        await db.ai_generated_docs.create_index([("user_id", 1), ("created_at", -1)])
        await db.ai_generated_docs.create_index("id", unique=True)
        await db.ai_jobs.create_index("id", unique=True)
        await db.ai_jobs.create_index([("user_id", 1), ("created_at", -1)])
        await db.contract_anchors.create_index("id", unique=True)
        await db.contract_anchors.create_index([("user_id", 1), ("created_at", -1)])
        await db.contract_anchors.create_index("content_hash")
        await db.escrow_agreements.create_index("escrow_id", unique=True)
        await db.escrow_agreements.create_index([("created_by", 1), ("status", 1)])
        await db.marketplace_templates.create_index("id", unique=True)
        await db.marketplace_templates.create_index([("status", 1), ("category", 1)])
        await db.marketplace_templates.create_index([("status", 1), ("sales_count", -1)])
        await db.marketplace_templates.create_index("creator_id")
        await db.marketplace_sales.create_index("id", unique=True)
        await db.marketplace_sales.create_index([("template_id", 1), ("buyer_id", 1)])
        await db.marketplace_sales.create_index("buyer_id")
        await db.marketplace_sales.create_index("creator_id")
        await db.marketplace_sales.create_index("checkout_session_id", sparse=True)
        await db.marketplace_payouts.create_index([("creator_id", 1), ("status", 1)])
        await db.marketplace_payouts.create_index("sale_id")
        await db.payment_transactions.create_index("session_id")
        await db.payment_transactions.create_index([("user_id", 1), ("created_at", -1)])
        await db.ceremony_videos.create_index([("notary_request_id", 1)])
        await db.ceremony_videos.create_index("sha256")

        # Seed fraud intelligence data
        from services.fraud_intelligence_service import seed_fraud_intelligence
        await seed_fraud_intelligence(db)

        # Idempotent admin user seed (guarantees admin@notarychain.com exists on every deploy)
        from services.admin_seed_service import seed_admin_user
        try:
            seed_result = await seed_admin_user(db)
            logger.info(f"[admin_seed] result={seed_result}")
        except Exception as e:
            logger.warning(f"[admin_seed] failed (non-fatal): {e}")

        # Start background schedulers on exactly ONE pod (cluster-wide leader).
        # Followers stay idle; on leader failure another pod takes over.
        from services import leader_election, scheduler_manager
        leader_election.set_db(db)
        if await leader_election.acquire_leadership():
            await scheduler_manager.start_all()
        asyncio.create_task(leader_election.heartbeat_loop())

        logger.info("Database indexes created/verified successfully")
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")


@app.on_event("shutdown")
async def _release_scheduler_leadership():
    """Release the scheduler leader lease so a replacement pod takes over instantly."""
    try:
        from services import leader_election
        await leader_election.release_leadership()
    except Exception as e:
        logger.warning(f"Leader release on shutdown failed: {e}")