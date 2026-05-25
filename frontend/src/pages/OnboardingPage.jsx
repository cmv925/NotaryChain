import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  FileText, Shield, Users, ArrowRight, CheckCircle,
  Cpu, Video, Fingerprint, ChevronRight, Sparkles
} from 'lucide-react';
import { Button } from '../components/ui/button';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to NotaryChain',
    subtitle: 'Let\'s set up your account in under 2 minutes',
    icon: Sparkles,
    color: 'blue',
  },
  {
    id: 'role',
    title: 'What brings you here?',
    subtitle: 'This helps us personalize your experience',
    icon: Users,
    color: 'purple',
    options: [
      { value: 'individual', label: 'Individual', desc: 'Notarize personal documents', icon: FileText },
      { value: 'business', label: 'Business', desc: 'Enterprise notarization workflows', icon: Shield },
      { value: 'notary', label: 'Notary Professional', desc: 'Offer notary services', icon: Video },
    ],
  },
  {
    id: 'features',
    title: 'Key features for you',
    subtitle: 'Here\'s what you can do right away',
    icon: Cpu,
    color: 'cyan',
  },
  {
    id: 'complete',
    title: 'You\'re all set!',
    subtitle: 'Start using NotaryChain now',
    icon: CheckCircle,
    color: 'emerald',
  },
];

const FEATURE_MAP = {
  individual: [
    { title: 'Quick Seal Demo', desc: 'Instantly seal any document with blockchain proof', path: '/demo', icon: Shield },
    { title: 'AI Document Analysis', desc: 'Upload documents for AI-powered insights', path: '/ai-summarizer', icon: Cpu },
    { title: 'Request Notarization', desc: 'Connect with a certified notary via video', path: '/request-notarization', icon: Video },
    { title: 'Biometric Passport', desc: 'Verify your identity with biometric scans', path: '/biometric-passport', icon: Fingerprint },
  ],
  business: [
    { title: 'Organization Setup', desc: 'Create your team workspace with RBAC', path: '/organizations', icon: Users },
    { title: 'Bulk Notarization', desc: 'Process multiple documents at once', path: '/bulk-notarization', icon: FileText },
    { title: 'Template Library', desc: 'Build reusable document templates', path: '/templates', icon: FileText },
    { title: 'AI Document Generator', desc: 'Generate legal documents with AI', path: '/ai-generator', icon: Cpu },
  ],
  notary: [
    { title: 'Notary Onboarding', desc: 'Complete your notary certification', path: '/notary/onboarding', icon: Shield },
    { title: 'Marketplace Profile', desc: 'List your services for clients', path: '/marketplace', icon: Users },
    { title: 'Digital Seal', desc: 'Create your official notary seal', path: '/notary/seal', icon: Shield },
    { title: 'Notary Journal', desc: 'Track all notarization sessions', path: '/notary/journal', icon: FileText },
  ],
};

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [step, setStep] = useState(0);
  const [selectedRole, setSelectedRole] = useState('individual');

  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  const currentStep = STEPS[step];
  const features = FEATURE_MAP[selectedRole] || FEATURE_MAP.individual;

  const handleComplete = async () => {
    try {
      await axios.patch(`${API}/api/auth/profile`, { onboarding_completed: true }, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4" data-testid="onboarding-page">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                i < step ? 'bg-coral-500 text-navy-900' :
                i === step ? 'bg-coral-500 text-navy-900 ring-4 ring-blue-600/20' :
                'bg-navy-800 text-slate-500'
              }`}>
                {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-12 h-0.5 ${i < step ? 'bg-coral-500' : 'bg-navy-800'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-2xl shadow-black/30">
          <div className="text-center mb-8">
            <div className={`w-14 h-14 rounded-xl bg-${currentStep.color}-500/10 flex items-center justify-center mx-auto mb-4`}>
              <currentStep.icon className={`w-7 h-7 text-${currentStep.color}-400`} />
            </div>
            <h2 className="text-2xl font-bold text-navy-900 mb-2">{currentStep.title}</h2>
            <p className="text-slate-500">{currentStep.subtitle}</p>
          </div>

          {/* Step: Welcome */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { icon: Shield, label: 'Blockchain Sealed', color: 'cyan' },
                  { icon: Cpu, label: 'AI Powered', color: 'purple' },
                  { icon: Fingerprint, label: 'Biometric ID', color: 'emerald' },
                ].map((f, i) => (
                  <div key={i} className="bg-cream-100 rounded-xl p-4 text-center border border-slate-200">
                    <f.icon className={`w-6 h-6 text-${f.color}-400 mx-auto mb-2`} />
                    <p className="text-slate-500 text-sm">{f.label}</p>
                  </div>
                ))}
              </div>
              <Button onClick={() => setStep(1)} className="w-full bg-coral-500 hover:bg-coral-500 py-5 text-base" data-testid="onboarding-next-btn">
                Let's Get Started <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          )}

          {/* Step: Role selection */}
          {step === 1 && (
            <div className="space-y-3">
              {STEPS[1].options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedRole(opt.value)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                    selectedRole === opt.value
                      ? 'border-coral-300 bg-coral-500/10'
                      : 'border-slate-200 bg-cream-100 hover:border-slate-200'
                  }`}
                  data-testid={`role-${opt.value}`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedRole === opt.value ? 'bg-coral-500/20' : 'bg-navy-800'}`}>
                    <opt.icon className={`w-5 h-5 ${selectedRole === opt.value ? 'text-coral-500' : 'text-slate-500'}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-navy-900 font-medium">{opt.label}</p>
                    <p className="text-slate-500 text-sm">{opt.desc}</p>
                  </div>
                  {selectedRole === opt.value && <CheckCircle className="w-5 h-5 text-coral-500" />}
                </button>
              ))}
              <Button onClick={() => setStep(2)} className="w-full bg-coral-500 hover:bg-coral-500 py-5 text-base mt-4" data-testid="onboarding-continue-btn">
                Continue <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          )}

          {/* Step: Features */}
          {step === 2 && (
            <div className="space-y-3">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-cream-100">
                  <div className="w-10 h-10 rounded-lg bg-coral-500/10 flex items-center justify-center flex-shrink-0">
                    <f.icon className="w-5 h-5 text-coral-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-navy-900 font-medium text-sm">{f.title}</p>
                    <p className="text-slate-500 text-xs">{f.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                </div>
              ))}
              <Button onClick={() => setStep(3)} className="w-full bg-coral-500 hover:bg-coral-500 py-5 text-base mt-4">
                Almost Done <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          )}

          {/* Step: Complete */}
          {step === 3 && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-coral-500/10 flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-coral-600" />
              </div>
              <p className="text-slate-500">Your workspace is ready. Jump into your dashboard or explore a feature.</p>
              <div className="grid grid-cols-2 gap-3">
                {features.slice(0, 2).map((f, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(f.path)}
                    className="p-4 rounded-xl border border-slate-200 bg-cream-100 hover:border-coral-300/50 transition-all text-left"
                  >
                    <f.icon className="w-5 h-5 text-coral-500 mb-2" />
                    <p className="text-navy-900 text-sm font-medium">{f.title}</p>
                    <p className="text-slate-500 text-xs mt-1">{f.desc}</p>
                  </button>
                ))}
              </div>
              <Button onClick={handleComplete} className="w-full bg-coral-500 hover:bg-coral-500 py-5 text-base" data-testid="onboarding-go-dashboard">
                Go to Dashboard <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
