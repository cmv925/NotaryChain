/**
 * UserDropdown — shared user menu shown in the top-right of every authenticated
 * page. Replaces the standalone Logout button.
 *
 * Contents:
 *   • User name + email
 *   • Role badge (Admin / Notary / Client) tinted by role
 *   • Role-switcher entries (only if the user has multiple eligible profiles):
 *       - Admin    → can flip into Notary view OR Client view
 *       - Notary   → can flip into Client view
 *       - Client   → no switcher (single mode)
 *   • Logout
 *
 * Role-switcher updates `nc_admin_view_mode` (via useViewMode) AND navigates to
 * the canonical landing page for the chosen mode, so the entire UI re-skins.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Briefcase, User as UserIcon, LogOut, ChevronDown,
  Eye, Star, Scale, Diamond, Sparkles
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import useViewMode from '../hooks/useViewMode';
import { resetOnboarding } from './OnboardingTour';

const ROLE_META = {
  admin:  { label: 'Admin',  Icon: Shield,   color: 'bg-coral-50 text-coral-700 border-coral-200' },
  notary: { label: 'Notary', Icon: Briefcase, color: 'bg-navy-50 text-navy-800 border-navy-200' },
  client: { label: 'Client', Icon: UserIcon, color: 'bg-gold-50 text-gold-700 border-gold-300' },
};

const VIEW_META = {
  admin:  { label: 'Command Authority Suite', path: '/admin',              Glyph: Star,    portal: 'command_authority' },
  notary: { label: 'Assurance Portal',        path: '/notary/dashboard',   Glyph: Scale,   portal: 'assurance' },
  client: { label: 'Client Sovereign Hub',    path: '/dashboard',          Glyph: Diamond, portal: 'client_sovereign' },
};

export default function UserDropdown() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mode, setMode] = useViewMode();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;

  // Determine the primary "anchor" role from the user record.
  const primaryRole = user.role === 'admin' ? 'admin'
                   : (user.is_notary || user.role === 'notary') ? 'notary'
                   : 'client';

  // Views this role is allowed to inhabit.
  const allowedViews = primaryRole === 'admin'  ? ['admin', 'notary', 'client']
                     : primaryRole === 'notary' ? ['notary', 'client']
                     :                            ['client'];

  // Effective mode = stored mode if it's allowed for this role, else fall back
  // to primary. Lets notaries flip between Assurance Portal ↔ Client Sovereign Hub
  // (and back), not just one-way.
  const effectiveMode = allowedViews.includes(mode) ? mode : primaryRole;
  const switchableViews = allowedViews.filter((v) => v !== effectiveMode);

  const badge = ROLE_META[effectiveMode];
  const BadgeIcon = badge.Icon;

  const switchTo = (target) => {
    setMode(target);
    setOpen(false);
    navigate(VIEW_META[target].path);
  };

  const initials = (user.full_name || user.email || '?')
    .split(/[\s@]/)[0].slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-cream-200 transition-colors"
        data-testid="user-dropdown-trigger"
      >
        <div className="w-8 h-8 rounded-full bg-coral-500 text-white flex items-center justify-center font-semibold text-xs">
          {initials}
        </div>
        <div className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-[13px] font-semibold text-navy-900 max-w-[160px] truncate">
            {user.full_name || user.email}
          </span>
          <span className={`text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded border ${badge.color}`}>
            <BadgeIcon className="w-2.5 h-2.5 inline mr-0.5 -mt-0.5" />
            {badge.label}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-2"
          data-testid="user-dropdown-menu"
        >
          {/* Identity card */}
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-navy-900 truncate">{user.full_name || 'NotaryChain User'}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border ${badge.color}`}>
                <BadgeIcon className="w-3 h-3 inline mr-1 -mt-0.5" />
                {badge.label} · current view
              </span>
            </div>
          </div>

          {/* Role-switcher */}
          {switchableViews.length > 0 && (
            <>
              <div className="px-4 pt-3 pb-1">
                <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-slate-600">Switch view</p>
              </div>
              {switchableViews.map((target) => {
                const meta = VIEW_META[target];
                const Glyph = meta.Glyph;
                return (
                  <button
                    key={target}
                    onClick={() => switchTo(target)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-cream-100 transition-colors"
                    data-testid={`user-dropdown-switch-${target}`}
                  >
                    <span className="w-7 h-7 rounded-md bg-cream-200 flex items-center justify-center">
                      <Glyph className="w-3.5 h-3.5 text-navy-900" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-navy-900">{meta.label}</span>
                      <span className="block text-[11px] text-slate-500">
                        Preview the {ROLE_META[target].label.toLowerCase()} experience
                      </span>
                    </span>
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                );
              })}
              <div className="my-2 border-t border-slate-100" />
            </>
          )}

          {/* Restart tour for the current portal */}
          <button
            onClick={() => {
              const meta = VIEW_META[effectiveMode];
              resetOnboarding(meta.portal);
              setOpen(false);
              if (window.location.pathname === meta.path) {
                window.location.reload();
              } else {
                navigate(meta.path);
              }
            }}
            className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-cream-100 transition-colors"
            data-testid="user-dropdown-restart-tour"
          >
            <span className="w-7 h-7 rounded-md bg-coral-50 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-coral-600" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-navy-900">Restart tour</span>
              <span className="block text-[11px] text-slate-500">
                Replay the {VIEW_META[effectiveMode].label} walkthrough
              </span>
            </span>
          </button>
          <div className="my-2 border-t border-slate-100" />

          {/* Logout */}
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-coral-50 transition-colors"
            data-testid="user-dropdown-logout"
          >
            <LogOut className="w-4 h-4 text-coral-600" />
            <span className="text-sm font-semibold text-coral-700">Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}
