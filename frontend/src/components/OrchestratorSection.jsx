import React from 'react';
import { Button } from './ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const OrchestratorSection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-24 bg-cream-100">
      <div className="max-w-5xl mx-auto px-6">
        <div className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-blue-500/30 rounded-2xl p-12 text-center relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute w-64 h-64 bg-blue-500/20 rounded-full blur-3xl -top-20 -left-20"></div>
            <div className="absolute w-64 h-64 bg-purple-500/20 rounded-full blur-3xl -bottom-20 -right-20"></div>
          </div>

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 rounded-full border border-blue-500/40 mb-6">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 font-semibold text-sm">
                The Future of NotaryChain™
              </span>
            </div>

            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Introducing the AI Transaction Orchestrator™
            </h2>
            <p className="text-slate-500 text-lg leading-relaxed mb-8 max-w-3xl mx-auto">
              NotaryChain™ is evolving beyond document notarization to become a platform that
              manages entire complex transactions. Define rules, dependencies, and parties, and
              let our AI conductor orchestrate the whole process—from initial drafting and
              biometric verification to final blockchain settlement. This is the future of
              automated, high-trust agreements.
            </p>
            <Button
              onClick={() => navigate('/pricing')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg rounded-md transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 group"
            >
              Learn About Enterprise
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OrchestratorSection;