import React from 'react';
import { Zap, Shield, Leaf, Cpu } from 'lucide-react';
import { Card, CardContent } from './ui/card';

const TechnologyStackSection = () => {
  return (
    <section className="py-24 bg-[#0a0f1a]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Our Unfair Advantage: The Synergy of AI Brain and Blockchain Body
          </h2>
          <p className="text-gray-400 text-lg max-w-3xl mx-auto">
            Powered by Google Gemini AI and Hedera Blockchain for unmatched trust and efficiency
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* AI Brain */}
          <Card className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-2 border-blue-500/50">
            <CardContent className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <Cpu className="w-8 h-8 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-white">AI - The Intelligent Brain</h3>
                  <p className="text-blue-300 text-sm">Powered by Google Gemini</p>
                </div>
              </div>
              <p className="text-gray-300 mb-6 leading-relaxed">
                Intelligence that automates, analyzes, and secures the entire workflow.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">
                      Intelligent Document Generation & Smart Fill
                    </h4>
                    <p className="text-gray-400 text-sm">
                      Create and auto-fill documents with conversational AI commands
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">
                      AI Notary Co-pilot
                    </h4>
                    <p className="text-gray-400 text-sm">
                      Visual highlights and inconsistency flagging for fraud detection
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">
                      Advanced Biometric Verification
                    </h4>
                    <p className="text-gray-400 text-sm">
                      Facial geometry analysis and liveness detection
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Blockchain Body */}
          <Card className="bg-gradient-to-br from-green-600/20 to-blue-600/20 border-2 border-green-500/50">
            <CardContent className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <Shield className="w-8 h-8 text-green-400" />
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-white">Blockchain - The Unbreakable Proof</h3>
                  <p className="text-green-300 text-sm">Built on Hedera Hashgraph</p>
                </div>
              </div>
              <p className="text-gray-300 mb-6 leading-relaxed">
                We record a unique 'fingerprint' (hash) of your document on a global, tamper-proof
                public ledger, making it verifiable by anyone, instantly, forever.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-white font-semibold mb-1">Decentralized Proofs</h4>
                    <p className="text-gray-400 text-sm">
                      No single point of failure or control
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-white font-semibold mb-1">Public Verification</h4>
                    <p className="text-gray-400 text-sm">
                      Anyone can verify the authenticity instantly
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Leaf className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-white font-semibold mb-1">
                      Carbon-Negative Network
                    </h4>
                    <p className="text-gray-400 text-sm">
                      Environmentally sustainable blockchain technology
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Three Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-600/10 to-blue-600/5 border border-blue-500/30 rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Cpu className="w-6 h-6 text-blue-400" />
            </div>
            <h4 className="text-xl font-bold text-white mb-2">Pillar 1: AI-Verified</h4>
            <p className="text-gray-400 text-sm">
              Advanced fraud detection and intelligent analysis
            </p>
          </div>
          <div className="bg-gradient-to-br from-green-600/10 to-green-600/5 border border-green-500/30 rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-6 h-6 text-green-400" />
            </div>
            <h4 className="text-xl font-bold text-white mb-2">Pillar 2: Blockchain-Secured</h4>
            <p className="text-gray-400 text-sm">
              Immutable proofs on Hedera's carbon-negative network
            </p>
          </div>
          <div className="bg-gradient-to-br from-purple-600/10 to-purple-600/5 border border-purple-500/30 rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserCheck className="w-6 h-6 text-purple-400" />
            </div>
            <h4 className="text-xl font-bold text-white mb-2">Pillar 3: Compliant by Design</h4>
            <p className="text-gray-400 text-sm">
              Built for RON requirements across all 50 states
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TechnologyStackSection;