import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import ProtectedRoute from './components/ProtectedRoute';
import { GatedRoute } from './components/GatedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { Toaster } from './components/ui/toaster';
import PlatformFooter from './components/PlatformFooter';
import GlobalSubheader from './components/GlobalSubheader';
import './i18n';

// Eager-loaded (critical path)
import HomePage from './pages/HomePage';
import NotaryLanding from './pages/NotaryLanding';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';

// Lazy-loaded pages
import {
  PricingPage, QuickSealDemo, Dashboard, NotaryOnboarding, NotaryDashboard,
  RequestNotarization, VerifyDocument, CheckoutPage, CryptoCheckout, PaymentSuccess,
  PaymentCancel, NotaryVideoSession, AdminDashboard, AdminIntegrations, LivingIdentity,
  PublicChallenge, PublicVerify, NotaryDirectory, NotaryProfile, TrustLayerLanding,
  TrustGraph, AdminTrustLayer, AssetVault, HandoffAccept, TrustHub,
  FloridaLanding, FloridaNotaryOnboard, KBATest, FloridaWitnessAccept, FloridaCeremonyReadiness,
  NotaryFLJournal, AdminFLCompliance, AdminSubpoena, FLNotaryRecruitment, AdminFLRecruitment,
  AdminFLRonsp, FieldScanner, PublicScannerDemo, EmbedCeremony, DeveloperSDK,
  SDKKeys, MyDocuments, StateComparison, StateDetail, CompliancePublicSnapshot,
  UserGuide, Marketplace, AdminCeremonyAnalytics, TrustBadges, TrustBadgeLanding,
  TransactionsPage, TransactionRoom, NotarizationCertificate, BlueprintCreator, SecuritySettings,
  SubscriptionPage, SubscriptionSuccess, NotaryJournal, DigitalSeal, CompliancePage,
  DeveloperPage, RONComplianceDashboard, TemplateLibrary, TemplateWizard, OrganizationPage,
  MyDrafts, SharedDraftViewer, BulkNotarization, NotaryMarketplace, WhiteLabelPage,
  BookingCalendar, MyBookings, AIDocumentGenerator, AIDocumentSummarizer, VideoWitness,
  DocumentRemediation, BiometricPassportPage, AIConductorPage, EvidencePackagePage, TransactionTimeline,
  RemindersPage, ApprovalsPage, DocComparePage, BrandingPage, SSOLoginPage,
  Auth0Callback, OktaCallback, OnboardingPage, InvestorDeck, CeremonyDashboard,
  VerifyCertificate, EscrowDashboard, ANANDashboard, FraudIntelligencePage, AIIntelligenceHub,
  PublicAuditTrail, CeremonyReplay, MultiSignature, CertificateExpiration, TokenizedEscrow,
  PCVDashboard, PCVPublicVerify,
  BatchCertificates,
} from './lazyRoutes';

const PageLoader = () => (
  <div className="min-h-screen bg-[#0f1825] flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500 text-sm">Loading...</p>
    </div>
  </div>
);

