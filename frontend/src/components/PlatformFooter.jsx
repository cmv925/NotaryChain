/**
 * PlatformFooter — global ink-900 (#131314) footer with quick-links.
 *
 * Mounted globally inside the Router so it knows the current path.
 * Hidden automatically on full-screen flows (ceremony sessions, auth, embed
 * iframes, the public snapshot view) where chrome would be intrusive.
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, BookOpen, Search, Vault, Network, HelpCircle, Mail, ExternalLink } from 'lucide-react';

const HIDDEN_PATH_PREFIXES = [
  '/session',
  '/login',
  '/signup',
  '/auth',
  '/sso',
  '/embed',
  '/compliance/snapshot/',
  '/auth0-callback',
];

const QUICK_LINKS = [
  { label: 'Verify a document', to: '/verify', icon: Search },
  { label: 'Trust Hub', to: '/trust-hub', icon: Network },
  { label: 'Asset Vault', to: '/asset-vault', icon: Vault },
  { label: 'User Guide', to: '/docs', icon: BookOpen },
  { label: 'State Compliance', to: '/compliance/states', icon: Shield },
  { label: 'Find Notaries', to: '/notaries', icon: Network },
];

const RESOURCE_LINKS = [
  { label: 'About', to: '/' },
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'Pricing', to: '/pricing' },
];

export default function PlatformFooter() {
  const { pathname } = useLocation();
  if (HIDDEN_PATH_PREFIXES.some(p => pathname.startsWith(p))) return null;

  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#131314] text-cream-100 mt-20" data-testid="platform-footer">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Brand column */}
          <div className="md:col-span-4" data-testid="footer-brand">
            <Link to="/" className="inline-flex items-center gap-2 mb-3">
              <Shield className="w-6 h-6 text-coral-500" />
              <span className="font-bold text-lg">Notary<span className="text-coral-500">Chain</span></span>
            </Link>
            <p className="text-ink-200 text-sm leading-relaxed max-w-xs">
              Remote Online Notarization with Hedera-backed seals, multi-state compliance
              evaluators, and federated TrustLayer attestations.
            </p>
            <div className="mt-4 flex items-center gap-3 text-sm">
              <a href="mailto:support@notarychain.app" className="inline-flex items-center gap-1.5 text-cream-100 hover:text-coral-400 transition-colors" data-testid="footer-support-email">
                <Mail className="w-4 h-4" /> support@notarychain.app
              </a>
            </div>
          </div>

          {/* Quick actions column */}
          <div className="md:col-span-5" data-testid="footer-quick-links">
            <p className="text-[11px] uppercase tracking-[0.2em] text-ink-300 font-bold mb-4">Quick actions</p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
              {QUICK_LINKS.map(({ label, to, icon: Icon }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="inline-flex items-center gap-2 text-sm text-cream-100 hover:text-coral-400 transition-colors group"
                    data-testid={`footer-link-${to.replace(/\//g, '-').replace(/^-/, '')}`}
                  >
                    <Icon className="w-3.5 h-3.5 text-ink-300 group-hover:text-coral-400 transition-colors" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources column */}
          <div className="md:col-span-3" data-testid="footer-resources">
            <p className="text-[11px] uppercase tracking-[0.2em] text-ink-300 font-bold mb-4">Resources</p>
            <ul className="space-y-2">
              {RESOURCE_LINKS.map(({ label, to }) => (
                <li key={to}>
                  <Link to={to} className="text-sm text-cream-100 hover:text-coral-400 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/help" className="text-sm text-cream-100 hover:text-coral-400 transition-colors inline-flex items-center gap-1">
                  Help & FAQ <HelpCircle className="w-3 h-3" />
                </Link>
              </li>
              <li>
                <a
                  href="https://hashscan.io/mainnet/topic/0.0.10373605"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-cream-100 hover:text-coral-400 transition-colors inline-flex items-center gap-1"
                  data-testid="footer-hashscan-link"
                >
                  Hedera ledger <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-ink-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <p className="text-[12px] text-ink-300" data-testid="footer-copyright">
            © {year} NotaryChain. Notarization, done right. Online, in minutes.
          </p>
          <div className="flex items-center gap-4 text-[12px] text-ink-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              All systems operational
            </span>
            <span className="opacity-50">·</span>
            <span>Hedera mainnet · Topic 0.0.10373605</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
