import React from 'react';
import { Upload, Brain, UserCheck, Lock, FolderLock } from 'lucide-react';

const processSteps = [
  {
    number: '1',
    icon: Upload,
    title: 'Document Upload',
    subtitle: 'SECURE UPLOAD',
    description:
      'A user securely uploads any document to the platform with end-to-end encryption.',
  },
  {
    number: '2',
    icon: Brain,
    title: 'AI Analysis',
    subtitle: 'GEMINI AI VERIFICATION',
    description:
      'Google Gemini AI verifies authenticity, detects fraud, and extracts key data for review.',
  },
  {
    number: '3',
    icon: UserCheck,
    title: 'Notary Review',
    subtitle: 'HUMAN VALIDATION',
    description:
      'A certified notary, assisted by an AI Co-pilot, validates the document and identity.',
  },
  {
    number: '4',
    icon: Lock,
    title: 'Blockchain Seal',
    subtitle: 'HEDERA LEDGER',
    description:
      "The document's unique hash is permanently recorded on the Hedera public ledger, creating a tamper-proof seal.",
  },
  {
    number: '5',
    icon: FolderLock,
    title: 'Secure Vault',
    subtitle: 'ENCRYPTED STORAGE',
    description:
      'The final, verified document is stored in an encrypted, accessible vault for all parties.',
  },
];

const ProcessStepsSection = () => {
  return (
    <section className="py-24 bg-gradient-to-br from-[#0f1825] via-white to-cream-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            From Document to Immutable Proof in Five Steps
          </h2>
          <p className="text-slate-500 text-lg max-w-3xl mx-auto">
            A seamless experience that is <span className="text-coral-500 font-semibold">70% Faster</span> with{' '}
            <span className="text-coral-500 font-semibold">10x Lower Fraud Risk</span>
          </p>
        </div>

        <div className="relative">
          {/* Connection Line - Desktop */}
          <div className="hidden lg:block absolute top-20 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-coral-500/30 to-transparent"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {processSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="relative">
                  <div className="bg-white border border-slate-200 rounded-xl p-6 hover:border-coral-300/50 transition-all duration-300 h-full group">
                    {/* Step Number Badge */}
                    <div className="flex justify-center mb-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-coral-500 to-blue-700 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-coral-500/50 group-hover:scale-110 transition-transform">
                        {step.number}
                      </div>
                    </div>

                    {/* Icon */}
                    <div className="flex justify-center mb-4">
                      <div className="w-14 h-14 bg-coral-500/10 rounded-lg flex items-center justify-center">
                        <Icon className="w-7 h-7 text-coral-500" />
                      </div>
                    </div>

                    {/* Subtitle Badge */}
                    <div className="flex justify-center mb-3">
                      <span className="text-xs font-semibold text-coral-500 bg-coral-500/10 px-3 py-1 rounded-full border border-coral-300/30">
                        {step.subtitle}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-semibold text-white mb-3 text-center">
                      {step.title}
                    </h3>

                    {/* Description */}
                    <p className="text-slate-500 text-sm leading-relaxed text-center">
                      {step.description}
                    </p>
                  </div>

                  {/* Connector Arrow - visible on larger screens between steps */}
                  {index < processSteps.length - 1 && (
                    <div className="hidden lg:block absolute top-20 -right-3 w-6 h-6 z-10">
                      <div className="w-0 h-0 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent border-l-[12px] border-l-blue-500/50"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProcessStepsSection;