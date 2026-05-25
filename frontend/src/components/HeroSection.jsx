import React from 'react';
import { Button } from './ui/button';
import { ArrowRight, Shield, Cpu, Link2, Fingerprint, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const HeroSection = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <section className="relative min-h-screen flex items-center justify-center bg-cream-100 pt-20 overflow-hidden">
      {/* Animated grid background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute w-[600px] h-[600px] bg-coral-500/8 rounded-full blur-[120px] -top-40 -left-40" />
        <div className="absolute w-[500px] h-[500px] bg-coral-500/6 rounded-full blur-[100px] bottom-0 right-0" />
        <div className="absolute w-[300px] h-[300px] bg-navy-600/5 rounded-full blur-[80px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 text-center z-10" data-testid="hero-section">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-coral-300/30 bg-coral-500/5 mb-8">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm text-coral-400 font-medium">{t('hero.badge')}</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-[1.1] tracking-tight">
          {t('hero.title1')}
          <br />
          {t('hero.title2')}{' '}
          <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            {t('hero.title3')}
          </span>
        </h1>

        <p className="text-base lg:text-lg text-slate-500 mb-10 max-w-2xl mx-auto leading-relaxed">
          {t('hero.subtitle')}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Button
            onClick={() => navigate('/signup')}
            className="bg-coral-500 hover:bg-coral-500 text-white px-8 py-6 text-base rounded-lg transition-all shadow-lg shadow-coral-500/25 hover:shadow-coral-500/40 group"
            data-testid="hero-get-started-btn"
          >
            {t('hero.cta_start')}
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button
            onClick={() => navigate('/demo')}
            variant="outline"
            className="border border-slate-200 hover:border-coral-300/60 text-slate-500 hover:text-white px-8 py-6 text-base rounded-lg transition-all bg-white/[0.02] hover:bg-coral-500/5 group"
            data-testid="hero-demo-btn"
          >
            <Play className="mr-2 w-4 h-4 text-coral-500 group-hover:text-coral-400" />
            {t('hero.cta_demo')}
          </Button>
        </div>

        {/* Trust indicators */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {[
            { icon: Shield, label: t('trust.soc2'), sublabel: '22 security features' },
            { icon: Link2, label: t('trust.hedera'), sublabel: 'Blockchain sealed' },
            { icon: Cpu, label: t('trust.ai'), sublabel: 'Gemini analysis' },
            { icon: Fingerprint, label: t('trust.biometric'), sublabel: 'Liveness detection' },
          ].map((item, idx) => (
            <div
              key={idx}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200/60 bg-white/[0.02] backdrop-blur-sm hover:border-coral-300/30 transition-all"
            >
              <item.icon className="w-5 h-5 text-coral-500" />
              <span className="text-sm font-medium text-white">{item.label}</span>
              <span className="text-xs text-slate-500">{item.sublabel}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
