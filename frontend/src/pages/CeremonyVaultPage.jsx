import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Video, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import CeremonyVideoVault from '../components/CeremonyVideoVault';

export default function CeremonyVaultPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-cream-100" data-testid="ceremony-vault-page">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <Breadcrumbs items={[{ label: 'Ceremony Video Vault' }]} />
            <Button variant="outline" onClick={() => navigate('/verify/recording')} className="border-slate-300 text-navy-800" data-testid="vault-verify-link-btn">
              <ShieldCheck className="w-4 h-4 mr-2" /> Verify a Recording
            </Button>
          </div>
          <header className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 flex items-center gap-2">
              <Video className="w-7 h-7 text-coral-500" /> Ceremony Video Vault
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Securely store RON recordings on AWS S3 and anchor a tamper-evident integrity proof on the Hedera blockchain.
            </p>
          </header>
          <CeremonyVideoVault />
        </div>
      </div>
      <Footer />
    </div>
  );
}
