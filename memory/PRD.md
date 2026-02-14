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
- **Frontend**: React, React Router, TailwindCSS, Shadcn UI
- **Backend**: FastAPI, MongoDB (Motor)
- **Authentication**: JWT (python-jose, passlib[bcrypt])
- **AI**: Google Gemini via emergent-integrations
- **Blockchain**: Hedera Hashgraph (Testnet) for document sealing

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

### ✅ Phase 4: Notary Management System (COMPLETED)
- Notary Dashboard (`/notary/dashboard`)
- Request Notarization (`/request-notarization`)
- Notary onboarding (`/notary/onboarding`)
- Backend: notary models, notary_routes.py

### ✅ Phase 5: AI Document Analysis & Biometric Verification (COMPLETED - Feb 14, 2026)
**Features:**
- AI-powered document analysis using Google Gemini
- Analyzes documents for discrepancies, missing information, fraud indicators
- Specialized prompts for different document types
- Webcam-based biometric face verification simulation
- 3-step workflow: Document Upload → Identity Verification → Submit Request

**API Endpoints:**
- `POST /api/ai/analyze-document` - Analyze uploaded document with Gemini AI
- `POST /api/ai/verify-biometric` - Record biometric verification result
- `GET /api/ai/session/{session_id}/analysis` - Get all analyses for a session

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
- **Biometric Verification**: Simulated with random confidence score 85-95%. Not actual face recognition.
- **Blockchain Full HCS**: Currently creates verifiable local seals with Hedera account binding. Full HCS topic submission pending topic creation.

## Beta Launch Checklist
- [x] AI Document Analysis (Gemini)
- [x] Biometric Verification (Simulated)
- [x] Hedera Blockchain Integration (Testnet)
- [x] Document Verification Page
- [ ] **Payment Processing (Stripe)** - NEXT
- [ ] **Video Conferencing (RON sessions)** - UPCOMING
- [ ] HCS Topic creation for on-chain messages
- [ ] Email notifications

## Potential Enhancements
- Real face detection using TensorFlow.js
- Full HCS topic submission with real consensus timestamps
- Stripe payment integration for notary fees
- Video conferencing for live RON sessions
- Email notifications for status updates
