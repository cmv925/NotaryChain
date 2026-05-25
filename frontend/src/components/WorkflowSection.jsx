import React from 'react';
import { FileText, Users, Shield as ShieldCheck, Lock } from 'lucide-react';

const steps = [
  {
    number: '1',
    icon: FileText,
    title: 'Define Workflow',
    description:
      'Define all parties, documents, and dependencies in a simple Transaction Blueprint. The AI Orchestrator™ takes it from there.',
  },
  {
    number: '2',
    icon: Users,
    title: 'AI-Guided Execution',
    description:
      'The AI invites each party at the right time and guides them through video interviews, smart filling, and e-signing.',
  },
  {
    number: '3',
    icon: ShieldCheck,
    title: 'Automated Notary Review',
    description:
      'Once all steps are complete, the entire package—documents, evidence, and video—is queued for a certified notary.',
  },
  {
    number: '4',
    icon: Lock,
    title: 'Blockchain Settlement',
    description:
      'Upon final approval, all documents are sealed, hashed on the blockchain, and post-notarization actions are triggered.',
  },
];

const WorkflowSection = () => {
  return (
    <section className="py-24 bg-cream-100">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-4xl md:text-5xl font-bold text-white text-center mb-4">
          The Future of Secure Transactions
        </h2>
        <p className="text-slate-500 text-center mb-16 text-lg max-w-3xl mx-auto">
          An automated, end-to-end workflow for complex agreements.
        </p>

        <div className="relative">
          {/* Connection Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-coral-500/0 via-coral-500/50 to-coral-500/0 transform -translate-y-1/2"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="relative">
                  <div className="bg-gradient-to-br from-white to-cream-100 border border-slate-200 rounded-lg p-6 hover:border-coral-300/50 transition-all duration-300 group">
                    {/* Step Number */}
                    <div className="absolute -top-4 left-6">
                      <div className="w-12 h-12 bg-coral-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-coral-500/50">
                        {step.number}
                      </div>
                    </div>

                    <div className="mt-8">
                      <Icon className="w-10 h-10 text-coral-500 mb-4 group-hover:scale-110 transition-transform" />
                      <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
                      <p className="text-slate-500 leading-relaxed text-sm">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default WorkflowSection;