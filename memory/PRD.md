# NotaryChain - Product Requirements Document

## Original Problem Statement
Create a pixel-perfect clone of https://nortary-chain.vercel.app/ with additional features:
1. Extract and implement features from provided PDF documents
2. Interactive Demo Experience for document upload and verification
3. User Authentication & User Dashboard
4. Notary management and workflow system
5. AI-powered document analysis with biometric identity verification
6. **Hedera blockchain integration for tamper-proof document sealing**

## Tech Stack
- **Frontend**: React, React Router, TailwindCSS, Shadcn UI, TensorFlow.js
- **Backend**: FastAPI, MongoDB (Motor)
- **Authentication**: JWT (python-jose, passlib[bcrypt])
- **AI**: Google Gemini via emergent-integrations
- **Blockchain**: Hedera Hashgraph (Testnet) for document sealing
- **Video**: Daily.co for Remote Online Notarization

## What's Been Implemented

### ✅ Phase 1: Website Clone & Feature Expansion (COMPLETED)
- Multi-section landing page matching original site
- Additional sections: QuickSealSection, TrustLayerSection, AIDocumentSection, BiometricSection, etc.
- Responsive design with dark theme

### ✅ Phase 2: Interactive Demo (COMPLETED)
- Demo page at `/demo` for mock document upload flow (QuickSealDemo)

### ✅ Phase 3: User Authentication (COMPLETED)
- JWT-based authentication system
- Signup (`/api/auth/signup`) and Login (`/api/auth/login`) endpoints
- Protected routes with AuthContext
- User dashboard at `/dashboard`

### ✅ Phase 4: Notary Management System (UPDATED - Feb 16, 2026)
- **Enhanced Notary Dashboard** (`/notary/dashboard`) with:
  - 4 stat cards (Completed, In Progress, Available, Active Sessions)
  - Request details modal with Document Info, Signers, Verification Status
  - Accept Request → Start Session → Complete workflow
  - Video session integration
- Request Notarization (`/request-notarization`)
- **Full Notary Onboarding System** (`/notary/onboarding`):
  - Multi-step application form (Personal Info → License Details → Upload Documents)
  - Credential document uploads (Commission Certificate, Government ID, E-Signature, Background Check, RON Certificate)
  - Application status tracking with status banner
  - Admin review/approve/reject workflow
- Backend: notary models, notary_routes.py with credential upload endpoints

### ✅ Phase 5: AI Document Analysis & Biometric Verification (UPDATED - Feb 15, 2026)
**Features:**
- AI-powered document analysis using Google Gemini
- **Document Signature Detection** - Analyzes signatures in documents:
  - Signatures found count and locations
  - Signature types (handwritten, digital, stamp, initials)
  - Signature quality assessment
  - Missing signatures identification
  - Signature authenticity concerns
- Analyzes documents for discrepancies, missing information, fraud indicators
- Specialized prompts for different document types (POA, Real Estate, Will, Trust, Contract, Affidavit)
- **REAL** webcam-based biometric face verification using TensorFlow.js + MediaPipe
- 5 liveness challenges: center gaze, blink detection, head turn left/right, smile
- Client-side face detection with confidence scoring
- 3-step workflow: Document Upload → Identity Verification → Submit Request

**API Endpoints:**
- `POST /api/ai/analyze-document` - Analyze uploaded document with Gemini AI (includes signature_analysis)
- `POST /api/ai/verify-biometric` - Record biometric verification result
- `GET /api/ai/session/{session_id}/analysis` - Get all analyses for a session

**Frontend Components:**
- `BiometricVerification.jsx` - Real-time face detection with TensorFlow.js
  - MediaPipe FaceDetector model
  - WebGL backend with CPU fallback
  - Liveness challenge progression
  - Confidence and liveness score display
- Signature Analysis UI section in RequestNotarization.jsx

