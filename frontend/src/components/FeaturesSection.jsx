import React from 'react';
import { Sparkles, Fingerprint, Shield, Video } from 'lucide-react';
import { Card, CardContent } from './ui/card';

const features = [
  {
    icon: Sparkles,
    title: 'AI Document Suite™',
    description:
      'Draft legal documents from simple descriptions or a guided AI video interview.',
  },
  {
    icon: Fingerprint,
    title: 'Biometric Verification',
    description:
      'Go beyond visual checks with AI-powered facial geometry analysis and voiceprinting for fraud-proof identity verification.',
  },
  {
    icon: Shield,
    title: 'Blockchain Security',
    description:
      'Each notarized document is hashed on the blockchain, creating a permanent, tamper-proof record.',
  },
  {
    icon: Video,
    title: 'Live & Recorded Sessions',
    description:
      'Conduct fully compliant Remote Online Notarizations (RON) with secure session recording for a complete audit trail.',
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 bg-cream-100">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-4xl md:text-5xl font-bold text-white text-center mb-4">
          A Smarter Way to Notarize
        </h2>
        <p className="text-slate-500 text-center mb-16 text-lg">
          Go beyond simple e-signatures with a suite of intelligent tools.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card
                key={index}
                className="bg-gradient-to-br from-white to-cream-100 border border-slate-200 hover:border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 group"
              >
                <CardContent className="p-6">
                  <div className="mb-4">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                      <Icon className="w-6 h-6 text-blue-500" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-slate-500 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;