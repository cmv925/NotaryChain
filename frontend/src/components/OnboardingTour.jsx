import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from './ui/button';
import { emitTelemetry } from '../hooks/useDashboardTelemetry';

// ─── Portal-bound Onboarding Tours ───
// Each portal gets its own 3-step hotspots tour and its own localStorage key,
// so a notary toggling into the Command Authority Suite still sees its tour
// the first time, and vice-versa.

const TOUR_KEYS = {
  command_authority: 'nc_tour_command_authority_v1',
  assurance: 'nc_tour_assurance_v1',
  client_sovereign: 'nc_tour_client_sovereign_v1',
};

const PORTAL_LABELS = {
  command_authority: 'Command Authority Suite',
  assurance: 'Assurance Portal',
  client_sovereign: 'Client Sovereign Hub',
};

const PORTAL_STEPS = {
  command_authority: [
    {
      target: '[data-testid="admin-stats-grid"]',
      title: 'Pulse of the Network',
      content: 'Live KPIs across users, notaries, ceremonies, revenue, and pending approvals — streamed in real time via WebSocket.',
      position: 'bottom',
    },
    {
      target: '[data-testid="admin-tabs-nav"]',
      title: 'Operate Every Layer',
      content: 'Drill into Operations, Security, Analytics, Users, Notaries, and Audit Logs from a single command console.',
      position: 'bottom',
    },
    {
      target: '[data-testid="header-blueprint-btn"]',
      title: 'Author the Blueprint',
      content: 'Spin up new ceremony, escrow, or compliance workflows without leaving the suite.',
      position: 'left',
    },
  ],
  assurance: [
    {
      target: '[data-testid="notary-stats-grid"]',
      title: 'Your Earnings & Pipeline',
      content: 'Today\'s revenue, in-progress ceremonies, and lifetime impact — all at a glance.',
      position: 'bottom',
    },
    {
      target: '[data-testid="notary-tabs-nav"]',
      title: 'Pick Up & Run Sessions',
      content: 'Available queue, your assigned requests, ceremony history, and your live availability — all in one place.',
      position: 'bottom',
    },
    {
      target: '[data-testid="run-copilot-btn"]',
      title: 'AI Copilot Pre-Brief',
      content: 'Let Copilot surface risks, missing clauses, and signer red-flags before you greet the next signer.',
      position: 'left',
    },
  ],
  client_sovereign: [
    {
      target: '[data-testid="core-actions"]',
      title: 'Get Notarized, Fast',
      content: 'Quick Seal for blockchain timestamps, full notarization, or bulk processing — one click to start.',
      position: 'right',
    },
    {
      target: '[data-testid="ai-section"]',
      title: 'AI on Your Side',
      content: 'Generate, summarize, and compare legal documents with built-in AI — no legal background required.',
      position: 'bottom',
    },
    {
      target: '[data-testid="my-vault-section"]',
      title: 'Your Sovereign Vault',
      content: 'An encrypted home for deeds, wills, beneficiaries, and renewal reminders — yours, forever.',
      position: 'left',
    },
  ],
};

// Map legacy `userRole` prop to the right portal so existing call sites keep working.
function roleToPortal(role) {
  if (role === 'admin') return 'command_authority';
  if (role === 'notary') return 'assurance';
  return 'client_sovereign';
}

