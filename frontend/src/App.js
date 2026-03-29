import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { Toaster } from './components/ui/toaster';
import './i18n';

// Eager-loaded (critical path)
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';

// Lazy-loaded pages
const PricingPage = lazy(() => import('./pages/PricingPage'));
const QuickSealDemo = lazy(() => import('./pages/QuickSealDemo'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NotaryOnboarding = lazy(() => import('./pages/NotaryOnboarding'));
const NotaryDashboard = lazy(() => import('./pages/NotaryDashboard'));
const RequestNotarization = lazy(() => import('./pages/RequestNotarization'));
const VerifyDocument = lazy(() => import('./pages/VerifyDocument'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const CryptoCheckout = lazy(() => import('./pages/CryptoCheckout'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const PaymentCancel = lazy(() => import('./pages/PaymentCancel'));
const NotaryVideoSession = lazy(() => import('./pages/NotaryVideoSession'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
const TransactionRoom = lazy(() => import('./pages/TransactionRoom'));
const NotarizationCertificate = lazy(() => import('./pages/NotarizationCertificate'));
const BlueprintCreator = lazy(() => import('./pages/BlueprintCreator'));
const SecuritySettings = lazy(() => import('./pages/SecuritySettings'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'));
const SubscriptionSuccess = lazy(() => import('./pages/SubscriptionSuccess'));
const NotaryJournal = lazy(() => import('./pages/NotaryJournal'));
const DigitalSeal = lazy(() => import('./pages/DigitalSeal'));
const CompliancePage = lazy(() => import('./pages/CompliancePage'));
const DeveloperPage = lazy(() => import('./pages/DeveloperPage'));
const RONComplianceDashboard = lazy(() => import('./pages/RONComplianceDashboard'));
const TemplateLibrary = lazy(() => import('./pages/TemplateLibrary'));
const TemplateWizard = lazy(() => import('./pages/TemplateWizard'));
const OrganizationPage = lazy(() => import('./pages/OrganizationPage'));
const MyDrafts = lazy(() => import('./pages/MyDrafts'));
const SharedDraftViewer = lazy(() => import('./pages/SharedDraftViewer'));
const BulkNotarization = lazy(() => import('./pages/BulkNotarization'));
const NotaryMarketplace = lazy(() => import('./pages/NotaryMarketplace'));
const WhiteLabelPage = lazy(() => import('./pages/WhiteLabelPage'));
const BookingCalendar = lazy(() => import('./pages/BookingCalendar'));
const MyBookings = lazy(() => import('./pages/MyBookings'));
const AIDocumentGenerator = lazy(() => import('./pages/AIDocumentGenerator'));
const AIDocumentSummarizer = lazy(() => import('./pages/AIDocumentSummarizer'));
const VideoWitness = lazy(() => import('./pages/VideoWitness'));
const DocumentRemediation = lazy(() => import('./pages/DocumentRemediation'));
const BiometricPassportPage = lazy(() => import('./pages/BiometricPassportPage'));
const AIConductorPage = lazy(() => import('./pages/AIConductorPage'));
const EvidencePackagePage = lazy(() => import('./pages/EvidencePackagePage'));
const TransactionTimeline = lazy(() => import('./pages/TransactionTimeline'));
const RemindersPage = lazy(() => import('./pages/RemindersPage'));
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage'));
const DocComparePage = lazy(() => import('./pages/DocComparePage'));
const BrandingPage = lazy(() => import('./pages/BrandingPage'));
const SSOLoginPage = lazy(() => import('./pages/SSOLoginPage'));
const Auth0Callback = lazy(() => import('./pages/Auth0Callback'));
const OktaCallback = lazy(() => import('./pages/OktaCallback'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const InvestorDeck = lazy(() => import('./pages/InvestorDeck'));
const CeremonyDashboard = lazy(() => import('./pages/CeremonyDashboard'));
const VerifyCertificate = lazy(() => import('./pages/VerifyCertificate'));
const EscrowDashboard = lazy(() => import('./pages/EscrowDashboard'));

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
        <WebSocketProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/sso/login" element={<SSOLoginPage />} />
            <Route path="/auth/callback" element={<Auth0Callback />} />
            <Route path="/auth/okta/callback" element={<OktaCallback />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/demo" element={<QuickSealDemo />} />
            <Route path="/verify" element={<VerifyDocument />} />
            <Route path="/verify-certificate" element={<VerifyCertificate />} />
            <Route path="/verify-certificate/:certHash" element={<VerifyCertificate />} />
            <Route path="/investor-deck" element={<InvestorDeck />} />
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
                  <EscrowDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/escrow/:escrowId"
              element={
                <ProtectedRoute>
                  <EscrowDashboard />
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
                  <OrganizationPage />
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
                  <BulkNotarization />
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
                  <WhiteLabelPage />
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
                  <AIDocumentGenerator />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ai-summarizer"
              element={
                <ProtectedRoute>
                  <AIDocumentSummarizer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/video-witness"
              element={
                <ProtectedRoute>
                  <VideoWitness />
                </ProtectedRoute>
              }
            />
            <Route
              path="/document-remediation"
              element={
                <ProtectedRoute>
                  <DocumentRemediation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/biometric-passport"
              element={
                <ProtectedRoute>
                  <BiometricPassportPage />
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
          </Routes>
          </Suspense>
        </BrowserRouter>
        </WebSocketProvider>
        <Toaster />
      </AuthProvider>
    </div>
    </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;