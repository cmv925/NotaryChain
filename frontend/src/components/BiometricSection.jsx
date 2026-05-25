import React from 'react';
import { Scan, Mic, Eye, ShieldAlert, CheckCircle2 } from 'lucide-react';

const biometricSteps = [
  {
    number: '1',
    icon: Scan,
    title: 'Facial Geometry Analysis',
    description:
      'AI creates a 3D facial map from video and matches it against the photo ID to detect digital alterations and deepfakes.',
  },
  {
    number: '2',
    icon: Mic,
    title: 'Voiceprinting',
    description:
      'A unique vocal signature is created and stored as a secure biometric identifier for future verification.',
  },
  {
    number: '3',
    icon: Eye,
    title: 'Liveness & Forgery Detection',
    description:
      'The AI analyzes video for subtle cues to ensure it\'s interacting with a live human, not a recording or mask.',
  },
];

const benefits = [
  {
    icon: ShieldAlert,
    title: 'Fraud & Deepfake Resistant',
    description:
      'Our AI cross-references the 3D facial map from a live video with the 2D ID photo, catching forgeries the human eye can\'t.',
  },
  {
    icon: CheckCircle2,
    title: 'KYC & AML Compliance',
    description:
      'Meet and exceed the strictest identity verification standards for financial and legal industries automatically.',
  },
];

const BiometricSection = () => {
  return (
    <section className="py-24 bg-gradient-to-br from-[#0f1825] via-white to-cream-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left Side - Steps */}
          <div>
            <div className="inline-block px-4 py-2 bg-coral-500/10 rounded-full border border-coral-300/30 mb-4">
              <span className="text-coral-500 font-semibold">Unbreakable Identity</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Go Beyond Visual Checks. Prove Identity.
            </h2>
            <p className="text-slate-500 text-lg mb-12">
              In an era of deepfakes, simply looking at an ID on a webcam is not enough.
              NotaryChain's™ AI synthesizes facial geometry, voiceprints, and liveness
              detection to create a biometric identity so secure, it can be defended in court.
            </p>

            <div className="space-y-6">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <div key={index} className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-coral-500/10 rounded-lg flex items-center justify-center">
                        <Icon className="w-6 h-6 text-coral-500" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-white mb-2">
                        {benefit.title}
                      </h4>
                      <p className="text-slate-500 leading-relaxed">{benefit.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Side - Biometric Steps */}
          <div>
            <div className="bg-cream-100 border border-slate-200 rounded-xl p-8">
              <h3 className="text-2xl font-bold text-white mb-8 text-center">
                Advanced Biometric Verification
              </h3>
              <div className="space-y-8">
                {biometricSteps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <div key={index} className="relative">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-coral-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-coral-500/50">
                            {step.number}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Icon className="w-5 h-5 text-coral-500" />
                            <h4 className="text-lg font-semibold text-white">{step.title}</h4>
                          </div>
                          <p className="text-slate-500 text-sm leading-relaxed">
                            {step.description}
                          </p>
                        </div>
                      </div>
                      {index < biometricSteps.length - 1 && (
                        <div className="ml-6 mt-4 h-8 w-0.5 bg-gradient-to-b from-coral-500 to-transparent"></div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-8 pt-8 border-t border-slate-200">
                <p className="text-slate-500 text-center text-sm">
                  This multi-modal approach creates a forensic-grade identity verification that
                  is nearly impossible to forge.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BiometricSection;