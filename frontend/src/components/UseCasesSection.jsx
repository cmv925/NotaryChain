import React from 'react';
import { Lightbulb, Building2, GraduationCap, FileCheck, Home, Briefcase } from 'lucide-react';
import { Card, CardContent } from './ui/card';

const useCases = [
  {
    icon: Lightbulb,
    title: 'Intellectual Property Timestamping',
    description:
      "Establish a 'poor man\'s copyright' by hashing manuscripts, song files, or designs to prove they existed on a specific date and time.",
    industries: ['Creative', 'Tech Startups', 'Inventors'],
  },
  {
    icon: Home,
    title: 'Real Estate & HOA Documents',
    description:
      'Provide immutable records for leases, addendums, estoppel letters, and architectural requests. Prevents the "I never signed that" dispute forever.',
    industries: ['Real Estate', 'Property Management', 'HOAs'],
  },
  {
    icon: GraduationCap,
    title: 'Academic & Credential Verification',
    description:
      'Partner with institutions to verify student identities before issuing fraud-proof digital diplomas and certificates on the blockchain.',
    industries: ['Universities', 'Training Centers', 'Certification Bodies'],
  },
  {
    icon: FileCheck,
    title: 'Corporate Audits & Compliance',
    description:
      'Offer businesses audit-ready contract records with instantly verifiable hashes, saving them time and legal fees.',
    industries: ['Enterprises', 'Financial Services', 'Legal Firms'],
  },
  {
    icon: Building2,
    title: 'Government & Public Records',
    description:
      'Secure public documents, permits, and official records with blockchain verification for complete transparency and accountability.',
    industries: ['Government', 'Public Sector', 'Municipalities'],
  },
  {
    icon: Briefcase,
    title: 'Smart Contract Automation',
    description:
      'Automate escrow payments and business workflows with self-executing smart contracts. Get paid instantly when notarization is complete.',
    industries: ['Finance', 'Legal', 'Business Services'],
  },
];

const UseCasesSection = () => {
  return (
    <section className="py-24 bg-cream-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Beyond Traditional Notarization
          </h2>
          <p className="text-slate-500 text-lg max-w-3xl mx-auto">
            Unlock new revenue streams and serve diverse industries with blockchain-powered
            digital trust services
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {useCases.map((useCase, index) => {
            const Icon = useCase.icon;
            return (
              <Card
                key={index}
                className="bg-gradient-to-br from-white to-cream-100 border border-slate-200 hover:border-coral-300/50 transition-all duration-300 hover:shadow-lg hover:shadow-coral-500/10 group"
              >
                <CardContent className="p-6">
                  <div className="mb-4">
                    <div className="w-14 h-14 bg-coral-500/10 rounded-xl flex items-center justify-center group-hover:bg-coral-500/20 transition-colors">
                      <Icon className="w-7 h-7 text-coral-500" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">{useCase.title}</h3>
                  <p className="text-slate-500 leading-relaxed mb-4 text-sm">
                    {useCase.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {useCase.industries.map((industry, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-coral-500/10 text-coral-500 px-3 py-1 rounded-full border border-coral-300/30"
                      >
                        {industry}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-coral-500/20 to-navy-700/20 border border-coral-300/30 rounded-2xl p-8 inline-block">
            <h3 className="text-2xl font-bold text-white mb-3">
              Ready to Expand Your Services?
            </h3>
            <p className="text-slate-500 mb-6 max-w-2xl">
              Join thousands of professionals who are transforming their notary practice with
              blockchain technology
            </p>
            <button className="bg-coral-500 hover:bg-coral-600 text-white px-8 py-3 rounded-lg font-semibold transition-all shadow-lg shadow-coral-500/30">
              Schedule a Demo
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default UseCasesSection;