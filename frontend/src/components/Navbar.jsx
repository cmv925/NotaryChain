import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from './ui/button';
import LanguageSwitcher from './LanguageSwitcher';
import { useTranslation } from 'react-i18next';

const Navbar = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200" data-testid="main-navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group" data-testid="navbar-brand">
          <Seal className="w-8 h-8 transition-transform group-hover:scale-105" />
          <span className="font-serif text-xl font-bold text-navy-900">NotaryChain</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <NavLink to="/florida">Florida</NavLink>
          <NavLink to="/notaries">Notaries</NavLink>
          <Link to="/scanner/demo" className="text-sm font-medium text-slate-700 hover:text-coral-600 transition-colors inline-flex items-center gap-1" data-testid="navbar-demo">
            AI demo <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold tracking-wider bg-coral-500 text-white rounded">NEW</span>
          </Link>
          <NavLink to="/verify">Verify</NavLink>
          <NavLink to="/trust-badge">Trust badge</NavLink>
          <NavLink to="/pricing">{t('nav.pricing')}</NavLink>
          <LanguageSwitcher />
          <Link to="/login" className="text-sm font-medium text-navy-900 hover:text-coral-600 transition-colors px-2" data-testid="navbar-login">
            {t('nav.login')}
          </Link>
          <Button
            onClick={() => navigate('/signup')}
            className="bg-coral-500 hover:bg-coral-600 text-white h-10 px-5 rounded-md shadow-sm font-medium"
            data-testid="navbar-signup"
          >
            {t('nav.signup')}
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-navy-900 hover:text-coral-600 p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          data-testid="mobile-menu-toggle"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-1" data-testid="mobile-menu">
          {[
            ['/florida', 'Florida'],
            ['/notaries', 'Notaries'],
            ['/scanner/demo', 'AI demo · NEW'],
            ['/verify', 'Verify'],
            ['/trust-badge', 'Trust badge'],
            ['/pricing', t('nav.pricing')],
            ['/login', t('nav.login')],
          ].map(([href, label]) => (
            <Link
              key={href}
              to={href}
              onClick={() => setMobileOpen(false)}
              className="block text-navy-900 hover:bg-cream-200 rounded-md text-sm font-medium py-2.5 px-3"
            >
              {label}
            </Link>
          ))}
          <div className="py-2 px-3">
            <LanguageSwitcher />
          </div>
          <Button
            onClick={() => { navigate('/signup'); setMobileOpen(false); }}
            className="w-full bg-coral-500 hover:bg-coral-600 text-white py-2.5 rounded-md font-medium"
          >
            {t('nav.signup')}
          </Button>
        </div>
      )}
    </nav>
  );
};

function NavLink({ to, children }) {
  return (
    <Link to={to} className="text-sm font-medium text-slate-700 hover:text-coral-600 transition-colors">
      {children}
    </Link>
  );
}

// Inline brand seal — matches the homepage one
function Seal({ className }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="29" fill="#0A192F" />
      <circle cx="32" cy="32" r="24" fill="none" stroke="#D4AF37" strokeWidth="1.2" />
      <circle cx="32" cy="32" r="13" fill="none" stroke="#D4AF37" strokeWidth="0.8" />
      <g stroke="#D4AF37" strokeWidth="1.4" strokeLinecap="round">
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(d => (
          <line key={d} x1="32" y1="5" x2="32" y2="9" transform={`rotate(${d} 32 32)`} />
        ))}
      </g>
      <path d="M32 24 L36 42 L32 45 L28 42 Z" fill="#D4AF37" />
    </svg>
  );
}

export default Navbar;
