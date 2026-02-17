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
import { Toaster } from './components/ui/toaster';

function App() {
  return (
    <div className="App">
      <AuthProvider>
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
          </Routes>
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </div>
  );
}

export default App;