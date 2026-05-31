import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Anchor, History } from 'lucide-react';
import { Button } from '../components/ui/button';
import SmartContractTemplates from '../components/SmartContractTemplates';

export default function SmartContractsPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-cream-100" data-testid="smart-contracts-page">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <Breadcrumbs items={[{ label: 'Smart Contract Templates' }]} />
            <Button
              variant="outline"
              onClick={() => navigate('/my-anchors')}
              className="border-slate-300 text-navy-800"
              data-testid="my-anchors-link"
            >
              <History className="w-4 h-4 mr-2" /> My Anchored Agreements
            </Button>
          </div>

          <header className="text-center mb-8 sm:mb-10">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-navy-900 mb-4">
              <Anchor className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold text-navy-900 mb-2 sm:mb-3">
              Smart Contract Template Library
            </h1>
            <p className="text-slate-500 text-sm sm:text-base max-w-xl mx-auto">
              Generate a standard legal agreement, tailor it with AI, and anchor an immutable,
              timestamped proof directly on the Hedera blockchain.
            </p>
          </header>

          <SmartContractTemplates />
        </div>
      </div>
      <Footer />
    </div>
  );
}