### ✅ Phase 6: Hedera Blockchain Integration (COMPLETED & ENHANCED - Feb 16, 2026)
**Features:**
- Document sealing on Hedera blockchain (testnet)
- SHA-256 hash of documents stored with tamper-proof timestamps
- Public verification page at `/verify`
- Explorer links to HashScan for transaction verification
- Automatic sealing on notarization request submission
- **Dynamic HCS Topic Creation** - Each notarization session gets its own HCS topic
- **Immutable Audit Trail** - All notarization events logged on-chain
- **Real SDK Integration** - Using hiero-sdk-python for native Hedera interactions
- **NEW: Blockchain Audit Trail UI Component** - Visual timeline display of HCS events

**HCS (Hedera Consensus Service) Integration:**
- Topic creation per notarization session (~0.01 HBAR per topic)
- Events logged: REQUEST_CREATED, NOTARY_ASSIGNED, SESSION_STARTED, NOTARIZATION_COMPLETED
- Messages retrievable via mirror node API
- Sequence numbers for ordered audit trail
- **NEW: BlockchainAuditTrail.jsx component** - Displays events in expandable timeline UI

**API Endpoints:**
- `GET /api/blockchain/status` - Check Hedera connection status (includes sdk_available)
- `POST /api/blockchain/topics/create` - Create HCS topic for session
- `POST /api/blockchain/topics/{topic_id}/messages` - Submit audit message
- `GET /api/blockchain/topics/{topic_id}` - Get topic info and messages
- `GET /api/blockchain/topics/my` - Get user's created topics
- `POST /api/blockchain/seal` - Seal document hash (with optional session_topic_id)
- `POST /api/blockchain/seal-file` - Upload and seal file
- `GET /api/blockchain/verify/{document_hash}` - Verify document by hash
- `POST /api/blockchain/verify` - Verify with hash and transaction ID
- `GET /api/blockchain/seals/my` - Get user's blockchain seals
- `GET /api/blockchain/account/balance` - Admin: Check HBAR balance

