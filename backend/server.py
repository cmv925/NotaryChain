from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path

# Import route modules
from routes import auth_routes, document_routes, notary_routes, ai_routes, blockchain_routes, payment_routes, video_routes, crypto_routes, audit_routes, admin_routes, package_routes, email_routes, transaction_routes, twofa_routes
from middleware.security import setup_security, health_check, limiter

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

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix for legacy routes
api_router = APIRouter(prefix="/api")

# Add legacy health check route
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

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