function App() {
  return (
    <ErrorBoundary>
    <ThemeProvider>
    <div className="App">
      <AuthProvider>
        <SubscriptionProvider>
        <WebSocketProvider>
        <BrowserRouter>
          <GlobalSubheader />
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<NotaryLanding />} />
            <Route path="/old-home" element={<HomePage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/sso/login" element={<SSOLoginPage />} />
            <Route path="/auth/callback" element={<Auth0Callback />} />
            <Route path="/auth/okta/callback" element={<OktaCallback />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/demo" element={<QuickSealDemo />} />
            <Route path="/verify" element={<PublicVerify />} />
            <Route path="/notaries" element={<NotaryDirectory />} />
            <Route path="/notary/:notaryId" element={<NotaryProfile />} />
            <Route path="/trustlayer" element={<TrustLayerLanding />} />
            <Route path="/trust-graph/:userId" element={<TrustGraph />} />
            <Route
              path="/admin/trustlayer"
              element={
                <ProtectedRoute>
                  <AdminTrustLayer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/asset-vault"
              element={
                <ProtectedRoute>
                  <AssetVault />
                </ProtectedRoute>
              }
            />
            <Route path="/handoff/:token" element={<HandoffAccept />} />
            <Route path="/florida" element={<FloridaLanding />} />
            <Route
              path="/notary/onboard/florida"
              element={
                <ProtectedRoute>
                  <FloridaNotaryOnboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/kba-test"
              element={
                <ProtectedRoute>
                  <KBATest />
                </ProtectedRoute>
              }
            />
            <Route path="/florida/witness/:token" element={<FloridaWitnessAccept />} />
            <Route
              path="/florida/ceremony-readiness"
              element={
                <ProtectedRoute>
                  <FloridaCeremonyReadiness />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notary/fl-journal"
              element={
                <ProtectedRoute>
                  <NotaryFLJournal />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/fl-compliance"
              element={
                <ProtectedRoute>
                  <AdminFLCompliance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/subpoena"
              element={
                <ProtectedRoute>
                  <AdminSubpoena />
                </ProtectedRoute>
              }
            />
            <Route path="/florida/notaries" element={<FLNotaryRecruitment />} />
            <Route
              path="/admin/fl-recruitment"
              element={
                <ProtectedRoute>
                  <AdminFLRecruitment />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/fl-ronsp"
              element={
                <ProtectedRoute>
                  <AdminFLRonsp />
                </ProtectedRoute>
              }
            />
            <Route
              path="/scanner"
              element={
                <ProtectedRoute>
                  <FieldScanner />
                </ProtectedRoute>
              }
            />
            <Route path="/scanner/demo" element={<PublicScannerDemo />} />
            <Route path="/embed/ceremony/:token" element={<EmbedCeremony />} />
            <Route path="/developers/sdk" element={<DeveloperSDK />} />
            <Route
              path="/developers/sdk-keys"
              element={
                <ProtectedRoute>
                  <SDKKeys />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-documents"
              element={
                <ProtectedRoute>
                  <MyDocuments />
                </ProtectedRoute>
              }
            />
            <Route path="/compliance/states" element={<StateComparison />} />
            <Route path="/compliance/states/:code" element={<StateDetail />} />
            <Route path="/compliance/snapshot/:token" element={<CompliancePublicSnapshot />} />
            <Route path="/docs" element={<UserGuide />} />
            <Route path="/help" element={<UserGuide />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route
              path="/admin/analytics"
              element={
                <ProtectedRoute>
                  <AdminCeremonyAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trust-hub"
              element={
                <ProtectedRoute>
                  <TrustHub />
                </ProtectedRoute>
              }
            />
            <Route path="/trust-badge" element={<TrustBadgeLanding />} />
            <Route path="/verify-document" element={<VerifyDocument />} />
            <Route path="/verify-certificate" element={<VerifyCertificate />} />
            <Route path="/verify-certificate/:certHash" element={<VerifyCertificate />} />
            <Route path="/investor-deck" element={<InvestorDeck />} />
            <Route path="/audit-trail" element={<PublicAuditTrail />} />
            <Route
              path="/ceremony"
              element={
                <ProtectedRoute>
                  <CeremonyDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ceremony/:ceremonyId"
              element={
                <ProtectedRoute>
                  <CeremonyDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/escrow"
              element={
                <ProtectedRoute>
                  <GatedRoute feature="escrow_intelligence" title="Escrow Intelligence" description="Smart contract-based escrow with AI-verified conditions. Requires Enterprise plan.">
                    <EscrowDashboard />
                  </GatedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/escrow/:escrowId"
              element={
                <ProtectedRoute>
                  <GatedRoute feature="escrow_intelligence" title="Escrow Intelligence" description="Smart contract-based escrow with AI-verified conditions. Requires Enterprise plan.">
                    <EscrowDashboard />
                  </GatedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/anan"
              element={
                <ProtectedRoute>
                  <GatedRoute feature="anan" title="Autonomous Notary Agent Network" description="Blind 2-of-3 AI consensus, SAN bond tracking, and agent reputation. Requires Enterprise plan.">
                    <ANANDashboard />
                  </GatedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/anan/:ceremonyId"
              element={
                <ProtectedRoute>
                  <GatedRoute feature="anan" title="Autonomous Notary Agent Network" description="Blind 2-of-3 AI consensus, SAN bond tracking, and agent reputation. Requires Enterprise plan.">
                    <ANANDashboard />
                  </GatedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/fraud-intelligence"
              element={
                <ProtectedRoute>
                  <GatedRoute feature="fraud_intelligence" title="Fraud Intelligence" description="AI-powered fraud detection and analytics dashboard. Requires Enterprise plan.">
                    <FraudIntelligencePage />
                  </GatedRoute>
                </ProtectedRoute>
              }
            />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/checkout/crypto" element={<CryptoCheckout />} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/payment/cancel" element={<PaymentCancel />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/request-notarization"
              element={
                <ProtectedRoute>
                  <RequestNotarization />
                </ProtectedRoute>
              }
            />
            <Route
              path="/session/:requestId"
              element={
                <ProtectedRoute>
                  <NotaryVideoSession />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notary/onboarding"
              element={
                <ProtectedRoute>
                  <NotaryOnboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notary/dashboard"
              element={
                <ProtectedRoute>
                  <NotaryDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/integrations"
              element={
                <ProtectedRoute>
                  <AdminIntegrations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/identity"
              element={
                <ProtectedRoute>
                  <LivingIdentity />
                </ProtectedRoute>
              }
            />
            <Route path="/identity/challenge/:token" element={<PublicChallenge />} />
            <Route
              path="/badges"
              element={
                <ProtectedRoute>
                  <TrustBadges />
                </ProtectedRoute>
              }
            />
            <Route
              path="/transactions"
              element={
                <ProtectedRoute>
                  <TransactionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/transactions/:transactionId"
              element={
                <ProtectedRoute>
                  <TransactionRoom />
                </ProtectedRoute>
              }
            />
            <Route
              path="/certificate/:requestId"
              element={
                <ProtectedRoute>
                  <NotarizationCertificate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/blueprints/create"
              element={
                <ProtectedRoute>
                  <BlueprintCreator />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/security"
              element={
                <ProtectedRoute>
                  <SecuritySettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/subscription"
              element={
                <ProtectedRoute>
                  <SubscriptionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/subscription/success"
              element={
                <ProtectedRoute>
                  <SubscriptionSuccess />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notary/journal"
              element={
                <ProtectedRoute>
                  <NotaryJournal />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notary/seal"
              element={
                <ProtectedRoute>
                  <DigitalSeal />
                </ProtectedRoute>
              }
            />
            <Route
              path="/compliance"
              element={
                <ProtectedRoute>
                  <CompliancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/developers"
              element={
                <ProtectedRoute>
                  <DeveloperPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/ron-compliance"
              element={
                <ProtectedRoute>
                  <RONComplianceDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/templates"
              element={
                <ProtectedRoute>
                  <TemplateLibrary />
                </ProtectedRoute>
              }
            />
            <Route
              path="/templates/:templateId/fill"
              element={
                <ProtectedRoute>
                  <TemplateWizard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/organizations"
              element={
                <ProtectedRoute>
                  <GatedRoute feature="organization" title="Organization Management" description="Multi-seat team management with RBAC. Requires Enterprise plan.">
                    <OrganizationPage />
                  </GatedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-drafts"
              element={
                <ProtectedRoute>
                  <MyDrafts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/drafts/shared/:shareToken"
              element={
                <ProtectedRoute>
                  <SharedDraftViewer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bulk-notarization"
              element={
                <ProtectedRoute>
                  <GatedRoute feature="bulk_notarization" title="Bulk Notarization" description="Process multiple notarizations in batch. Requires Enterprise plan.">
                    <BulkNotarization />
                  </GatedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/marketplace"
              element={
                <ProtectedRoute>
                  <NotaryMarketplace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/white-label"
              element={
                <ProtectedRoute>
                  <GatedRoute feature="white_label" title="White Label Branding" description="Customize the platform with your own branding. Requires Enterprise plan.">
                    <WhiteLabelPage />
                  </GatedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/book/:notaryId"
              element={
                <ProtectedRoute>
                  <BookingCalendar />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-bookings"
              element={
                <ProtectedRoute>
                  <MyBookings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ai-generator"
              element={
                <ProtectedRoute>
                  <GatedRoute feature="ai_generator" title="AI Document Generator" description="AI-powered legal document generation. Requires Professional plan.">
                    <AIDocumentGenerator />
                  </GatedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ai-summarizer"
              element={
                <ProtectedRoute>
                  <GatedRoute feature="ai_summarizer" title="AI Document Summarizer" description="AI-powered legal document summarization. Requires Professional plan.">
                    <AIDocumentSummarizer />
                  </GatedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/video-witness"
              element={
                <ProtectedRoute>
                  <GatedRoute feature="video_witness" title="Video Witness" description="Remote video notarization sessions. Requires Professional plan.">
                    <VideoWitness />
                  </GatedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/document-remediation"
              element={
                <ProtectedRoute>
                  <GatedRoute feature="doc_remediation" title="Document Remediation" description="AI-powered document remediation and compliance fixes. Requires Professional plan.">
                    <DocumentRemediation />
                  </GatedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/biometric-passport"
              element={
                <ProtectedRoute>
                  <GatedRoute feature="biometric_passport" title="Biometric Passport" description="Advanced biometric identity verification. Requires Professional plan.">
                    <BiometricPassportPage />
                  </GatedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/conductor/:transactionId"
              element={
                <ProtectedRoute>
                  <AIConductorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/evidence-package/:transactionId"
              element={
                <ProtectedRoute>
                  <EvidencePackagePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/timeline/:transactionId"
              element={
                <ProtectedRoute>
                  <TransactionTimeline />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reminders"
              element={
                <ProtectedRoute>
                  <RemindersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/approvals"
              element={
                <ProtectedRoute>
                  <ApprovalsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doc-compare"
              element={
                <ProtectedRoute>
                  <DocComparePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/branding"
              element={
                <ProtectedRoute>
                  <BrandingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ai-intelligence"
              element={
                <ProtectedRoute>
                  <GatedRoute feature="ai_intelligence_hub" title="AI Intelligence Hub" description="5 AI-powered features: Risk Scoring, Summarizer, Notary Matching, Fraud Detection, Voice Auth. Requires Enterprise plan.">
                    <AIIntelligenceHub />
                  </GatedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ceremony-replay/:ceremonyId"
              element={
                <ProtectedRoute>
                  <GatedRoute feature="ceremony_replay" title="Ceremony Replay" description="Step-by-step animated replay of past ceremony agent pipelines. Requires Professional plan.">
                    <CeremonyReplay />
                  </GatedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/multi-signature"
              element={
                <ProtectedRoute>
                  <GatedRoute feature="multi_signature" title="Multi-Signature Ceremonies" description="Support for 2-10 signers per ceremony with individual biometric verification. Requires Enterprise plan.">
                    <MultiSignature />
                  </GatedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/certificate-expiration"
              element={
                <ProtectedRoute>
                  <GatedRoute feature="certificate_expiration" title="Certificate Expiration" description="Set validity periods and track expiring certificates. Requires Professional plan.">
                    <CertificateExpiration />
                  </GatedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tokenized-escrow"
              element={
                <ProtectedRoute>
                  <GatedRoute feature="hts_tokens" title="HTS Tokenized Escrow" description="On-chain Hedera Token Service for tokenized escrow agreements. Requires Enterprise plan.">
                    <TokenizedEscrow />
                  </GatedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/pcv"
              element={
                <ProtectedRoute>
                  <PCVDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/pcv/verify/:packetId" element={<PCVPublicVerify />} />
            <Route
              path="/admin/batch-certificates"
              element={
                <ProtectedRoute>
                  <BatchCertificates />
                </ProtectedRoute>
              }
            />
          </Routes>
          </Suspense>
          <PlatformFooter />
        </BrowserRouter>
        </WebSocketProvider>
        </SubscriptionProvider>
        <Toaster />
      </AuthProvider>
    </div>
    </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;