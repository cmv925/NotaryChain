import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import PricingPage from './pages/PricingPage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import QuickSealDemo from './pages/QuickSealDemo';
import Dashboard from './pages/Dashboard';
import NotaryOnboarding from './pages/NotaryOnboarding';
import NotaryDashboard from './pages/NotaryDashboard';
import RequestNotarization from './pages/RequestNotarization';
import VerifyDocument from './pages/VerifyDocument';
import CheckoutPage from './pages/CheckoutPage';
import CryptoCheckout from './pages/CryptoCheckout';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentCancel from './pages/PaymentCancel';
import NotaryVideoSession from './pages/NotaryVideoSession';
import AdminDashboard from './pages/AdminDashboard';
import TransactionsPage from './pages/TransactionsPage';
import TransactionRoom from './pages/TransactionRoom';
import NotarizationCertificate from './pages/NotarizationCertificate';
import BlueprintCreator from './pages/BlueprintCreator';
import SecuritySettings from './pages/SecuritySettings';
import SubscriptionPage from './pages/SubscriptionPage';
import SubscriptionSuccess from './pages/SubscriptionSuccess';
import NotaryJournal from './pages/NotaryJournal';
import DigitalSeal from './pages/DigitalSeal';
import CompliancePage from './pages/CompliancePage';
import DeveloperPage from './pages/DeveloperPage';
import RONComplianceDashboard from './pages/RONComplianceDashboard';
import TemplateLibrary from './pages/TemplateLibrary';
import TemplateWizard from './pages/TemplateWizard';
import OrganizationPage from './pages/OrganizationPage';
import MyDrafts from './pages/MyDrafts';
import SharedDraftViewer from './pages/SharedDraftViewer';
import BulkNotarization from './pages/BulkNotarization';
import NotaryMarketplace from './pages/NotaryMarketplace';
import WhiteLabelPage from './pages/WhiteLabelPage';
import ErrorBoundary from './components/ErrorBoundary';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { Toaster } from './components/ui/toaster';

function App() {
  return (
    <ErrorBoundary>
    <div className="App">
      <AuthProvider>
        <WebSocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/demo" element={<QuickSealDemo />} />
            <Route path="/verify" element={<VerifyDocument />} />
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
          </Routes>
        </BrowserRouter>
        </WebSocketProvider>
        <Toaster />
      </AuthProvider>
    </div>
    </ErrorBoundary>
  );
}

export default App;