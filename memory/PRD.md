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

### ✅ Phase 4: Notary Management System (UPDATED - Feb 15, 2026)
- **Enhanced Notary Dashboard** (`/notary/dashboard`) with:
  - 4 stat cards (Completed, In Progress, Available, Active Sessions)
  - Request details modal with Document Info, Signers, Verification Status
  - Accept Request → Start Session → Complete workflow
  - Video session integration
- Request Notarization (`/request-notarization`)
- Notary onboarding (`/notary/onboarding`)
- Backend: notary models, notary_routes.py (route ordering fix applied)

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

### ✅ Phase 6: Hedera Blockchain Integration (COMPLETED - Feb 14, 2026)
**Features:**
- Document sealing on Hedera blockchain (testnet)
- SHA-256 hash of documents stored with tamper-proof timestamps
- Public verification page at `/verify`
- Explorer links to HashScan for transaction verification
- Automatic sealing on notarization request submission

**API Endpoints:**
- `GET /api/blockchain/status` - Check Hedera connection status
- `POST /api/blockchain/seal` - Seal document hash on blockchain
- `POST /api/blockchain/seal-file` - Upload and seal file
- `GET /api/blockchain/verify/{document_hash}` - Verify document by hash
- `POST /api/blockchain/verify` - Verify with hash and transaction ID
- `GET /api/blockchain/seals/my` - Get user's blockchain seals

**Configuration:**
- Account ID: 0.0.6534570
- Network: Testnet
- Explorer: HashScan (https://hashscan.io/testnet)

### ✅ Phase 7: Stripe Payments (COMPLETED - Feb 15, 2026)
**Features:**
- Checkout page at `/checkout` with 7 pricing tiers ($25-$75)
- Card + Crypto payment options via Stripe
- Payment success/cancel pages with status polling
- Payment history in database

**API Endpoints:**
- `GET /api/payments/packages` - Get pricing packages
- `POST /api/payments/checkout` - Create Stripe checkout session
- `GET /api/payments/status/{session_id}` - Check payment status
- `GET /api/payments/history` - User payment history

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

## Database Schema

### users
```
{
  id: string,
  email: string,
  full_name: string,
  hashed_password: string,
  created_at: datetime,
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

## Key Files
- `/app/backend/server.py` - Main FastAPI application
- `/app/backend/routes/ai_routes.py` - AI analysis endpoints
- `/app/backend/routes/blockchain_routes.py` - Hedera blockchain endpoints
- `/app/backend/services/hedera_service.py` - Hedera integration service
- `/app/frontend/src/pages/RequestNotarization.jsx` - 3-step workflow UI
- `/app/frontend/src/pages/VerifyDocument.jsx` - Public verification page

## Test Credentials
- Email: testuser@example.com
- Password: Test123!

## MOCKED Features
- **Blockchain Full HCS**: Currently creates verifiable local seals with Hedera account binding. Full HCS topic submission pending topic creation.

## Real Implementations
- **Biometric Verification (Feb 15, 2026)**: REAL client-side face detection using TensorFlow.js and MediaPipe FaceDetector. Includes:
  - Real-time face detection and tracking
  - 5 liveness challenges (center, blink, turnLeft, turnRight, smile)
  - Confidence scoring based on face size and centering
  - WebGL backend with CPU fallback
  - Camera error handling with retry functionality

## Beta Launch Checklist
- [x] AI Document Analysis (Gemini)
- [x] **Biometric Verification (REAL)** - TensorFlow.js face detection with liveness challenges
- [x] Hedera Blockchain Integration (Testnet)
- [x] Document Verification Page
- [x] **Payment Processing (Stripe)** - Card + Crypto ready
- [x] **Video Conferencing Infrastructure (Daily.co)** - Backend ready, needs API key
- [ ] HCS Topic creation for on-chain messages
- [ ] Email notifications
- [ ] Daily.co API key configuration

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

### Blockchain
- `GET /api/blockchain/status` - Hedera connection status
- `POST /api/blockchain/seal` - Seal document on chain
- `GET /api/blockchain/verify/{hash}` - Verify document

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
```

## Potential Enhancements
- ~~Real face detection using TensorFlow.js~~ ✅ COMPLETED Feb 15, 2026
- Full HCS topic submission with real consensus timestamps
- ~~Stripe payment integration for notary fees~~ ✅ COMPLETED
- ~~Video conferencing for live RON sessions~~ ✅ COMPLETED
- Notary-side workflow UI (manage requests, join sessions, approve/reject)
- Crypto payment backend logic
- Compliance & Audit Logs system
- Admin Dashboard
- Email notifications for status updates