**Configuration:**
- Account ID: 0.0.6534570
- Network: Testnet
- SDK: hiero-sdk-python v0.2.0
- Explorer: HashScan (https://hashscan.io/testnet)

### ✅ Phase 6B: Notarization Package Service (COMPLETED - Feb 16, 2026)
**Features:**
- **Immutable Notarization Packages** - Bundles all verification data into a single sealed record:
  - AI Document Analysis results
  - Biometric Verification data (face detection, liveness scores)
  - Video Session metadata (timestamps, participants, duration)
  - Audit Trail (all notarization actions)
  - Document hashes and blockchain seals
- **Package Sealing** - Entire package hashed (SHA-256) and recorded on Hedera blockchain
- **Component Hashing** - Individual SHA-256 hashes for each data section
- **Digital Certificate Generation** - Formatted notarization certificate with all proofs
- **Integrity Verification** - Recalculate hashes to verify package wasn't tampered
- **Auto-Seal on Completion** - Package automatically sealed when notarization is completed

**API Endpoints:**
- `POST /api/packages/compile/{request_id}` - Compile verification data into package
- `POST /api/packages/seal/{request_id}` - Seal package on blockchain
- `GET /api/packages/{package_id}` - Retrieve sealed package
- `GET /api/packages/{package_id}/verify` - Verify package integrity
- `GET /api/packages/request/{request_id}` - Get package by request ID
- `GET /api/packages/request/{request_id}/certificate` - Get notarization certificate

**Package Structure:**
```json
{
  "package_version": "1.0.0",
  "package_type": "NOTARIZATION_CERTIFICATE",
  "notarization_request": {...},
  "participants": { "requester": {...}, "notary": {...} },
  "document_analysis": { "total_analyses": N, "analyses": [...] },
  "biometric_verification": { "total_verifications": N, "verifications": [...], "summary": {...} },
  "video_sessions": { "total_sessions": N, "sessions": [...], "summary": {...} },
  "audit_trail": { "total_actions": N, "actions": [...] },
  "blockchain_seals": { "total_seals": N, "seals": [...] },
  "integrity": {
    "package_hash": "SHA-256 of entire package",
    "document_analysis_hash": "...",
    "biometric_hash": "...",
    "video_sessions_hash": "...",
    "audit_trail_hash": "..."
  }
}
```

### ✅ Phase 7: Payment Processing (COMPLETED & ENHANCED - Feb 15, 2026)
**Features:**
- **Stripe Card Payments:**
  - Checkout page at `/checkout` with 7 pricing tiers ($25-$75)
  - Card + Crypto payment options via Stripe
  - Payment success/cancel pages with status polling
  - Payment history in database

- **Cryptocurrency Payments (NEW):**
  - Dedicated crypto checkout at `/checkout/crypto`
  - Supports BTC, ETH, USDC, USDT
  - Real-time price conversion from CoinGecko API
  - 60-second price caching with fallback prices
  - Unique payment IDs with 30-minute expiration
  - Wallet address and QR code for payments
  - Confirmation tracking (3 confirmations BTC, 12 for ETH/tokens)
  - Payment history with full transaction details
  - Demo mode with simulated confirmation for testing

**API Endpoints (Stripe):**
- `GET /api/payments/packages` - Get pricing packages
- `POST /api/payments/checkout` - Create Stripe checkout session
- `GET /api/payments/status/{session_id}` - Check payment status
- `GET /api/payments/history` - User payment history

**API Endpoints (Crypto):**
- `GET /api/crypto/supported` - List supported cryptocurrencies
- `GET /api/crypto/prices` - Get live crypto prices from CoinGecko
- `GET /api/crypto/convert/{crypto_id}/{usd_amount}` - USD to crypto conversion
- `POST /api/crypto/payment` - Create crypto payment request
- `GET /api/crypto/payment/{payment_id}/status` - Check payment status
- `POST /api/crypto/payment/{payment_id}/simulate-confirm` - Demo confirmation
- `GET /api/crypto/payments/history` - User's crypto payment history
- `GET /api/crypto/packages` - Get packages with crypto pricing

### ✅ Phase 8: Daily.co Video Conferencing (COMPLETED - Feb 15, 2026)
**Features:**
- Full video room UI integrated with Daily.co
- VideoRoom component with camera/mic/screenshare controls
- NotaryVideoSession page with pre-session, joining, active, and ended states
- Dashboard shows notary requests with "Start Session" / "Join Session" buttons
- Invite link sharing for participants
- Session expiry tracking with cloud recording enabled

**Frontend Components:**
- `/app/frontend/src/components/VideoRoom.jsx` - Daily.co video embed
- `/app/frontend/src/pages/NotaryVideoSession.jsx` - Full session management

**API Endpoints:**
- `GET /api/video/status` - Daily.co connection status
- `POST /api/video/rooms` - Create video room for RON session
- `POST /api/video/rooms/{id}/join` - Join existing room
- `POST /api/video/rooms/{id}/end` - End video session

**Route:** `/session/:requestId` - Video session page

### ✅ Phase 9: Compliance & Audit Logging (COMPLETED - Feb 15, 2026)
**Features:**
- Immutable audit trail for all platform actions
- 20+ action types covering user, document, notarization, payment, and admin actions
- Severity levels: info, warning, critical
- Automatic logging from admin actions (user enable/disable, role changes, notary approvals)
- Export capabilities for compliance (JSON and CSV formats)
- User activity tracking
- Statistics and analytics aggregations

**API Endpoints:**
- `GET /api/audit/logs` - Get audit logs with pagination and filtering
- `GET /api/audit/logs/{id}` - Get detailed audit log entry
- `GET /api/audit/stats` - Get audit statistics by action, severity, resource, daily
- `GET /api/audit/export` - Export logs in JSON or CSV format
- `GET /api/audit/user/{id}/activity` - Get user activity logs

**Database Collection:** `audit_logs`

### ✅ Phase 10: Admin Dashboard (COMPLETED - Feb 15, 2026)
**Features:**
- Platform-wide statistics dashboard
- User management (view, search, enable/disable, role changes)
- Notary application management (approve/reject pending applications)
- Revenue analytics with daily breakdown (Stripe + Crypto)
- Notarization analytics by status and document type
- Audit logs viewer with severity indicators
- Role-based access control (admin only)

**API Endpoints:**
- `GET /api/admin/stats` - Platform statistics
- `GET /api/admin/users` - List users with pagination/filtering
- `GET /api/admin/users/{id}` - Detailed user info with activity
- `PATCH /api/admin/users/{id}/status` - Enable/disable user
- `PATCH /api/admin/users/{id}/role` - Change user role
- `GET /api/admin/notaries` - List notary profiles
- `GET /api/admin/notaries/pending` - Pending applications
- `POST /api/admin/notaries/{id}/approve` - Approve notary
- `POST /api/admin/notaries/{id}/reject` - Reject notary
- `GET /api/admin/analytics/revenue` - Revenue analytics
- `GET /api/admin/analytics/notarizations` - Notarization analytics
- `POST /api/admin/seed-admin` - Create initial admin user

**Route:** `/admin` - Admin dashboard (admin role required)

### ✅ Phase 11: Email Notifications (COMPLETED - Feb 16, 2026)
**Features:**
- Transactional email service using Resend API
- Non-blocking email delivery via FastAPI BackgroundTasks
- Professional HTML email templates with NotaryChain branding

**Email Templates (6 types):**
1. **Welcome Email** - Sent on user registration with platform features overview
2. **Application Submitted** - Confirmation when notary applies to the platform
3. **Application Approved** - Notification with congratulations when approved
4. **Application Rejected** - Notification with rejection reason
5. **Request Assigned** - User notified when notary accepts their request
6. **Notarization Complete** - Completion confirmation with blockchain seal info

**API Endpoints:**
- `GET /api/email/status` - Email service configuration status
- `POST /api/email/test` - Admin: Test any of the 6 email templates
- `POST /api/email/send-custom` - Admin: Send custom HTML email

**Integration Points:**
- `POST /api/auth/signup` - Triggers welcome email
- `POST /api/notary/profile` - Triggers application submitted email
- `POST /api/admin/notaries/{id}/approve` - Triggers approval email
- `POST /api/admin/notaries/{id}/reject` - Triggers rejection email
- `POST /api/notary/requests/{id}/assign` - Triggers assignment email
- `POST /api/notary/requests/{id}/complete` - Triggers completion email

**Configuration:**
- API Key: RESEND_API_KEY in backend/.env
- Sender: onboarding@resend.dev (test mode) or custom domain
- Note: Production requires domain verification at resend.com/domains

### ✅ Phase 12: AI Transaction Orchestrator™ (COMPLETED - Feb 17, 2026)
**Features:**
- Complete transaction workflow management system for complex multi-party legal agreements
- Transaction Blueprints (pre-defined workflows for different transaction types)
- Transaction Room (centralized collaboration hub with real-time visibility)
- AI-powered recommendations and risk analysis
- Blockchain settlement on Hedera HCS

**System Blueprints (4 types):**
1. **Real Estate Closing** - 10 steps: Purchase Agreement, Title Search, Loan Application, Inspection, Appraisal, Final Approval, Closing Disclosure, Walkthrough, Closing Meeting, Funds Transfer
2. **Business Contract** - 6 steps: Draft Upload, Legal Review, Negotiations, Final Preparation, Signatures, Notarization
3. **Estate Settlement** - 10 steps: Probate Filing, Letters Testamentary, Notifications, Inventory, Creditor Claims, Tax Filing, Distribution Plan, Beneficiary Approval, Distribution, Final Accounting
4. **Trust Settlement** - 8 steps: Administration Initiation, Beneficiary Notification, Asset Valuation, Debt Settlement, Distribution Schedule, Acknowledgment, Distribution, Termination

**Transaction Room Features:**
- Overview tab with stats, transaction details, blockchain audit trail link
- Tasks tab with workflow steps, dependencies, completion tracking
- Participants tab with roles, status, and permissions
- Messages tab for real-time collaboration
- Documents tab for file management
- AI tab with risk score, recommendations, and anomaly detection

**AI Orchestration:**
- Risk scoring (0-100) based on overdue tasks, pending participants, blocked tasks
- Intelligent recommendations with priority levels (high/medium/normal)
- Task dependency management and automatic unblocking
- Progress tracking with target date analysis

**Blockchain Integration:**
- HCS topic creation per transaction for immutable audit trail
- Events logged: TRANSACTION_CREATED, PARTICIPANT_ADDED, TASK_STATUS_CHANGED, STATUS_CHANGED, TRANSACTION_SETTLED
- Settlement hash sealed on Hedera upon completion

**API Endpoints:**
- `GET /api/transactions/blueprints` - List available blueprints
- `GET /api/transactions/blueprints/{id}` - Get blueprint details
- `POST /api/transactions` - Create transaction from blueprint
- `GET /api/transactions` - List user's transactions
- `GET /api/transactions/{id}` - Get transaction details
- `GET /api/transactions/{id}/room` - Get full room data
- `PATCH /api/transactions/{id}/status` - Update status
- `POST /api/transactions/{id}/start` - Start transaction
- `POST /api/transactions/{id}/join` - Join as invited participant
- `GET /api/transactions/{id}/tasks` - List tasks
- `PATCH /api/transactions/{id}/tasks/{taskId}` - Update task
- `POST /api/transactions/{id}/tasks/{taskId}/complete` - Complete task
- `GET /api/transactions/{id}/participants` - List participants
- `POST /api/transactions/{id}/participants` - Add participant
- `GET /api/transactions/{id}/messages` - Get messages
- `POST /api/transactions/{id}/messages` - Send message
- `GET /api/transactions/{id}/ai/recommendations` - Get AI analysis
- `POST /api/transactions/{id}/settle` - Settle on blockchain

**Frontend Routes:**
- `/transactions` - Transaction Orchestrator list page
- `/transactions/:transactionId` - Transaction Room page

## Database Schema

### users
```
{
  id: string,
  email: string,
  full_name: string,
  hashed_password: string,
  role: string (user/notary/admin),
  status: string (active/disabled/suspended),
  created_at: datetime,
  last_login: datetime,
  is_active: boolean
}
```

### document_analyses
```
{
  id: string,
  user_id: string,
  session_id: string,
  filename: string,
  document_type: string,
  analysis_result: object,
  timestamp: datetime
}
```

### biometric_verifications
```
{
  id: string,
  session_id: string,
  user_id: string,
  verification_type: string,
  status: string (passed/failed),
  confidence_score: float,
  timestamp: datetime
}
```

### blockchain_seals
```
{
  id: string,
  user_id: string,
  document_name: string,
  document_hash: string,
  notary_request_id: string,
  transaction_id: string,
  topic_id: string,
  network: string,
  explorer_url: string,
  sealed_at: datetime,
  metadata: object
}
```

### crypto_payments
```
{
  id: string,
  user_id: string,
  user_email: string,
  package_id: string,
  package_name: string,
  notary_request_id: string (optional),
  crypto_id: string (bitcoin/ethereum/usd-coin/tether),
  crypto_symbol: string (BTC/ETH/USDC/USDT),
  crypto_name: string,
  crypto_amount: float,
  usd_amount: float,
  exchange_rate: float,
  wallet_address: string,
  network: string,
  confirmations_required: int,
  confirmations: int,
  status: string (pending/confirming/confirmed/expired),
  qr_data: string,
  created_at: datetime,
  expires_at: datetime,
  updated_at: datetime,
  confirmed_at: datetime (optional)
}
```

### audit_logs
```
{
  id: string,
  action: string (enum: user.*, document.*, notarization.*, verification.*, blockchain.*, payment.*, notary.*, admin.*),
  resource_type: string,
  resource_id: string (optional),
  description: string,
  user_id: string (optional),
  user_email: string (optional),
  severity: string (info/warning/critical),
  ip_address: string (optional),
  metadata: object,
  timestamp: datetime,
  created_at: datetime
}
```

## Key Files
- `/app/backend/server.py` - Main FastAPI application
- `/app/backend/routes/ai_routes.py` - AI analysis endpoints
- `/app/backend/routes/blockchain_routes.py` - Hedera blockchain endpoints
- `/app/backend/routes/crypto_routes.py` - Cryptocurrency payment endpoints
- `/app/backend/routes/audit_routes.py` - Audit logging endpoints
- `/app/backend/routes/admin_routes.py` - Admin dashboard endpoints
- `/app/backend/services/hedera_service.py` - Hedera integration service
- `/app/frontend/src/pages/RequestNotarization.jsx` - 3-step workflow UI
- `/app/frontend/src/pages/VerifyDocument.jsx` - Public verification page
- `/app/frontend/src/pages/CryptoCheckout.jsx` - Cryptocurrency checkout page
- `/app/frontend/src/pages/AdminDashboard.jsx` - Admin dashboard UI

## Test Credentials
- Email: demo@test.com
- Password: Demo123!

## MOCKED Features
- **Crypto Wallet Addresses**: Demo uses static wallet addresses. Production would generate unique addresses per payment.
- **QR Code**: QR code display is a placeholder icon. Production would use actual QR generation library.

## Real Implementations
- **Biometric Verification (Feb 15, 2026)**: REAL client-side face detection using TensorFlow.js and MediaPipe FaceDetector. Includes:
  - Real-time face detection and tracking
  - 5 liveness challenges (center, blink, turnLeft, turnRight, smile)
  - Confidence scoring based on face size and centering
  - WebGL backend with CPU fallback
  - Camera error handling with retry functionality

- **Cryptocurrency Payments (Feb 15, 2026)**: REAL price conversion from CoinGecko API. Includes:
  - Live BTC, ETH, USDC, USDT prices with 60-second caching
  - Fallback prices if API unavailable
  - Payment expiration tracking (30 minutes)
  - Confirmation tracking (3 for BTC, 12 for ETH)
  - Demo simulation endpoint for testing

- **HCS Topic Creation (Feb 15, 2026)**: REAL Hedera SDK integration for topic creation and messaging
  - hiero-sdk-python v0.2.0 for native blockchain interactions
  - Dynamic topic per notarization session
  - Events logged to HCS with sequence numbers
  - Audit trail visible via BlockchainAuditTrail component

- **Notary Onboarding (Feb 16, 2026)**: Full credential verification workflow
  - Multi-step application form
  - Document upload for credentials (Commission Certificate, Gov ID, etc.)
  - Admin review/approve/reject workflow
  - Role promotion on approval

- **Notarization Package Sealing (Feb 16, 2026)**: Immutable notarization packages on blockchain
  - Bundles AI analysis, biometric data, video sessions, audit trail
  - SHA-256 hash of entire package recorded on Hedera HCS
  - Component-level hashes for individual verification
  - Digital certificate generation
  - Auto-seal on notarization completion

## Beta Launch Checklist
- [x] AI Document Analysis (Gemini)
- [x] **Biometric Verification (REAL)** - TensorFlow.js face detection with liveness challenges
- [x] Hedera Blockchain Integration (Testnet)
- [x] Document Verification Page
- [x] **Payment Processing (Stripe)** - Card payments ready
- [x] **Cryptocurrency Payments** - BTC, ETH, USDC, USDT with CoinGecko + QR codes
- [x] **Video Conferencing Infrastructure (Daily.co)** - Backend ready
- [x] **Compliance & Audit Logs** - Immutable audit trail with export
- [x] **Admin Dashboard** - User management, notary approvals, analytics
- [x] **HCS Topic Creation (REAL)** - Dynamic topic creation per notarization session ✅ COMPLETED Feb 15, 2026
- [x] **Full Notary Onboarding** - Multi-step form with credential uploads ✅ COMPLETED Feb 16, 2026
- [x] **Blockchain Audit Trail UI** - Visual HCS event display ✅ COMPLETED Feb 16, 2026
- [x] **Notarization Package Sealing** - Immutable packages on blockchain ✅ COMPLETED Feb 16, 2026
- [x] **Email Notifications (Resend)** - Transactional emails for all platform events ✅ COMPLETED Feb 16, 2026
- [x] **AI Transaction Orchestrator™** - Multi-party transaction workflow management ✅ COMPLETED Feb 17, 2026

## Admin Access
- **Email:** admin@notarychain.com
- **Password:** Admin123!
- **Route:** /admin

## Pricing Structure (Implemented)
| Document Type | Price (USD) |
|--------------|-------------|
| General Document | $25 |
| Affidavit | $30 |
| Power of Attorney | $35 |
| Contract | $40 |
| Last Will & Testament | $50 |
| Trust Document | $65 |
| Real Estate Document | $75 |

## API Endpoints Summary

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login and get token
- `GET /api/auth/me` - Get current user

### AI Analysis
- `POST /api/ai/analyze-document` - AI document analysis
- `POST /api/ai/verify-biometric` - Biometric verification
- `GET /api/ai/session/{session_id}/analysis` - Get session analysis

### Blockchain / HCS
- `GET /api/blockchain/status` - Hedera connection status (includes sdk_available)
- `POST /api/blockchain/topics/create` - Create HCS topic for notarization session
- `POST /api/blockchain/topics/{topic_id}/messages` - Submit audit message to topic
- `GET /api/blockchain/topics/{topic_id}` - Get topic info and messages
- `GET /api/blockchain/topics/my` - Get user's created topics
- `POST /api/blockchain/seal` - Seal document on chain (with optional session_topic_id)
- `POST /api/blockchain/seal-file` - Upload and seal file
- `GET /api/blockchain/verify/{hash}` - Verify document by hash
- `POST /api/blockchain/verify` - Verify with hash and transaction ID
- `GET /api/blockchain/seals/my` - Get user's blockchain seals
- `GET /api/blockchain/account/balance` - Admin: Check HBAR balance

### Payments
- `GET /api/payments/packages` - Get pricing packages
- `POST /api/payments/checkout` - Create Stripe checkout
- `GET /api/payments/status/{session_id}` - Check payment status
- `GET /api/payments/history` - User payment history

### Video Conferencing
- `GET /api/video/status` - Daily.co connection status
- `POST /api/video/rooms` - Create video room for RON session
- `POST /api/video/rooms/{id}/join` - Join video room
- `POST /api/video/rooms/{id}/end` - End video session

## Environment Variables Required
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
EMERGENT_LLM_KEY=sk-emergent-xxx (for Gemini AI)
HEDERA_ACCOUNT_ID=0.0.xxxxxx
HEDERA_PRIVATE_KEY=0x...
HEDERA_NETWORK=testnet
STRIPE_API_KEY=sk_test_emergent
DAILY_API_KEY=your_daily_api_key (get from daily.co dashboard)
RESEND_API_KEY=re_xxx (for email notifications)
SENDER_EMAIL=onboarding@resend.dev (or custom domain email)
```

## Potential Enhancements
- ~~Real face detection using TensorFlow.js~~ ✅ COMPLETED Feb 15, 2026
- ~~Full HCS topic submission with real consensus timestamps~~ ✅ COMPLETED Feb 15, 2026
- ~~Stripe payment integration for notary fees~~ ✅ COMPLETED
- ~~Video conferencing for live RON sessions~~ ✅ COMPLETED
- Notary-side workflow UI (manage requests, join sessions, approve/reject)
- ~~Crypto payment backend logic~~ ✅ COMPLETED
- ~~Compliance & Audit Logs system~~ ✅ COMPLETED
- ~~Admin Dashboard~~ ✅ COMPLETED
- ~~Email notifications for status updates~~ ✅ COMPLETED Feb 16, 2026
- ~~AI Transaction Orchestrator~~ ✅ COMPLETED Feb 17, 2026
- Advanced Admin Analytics with visualizations
- Dedicated Notarization Certificate UI page
- Custom Blueprint Creator UI for admins
