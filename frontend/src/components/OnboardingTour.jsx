import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from './ui/button';

const TOUR_KEY = 'nc_tour_completed';

const ADMIN_STEPS = [
  {
    target: '[data-testid="notification-bell"]',
    title: 'Notifications',
    content: 'Monitor platform-wide alerts, escalations, and system events.',
    position: 'bottom',
  },
  {
    target: '[data-testid="bento-anan"]',
    title: 'ANAN Network',
    content: 'The Autonomous Notary Agent Network — manage AI agent swarms, bond health, and escalation queues.',
    position: 'bottom',
  },
  {
    target: '[data-testid="bento-fraud"]',
    title: 'Fraud Intelligence',
    content: 'Configure threat patterns and RON jurisdiction rules that feed into ANAN agent analysis.',
    position: 'bottom',
  },
  {
    target: '[data-testid="bento-escrow"]',
    title: 'Escrow Intelligence',
    content: 'AI-powered smart escrow management with GPT-5.2 contract parsing.',
    position: 'bottom',
  },
  {
    target: '[data-testid="bento-analytics"]',
    title: 'Analytics & Operations',
    content: 'Platform analytics, security compliance, service health, and ops monitoring.',
    position: 'right',
  },
];

const NOTARY_STEPS = [
  {
    target: '[data-testid="notification-bell"]',
    title: 'Notifications',
    content: 'Get alerts for new booking requests, ceremony escalations, and approvals.',
    position: 'bottom',
  },
  {
    target: '[data-testid="upload-document-button"]',
    title: 'Upload Documents',
    content: 'Upload documents for AI analysis, notarization, or blockchain sealing.',
    position: 'bottom',
  },
  {
    target: '[data-testid="bento-anan"]',
    title: 'ANAN Ceremonies',
    content: 'Run AI-powered autonomous notarization ceremonies and resolve escalations.',
    position: 'bottom',
  },
  {
    target: '[data-testid="ai-generator-button"]',
    title: 'AI Document Generator',
    content: 'Create legal documents from natural language descriptions using AI.',
    position: 'right',
  },
  {
    target: '[data-testid="biometric-passport-button"]',
    title: 'Biometric Passport',
    content: 'Generate tamper-proof identity credentials with multi-modal biometrics.',
    position: 'left',
  },
];

const USER_STEPS = [
  {
    target: '[data-testid="notification-bell"]',
    title: 'Notifications',
    content: 'Stay updated with real-time alerts for tasks, approvals, and bookings.',
    position: 'bottom',
  },
  {
    target: '[data-testid="upload-document-button"]',
    title: 'Upload Documents',
    content: 'Upload documents for AI analysis, notarization, or blockchain sealing.',
    position: 'bottom',
  },
  {
    target: '[data-testid="ai-generator-button"]',
    title: 'AI Document Generator',
    content: 'Create legal documents from natural language descriptions using AI.',
    position: 'right',
  },
  {
    target: '[data-testid="doc-remediation-button"]',
    title: 'Document Remediation',
    content: 'AI scans your documents for missing clauses and helps fix them.',
    position: 'right',
  },
  {
    target: '[data-testid="bento-escrow"]',
    title: 'Escrow Intelligence',
    content: 'AI-powered escrow for contracts — automated condition verification and settlement.',
    position: 'bottom',
  },
];

function getStepsForRole(role) {
  if (role === 'admin') return ADMIN_STEPS;
  if (role === 'notary') return NOTARY_STEPS;
  return USER_STEPS;
}

export function OnboardingTour({ userRole }) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const steps = getStepsForRole(userRole);

  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) {
      const timer = setTimeout(() => setActive(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const el = document.querySelector(steps[step]?.target);
    if (el) {
      const rect = el.getBoundingClientRect();
      el.style.position = 'relative';
      el.style.zIndex = '10001';
      el.style.boxShadow = '0 0 0 4px rgba(0,212,170,0.3)';

      const tooltipW = 300;
      let top = rect.bottom + 12;
      let left = rect.left + rect.width / 2 - tooltipW / 2;

      if (steps[step].position === 'right') {
        top = rect.top;
        left = rect.right + 12;
      } else if (steps[step].position === 'left') {
        top = rect.top;
        left = rect.left - tooltipW - 12;
      }

      left = Math.max(12, Math.min(left, window.innerWidth - tooltipW - 12));
      top = Math.max(12, top);

      setPos({ top, left });

      return () => {
        el.style.position = '';
        el.style.zIndex = '';
        el.style.boxShadow = '';
      };
    }
  }, [active, step, steps]);

  const close = () => {
    setActive(false);
    localStorage.setItem(TOUR_KEY, 'true');
  };

  const next = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else close();
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!active) return null;

  const roleLabel = userRole === 'admin' ? 'Admin' : userRole === 'notary' ? 'Notary' : 'User';

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[10000]" onClick={close} data-testid="onboarding-overlay" />

      <div
        className="fixed z-[10002] w-[300px] bg-white border border-slate-200 rounded-xl shadow-2xl p-4"
        style={{ top: pos.top, left: pos.left }}
        data-testid="onboarding-tooltip"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500">{step + 1} of {steps.length}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-coral-500/10 text-coral-500 border border-coral-300/20 font-bold" data-testid="onboarding-role-badge">{roleLabel} Tour</span>
          </div>
          <button onClick={close} className="text-slate-500 hover:text-white" data-testid="onboarding-close-btn"><X className="w-4 h-4" /></button>
        </div>
        <h3 className="text-white font-semibold text-sm mb-1">{steps[step]?.title}</h3>
        <p className="text-slate-500 text-xs mb-3">{steps[step]?.content}</p>
        <div className="flex items-center justify-between">
          <button onClick={close} className="text-slate-500 text-xs hover:text-white" data-testid="onboarding-skip-btn">Skip tour</button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button size="sm" variant="ghost" onClick={prev} className="text-slate-500 h-7 px-2" data-testid="onboarding-prev-btn">
                <ChevronLeft className="w-3 h-3 mr-1" /> Back
              </Button>
            )}
            <Button size="sm" onClick={next} className="bg-coral-500 hover:bg-coral-600 text-black h-7 px-3" data-testid="onboarding-next-btn">
              {step < steps.length - 1 ? <>Next <ChevronRight className="w-3 h-3 ml-1" /></> : 'Done'}
            </Button>
          </div>
        </div>
        <div className="flex justify-center gap-1 mt-3">
          {steps.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === step ? 'bg-coral-500' : 'bg-gray-700'}`} />
          ))}
        </div>
      </div>
    </>
  );
}

export function resetOnboarding() {
  localStorage.removeItem(TOUR_KEY);
}
