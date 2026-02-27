import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from './ui/button';

const TOUR_KEY = 'nc_tour_completed';

const STEPS = [
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
    target: '[data-testid="biometric-passport-button"]',
    title: 'Biometric Passport',
    content: 'Generate tamper-proof identity credentials with multi-modal biometrics.',
    position: 'left',
  },
];

export function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) {
      const timer = setTimeout(() => setActive(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const el = document.querySelector(STEPS[step]?.target);
    if (el) {
      const rect = el.getBoundingClientRect();
      el.style.position = 'relative';
      el.style.zIndex = '10001';
      el.style.boxShadow = '0 0 0 4px rgba(0,212,170,0.3)';

      const tooltipW = 300;
      let top = rect.bottom + 12;
      let left = rect.left + rect.width / 2 - tooltipW / 2;

      if (STEPS[step].position === 'right') {
        top = rect.top;
        left = rect.right + 12;
      } else if (STEPS[step].position === 'left') {
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
  }, [active, step]);

  const close = () => {
    setActive(false);
    localStorage.setItem(TOUR_KEY, 'true');
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else close();
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!active) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 z-[10000]" onClick={close} />

      {/* Tooltip */}
      <div
        className="fixed z-[10002] w-[300px] bg-[#1a2332] border border-gray-700 rounded-xl shadow-2xl p-4"
        style={{ top: pos.top, left: pos.left }}
        data-testid="onboarding-tooltip"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-gray-500">{step + 1} of {STEPS.length}</span>
          <button onClick={close} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <h3 className="text-white font-semibold text-sm mb-1">{STEPS[step]?.title}</h3>
        <p className="text-gray-400 text-xs mb-3">{STEPS[step]?.content}</p>
        <div className="flex items-center justify-between">
          <button onClick={close} className="text-gray-500 text-xs hover:text-white">Skip tour</button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button size="sm" variant="ghost" onClick={prev} className="text-gray-400 h-7 px-2">
                <ChevronLeft className="w-3 h-3 mr-1" /> Back
              </Button>
            )}
            <Button size="sm" onClick={next} className="bg-[#00d4aa] hover:bg-[#00b894] text-black h-7 px-3">
              {step < STEPS.length - 1 ? <>Next <ChevronRight className="w-3 h-3 ml-1" /></> : 'Done'}
            </Button>
          </div>
        </div>
        {/* Progress dots */}
        <div className="flex justify-center gap-1 mt-3">
          {STEPS.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === step ? 'bg-[#00d4aa]' : 'bg-gray-700'}`} />
          ))}
        </div>
      </div>
    </>
  );
}

export function resetOnboarding() {
  localStorage.removeItem(TOUR_KEY);
}
