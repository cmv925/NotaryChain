from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import asyncio
import logging
from pathlib import Path

# Import route modules
from routes import auth_routes, document_routes, notary_routes, ai_routes, blockchain_routes, payment_routes, video_routes, crypto_routes, audit_routes, admin_routes, package_routes, email_routes, transaction_routes, twofa_routes, jobs_routes, notification_routes, subscription_routes, notary_professional_routes, gdpr_routes, infra_routes, ws_routes, api_key_routes, public_api_routes, ron_compliance_routes, webhook_routes, template_routes, organization_routes, draft_routes, vault_routes, expiry_routes, draft_collab_routes, bulk_routes, marketplace_routes, embed_routes
from middleware.security import setup_security, health_check, limiter
from services.notification_service import set_db as set_notification_db, set_ws_manager
from services.ws_manager import ws_manager
from services import expiry_service

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

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

# Webhook service needs db too
from services import webhook_service
webhook_service.set_db(db)

set_notification_db(db)

# Initialize notification service WS manager
from services.ws_manager import ws_manager
set_ws_manager(ws_manager)

# Initialize expiry service dependencies
from services.email_service import email_service
from services import notification_service as notif_svc_module
expiry_service.set_dependencies(db, notif_svc_module, email_service)

# Create the main app without a prefix
app = FastAPI(
    title="NotaryChain API",
    description="Enterprise-grade digital notarization platform with AI and blockchain",
    version="1.0.0"
)

# Setup security middleware (rate limiting, headers, logging, sentry)
setup_security(app)

# Create a router with the /api prefix for legacy routes
api_router = APIRouter(prefix="/api")

# Health check endpoints
@api_router.get("/")
async def root():
    return {"message": "NotaryChain API", "version": "1.0.0", "status": "operational"}

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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

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

        # Seed default templates
        await template_routes.seed_templates()

        # Batch notarization indexes
        await db.notarization_batches.create_index("id", unique=True)
        await db.notarization_batches.create_index("user_id")

        # Marketplace reviews
        await db.notary_reviews.create_index("id", unique=True)
        await db.notary_reviews.create_index("notary_id")
        await db.notary_reviews.create_index([("user_id", 1), ("request_id", 1)], unique=True)

        # Start document expiry background checker
        asyncio.create_task(expiry_service.run_expiry_checker())

        logger.info("Database indexes created/verified successfully")
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")