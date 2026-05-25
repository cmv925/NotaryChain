import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Button } from '../components/ui/button';
import {
  FileText, Shield, Eye, Lock, Scale, Link, Play, Pause,
  RotateCcw, CheckCircle, XCircle, Loader2, Clock, Zap,
  ChevronRight, ExternalLink,
} from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ICON_MAP = {
  FileText, Shield, Eye, Lock, Scale, Link,
};

function StepCard({ step, isActive, isCompleted, delay }) {
  const Icon = ICON_MAP[step.icon] || FileText;
  const statusColors = {
    pass: 'border-emerald-500/40 bg-coral-500/5',
    fail: 'border-red-500/40 bg-red-500/5',
    completed: 'border-coral-300/40 bg-coral-500/5',
    pending: 'border-slate-300 bg-cream-200',
  };

  return (
    <div
      data-testid={`replay-step-${step.step}`}
      className={`rounded-xl border p-4 transition-all duration-700 ${
        isActive ? 'ring-2 ring-coral-500/50 scale-[1.02]' : ''
      } ${isCompleted ? statusColors[step.status] || statusColors.completed : 'border-slate-200 bg-white/20 opacity-40'}`}
      style={{ animationDelay: `${delay}ms`, animation: isCompleted ? 'fadeInUp 0.6s ease forwards' : 'none' }}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          step.status === 'pass' ? 'bg-coral-500/15 text-coral-600' :
          step.status === 'fail' ? 'bg-red-500/15 text-red-400' :
          'bg-coral-500/15 text-coral-600'
        }`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-600 font-mono">STEP {step.step}</span>
            <h4 className="text-sm font-semibold text-navy-900">{step.title}</h4>
            {step.verdict && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                step.verdict === 'PASS' ? 'bg-coral-500/15 text-coral-600' : 'bg-red-500/15 text-red-400'
              }`}>{step.verdict}</span>
            )}
            {step.result && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                step.result === 'APPROVED' ? 'bg-coral-500/15 text-coral-600' : 'bg-red-500/15 text-red-400'
              }`}>{step.result}</span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-1 line-clamp-2">{step.description}</p>
          {step.confidence && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-cream-200 rounded-full overflow-hidden">
                <div className="h-full bg-coral-500 rounded-full transition-all duration-1000"
                  style={{ width: isCompleted ? `${(step.confidence * 100)}%` : '0%' }} />
              </div>
              <span className="text-[10px] text-slate-500">{(step.confidence * 100).toFixed(0)}%</span>
            </div>
          )}
          {step.checks?.length > 0 && isCompleted && (
            <div className="flex flex-wrap gap-1 mt-2">
              {step.checks.map((c, i) => (
                <span key={i} className="text-[9px] bg-cream-200 text-slate-600 px-1.5 py-0.5 rounded">{c}</span>
              ))}
            </div>
          )}
          {step.explorer_url && (
            <a href={step.explorer_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-coral-600 mt-2 hover:underline">
              <ExternalLink className="w-3 h-3" /> View on Explorer
            </a>
          )}
          {step.timestamp && (
            <div className="flex items-center gap-1 mt-1.5">
              <Clock className="w-3 h-3 text-slate-600" />
              <span className="text-[10px] text-slate-600">{new Date(step.timestamp).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CeremonyReplay() {
  const { ceremonyId } = useParams();
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!ceremonyId || !token) return;
    axios.get(`${API}/platform/ceremony-replay/${ceremonyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [ceremonyId, token]);

  useEffect(() => {
    if (playing && data) {
      intervalRef.current = setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= data.steps.length) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing, data]);

  const play = () => { setCurrentStep(0); setPlaying(true); };
  const pause = () => setPlaying(false);
  const reset = () => { setPlaying(false); setCurrentStep(0); };

  if (loading) return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center text-slate-500">
      Ceremony not found
    </div>
  );

  return (
    <div className="min-h-screen bg-cream-100" data-testid="ceremony-replay-page">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Breadcrumbs items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Ceremony Replay' },
        ]} />

        {/* Header */}
        <div className="flex items-center justify-between mt-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-navy-900">{data.document_name}</h1>
            <p className="text-xs text-slate-500">Signer: {data.signer_name} &middot; {data.steps.length} steps</p>
          </div>
          <div className="flex gap-2">
            <Button data-testid="replay-play-btn" size="sm" onClick={playing ? pause : play}
              className="bg-coral-500 hover:bg-coral-600 text-navy-900">
              {playing ? <><Pause className="w-3.5 h-3.5 mr-1" />Pause</> : <><Play className="w-3.5 h-3.5 mr-1" />Play</>}
            </Button>
            <Button data-testid="replay-reset-btn" size="sm" variant="outline" onClick={reset}
              className="border-slate-300 text-slate-600 hover:text-navy-900">
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Progress</span>
            <span className="text-[10px] text-slate-500">{Math.min(currentStep, data.steps.length)}/{data.steps.length}</span>
          </div>
          <div className="h-1.5 bg-cream-200 rounded-full overflow-hidden">
            <div className="h-full italic text-coral-600 rounded-full transition-all duration-500"
              style={{ width: `${(Math.min(currentStep, data.steps.length) / data.steps.length) * 100}%` }} />
          </div>
        </div>

        {/* Steps Timeline */}
        <div className="space-y-3">
          {data.steps.map((step, i) => (
            <StepCard
              key={i}
              step={step}
              isActive={i === currentStep - 1}
              isCompleted={i < currentStep}
              delay={i * 200}
            />
          ))}
        </div>

        {currentStep >= data.steps.length && (
          <div data-testid="replay-complete" className="mt-6 text-center bg-coral-500/10 border border-coral-200 rounded-xl p-4">
            <CheckCircle className="w-6 h-6 text-coral-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-coral-600">Ceremony Complete</p>
            <p className="text-[11px] text-slate-500 mt-1">All {data.steps.length} steps replayed successfully</p>
          </div>
        )}
      </div>
    </div>
  );
}
