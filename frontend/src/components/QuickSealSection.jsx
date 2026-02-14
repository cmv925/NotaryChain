import React from 'react';
import { Zap, Clock, DollarSign, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';

const QuickSealSection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-24 bg-gradient-to-br from-[#0f1825] via-[#1a2332] to-[#0f1825]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Content */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 rounded-full border border-yellow-500/30 mb-6">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 font-semibold text-sm">Instant Verification</span>
            </div>

            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Quick Seal™: Instant Blockchain Timestamps
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed mb-8">
              A low-cost, high-volume entry point for instant document timestamping. Prove a
              document's existence at a specific time without full notarization.
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Instant Processing</h4>
                  <p className="text-gray-400 text-sm">
                    Get your blockchain timestamp in seconds, not days
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Just $5 Per Seal</h4>
                  <p className="text-gray-400 text-sm">
                    Affordable pricing for high-volume needs
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Permanent Proof</h4>
                  <p className="text-gray-400 text-sm">
                    Immutable blockchain record that lasts forever
                  </p>
                </div>
              </div>
            </div>

            <Button 
              onClick={() => navigate('/demo')}
              className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 px-8 py-6 text-lg rounded-md transition-all shadow-lg shadow-yellow-500/30 font-semibold"
            >
              Try Quick Seal Now
              <Zap className="ml-2 w-5 h-5" />
            </Button>
          </div>

          {/* Right Side - Visual */}
          <div className="relative">
            <div className="bg-[#0a0f1a] border-2 border-yellow-500/30 rounded-2xl p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Quick Seal Process</h3>
                <span className="bg-yellow-500/20 text-yellow-400 text-xs font-semibold px-3 py-1 rounded-full">
                  &lt; 10 seconds
                </span>
              </div>

              <div className="space-y-4">
                <div className="bg-[#1a2332] rounded-lg p-4 border border-gray-800">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-400 font-bold text-sm">
                      1
                    </div>
                    <span className="text-white font-semibold">Upload Document</span>
                  </div>
                  <p className="text-gray-400 text-sm ml-11">Drop any file type</p>
                </div>

                <div className="bg-[#1a2332] rounded-lg p-4 border border-gray-800">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-400 font-bold text-sm">
                      2
                    </div>
                    <span className="text-white font-semibold">Generate Hash</span>
                  </div>
                  <p className="text-gray-400 text-sm ml-11">
                    SHA-256 fingerprint created
                  </p>
                </div>

                <div className="bg-[#1a2332] rounded-lg p-4 border border-gray-800">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-400 font-bold text-sm">
                      3
                    </div>
                    <span className="text-white font-semibold">Record on Hedera</span>
                  </div>
                  <p className="text-gray-400 text-sm ml-11">
                    Permanent blockchain timestamp
                  </p>
                </div>

                <div className="bg-gradient-to-r from-yellow-500/20 to-green-500/20 rounded-lg p-4 border border-yellow-500/50">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-400" />
                    <span className="text-white font-semibold">Instant Verification Link</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-800">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Cost per seal:</span>
                  <span className="text-2xl font-bold text-yellow-400">$5</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default QuickSealSection;