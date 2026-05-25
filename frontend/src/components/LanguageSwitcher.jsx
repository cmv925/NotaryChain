import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const LANGS = [
  { code: 'en', label: 'English', flag: 'EN' },
  { code: 'es', label: 'Espanol', flag: 'ES' },
  { code: 'fr', label: 'Francais', flag: 'FR' },
];

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = LANGS.find(l => l.code === i18n.language) || LANGS[0];

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="relative" ref={ref} data-testid="language-switcher">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-coral-300/50 bg-cream-100/50 text-slate-500 hover:text-white text-sm transition-all"
        data-testid="language-switcher-btn"
      >
        <Globe className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">{current.flag}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl shadow-black/40 min-w-[140px] z-50 overflow-hidden">
          {LANGS.map(lang => (
            <button
              key={lang.code}
              onClick={() => { i18n.changeLanguage(lang.code); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-all text-left ${
                lang.code === i18n.language
                  ? 'bg-coral-500/15 text-coral-500'
                  : 'text-slate-500 hover:bg-cream-100/50 hover:text-white'
              }`}
              data-testid={`lang-${lang.code}`}
            >
              <span className="text-xs font-bold w-6">{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