export function OnboardingTour({ portal, userRole }) {
  const resolvedPortal = portal || roleToPortal(userRole);
  const steps = PORTAL_STEPS[resolvedPortal] || PORTAL_STEPS.client_sovereign;
  const storageKey = TOUR_KEYS[resolvedPortal];

  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!storageKey) return;
    const done = localStorage.getItem(storageKey);
    if (done) return;
    // Delay so the destination page has time to render its targets.
    const timer = setTimeout(() => {
      // Only activate if at least the first target is present.
      if (document.querySelector(steps[0]?.target)) {
        setActive(true);
        setStep(0);
        try {
          if (typeof emitTelemetry === 'function') {
            emitTelemetry({
              surface: 'tour',
              action: 'tour_started',
              meta: { portal: resolvedPortal, total_steps: steps.length },
            });
          }
        } catch { /* silent */ }
      } else {
        // Quietly mark as completed if portal has no anchors so we don't loop.
        // Next visit can re-attempt after we ship those anchors.
      }
    }, 1200);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only first-visit check; storageKey/steps are stable for portal
  }, [storageKey]);

  useEffect(() => {
    if (!active) return;
    const el = document.querySelector(steps[step]?.target);
    if (!el) {
      // Target missing — skip to next step gracefully.
      if (step < steps.length - 1) setStep(step + 1);
      else closeTour();
      return;
    }
    try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch {}
    const rect = el.getBoundingClientRect();
    const prevPosition = el.style.position;
    const prevZIndex = el.style.zIndex;
    const prevShadow = el.style.boxShadow;
    const prevRadius = el.style.borderRadius;
    el.style.position = 'relative';
    el.style.zIndex = '10001';
    el.style.boxShadow = '0 0 0 4px rgba(248, 130, 96, 0.55)';
    el.style.borderRadius = el.style.borderRadius || '12px';

    const tooltipW = 320;
    let top = rect.bottom + 12;
    let left = rect.left + rect.width / 2 - tooltipW / 2;

    if (steps[step].position === 'right') {
      top = rect.top;
      left = rect.right + 12;
    } else if (steps[step].position === 'left') {
      top = rect.top;
      left = rect.left - tooltipW - 12;
    } else if (steps[step].position === 'top') {
      top = rect.top - 180;
      left = rect.left + rect.width / 2 - tooltipW / 2;
    }

    left = Math.max(12, Math.min(left, window.innerWidth - tooltipW - 12));
    top = Math.max(12, Math.min(top, window.innerHeight - 200));

    setPos({ top, left });

    return () => {
      el.style.position = prevPosition;
      el.style.zIndex = prevZIndex;
      el.style.boxShadow = prevShadow;
      el.style.borderRadius = prevRadius;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- closeTour stable, intentionally excluded to avoid relayout loop
  }, [active, step, steps]);

  const closeTour = () => {
    setActive(false);
    if (storageKey) localStorage.setItem(storageKey, new Date().toISOString());
  };

  const next = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else closeTour();
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!active) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-navy-900/60 z-[10000]"
        onClick={closeTour}
        data-testid="onboarding-overlay"
      />

      <div
        className="fixed z-[10002] w-[320px] bg-white border border-coral-200 rounded-xl shadow-2xl p-4"
        style={{ top: pos.top, left: pos.left }}
        data-testid="onboarding-tooltip"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-medium">
              {step + 1} of {steps.length}
            </span>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded bg-coral-50 text-coral-600 border border-coral-200 font-bold uppercase tracking-wider"
              data-testid="onboarding-role-badge"
            >
              {PORTAL_LABELS[resolvedPortal]}
            </span>
          </div>
          <button
            onClick={closeTour}
            className="text-slate-400 hover:text-navy-900 transition-colors"
            data-testid="onboarding-close-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <h3 className="text-navy-900 font-semibold text-sm mb-1">
          {steps[step]?.title}
        </h3>
        <p className="text-slate-600 text-xs mb-3 leading-relaxed">
          {steps[step]?.content}
        </p>
        <div className="flex items-center justify-between">
          <button
            onClick={closeTour}
            className="text-slate-500 text-xs hover:text-navy-900 transition-colors"
            data-testid="onboarding-skip-btn"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={prev}
                className="text-slate-600 hover:text-navy-900 h-7 px-2"
                data-testid="onboarding-prev-btn"
              >
                <ChevronLeft className="w-3 h-3 mr-1" /> Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={next}
              className="bg-coral-500 hover:bg-coral-600 text-white h-7 px-3"
              data-testid="onboarding-next-btn"
            >
              {step < steps.length - 1 ? (
                <>
                  Next <ChevronRight className="w-3 h-3 ml-1" />
                </>
              ) : (
                'Done'
              )}
            </Button>
          </div>
        </div>
        <div className="flex justify-center gap-1 mt-3">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === step ? 'bg-coral-500' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>
    </>
  );
}

// Allow product to reset a single portal's tour (used by "Restart tour" menu items).
export function resetOnboarding(portal) {
  if (portal && TOUR_KEYS[portal]) {
    localStorage.removeItem(TOUR_KEYS[portal]);
    return;
  }
  // Legacy: clear them all.
  Object.values(TOUR_KEYS).forEach(k => localStorage.removeItem(k));
  // Also clear the pre-portal legacy key if it still exists.
  localStorage.removeItem('nc_tour_completed');
}

export const ONBOARDING_PORTALS = Object.keys(TOUR_KEYS);
