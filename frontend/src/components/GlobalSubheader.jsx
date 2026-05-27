/**
 * GlobalSubheader — slim ink-700 strip below the main header on every page.
 *
 * Provides two cross-cutting affordances:
 *   1. **Back button** — uses window.history.back() with a smart fallback to
 *      the role-appropriate home (/admin for admins, /dashboard otherwise).
 *      Hidden on the user's "home" landing pages so it doesn't loop back to
 *      itself.
 *   2. **Admin/Notary view toggle** — visible only when the current user has
 *      role === 'admin'. Persists the chosen mode in localStorage and
 *      navigates the admin to their admin home (/admin) or their notary
 *      workspace (/dashboard) so they can context-switch in one click.
 */
import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Pages where a back button would loop back to itself.
const HOME_PATHS = new Set([
  '/', '/dashboard', '/admin', '/login', '/signup',
]);

// Pages where the entire subheader should be suppressed (full-screen flows).
const HIDDEN_PATH_PREFIXES = [
  '/login', '/signup', '/auth', '/sso', '/embed',
  '/compliance/snapshot/', '/auth0-callback',
];

const VIEW_MODE_KEY = 'nc_admin_view_mode';

export const getCurrentAdminViewMode = () =>
  localStorage.getItem(VIEW_MODE_KEY) || 'admin';

export default function GlobalSubheader() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();

  // Suppress on full-screen flows
  if (HIDDEN_PATH_PREFIXES.some(p => pathname.startsWith(p))) return null;
  // Don't render if there's no user (anonymous routes like /verify still get it though — handled below)

  const isAdmin = user?.role === 'admin';
  const onHome = HOME_PATHS.has(pathname);
  const currentMode = getCurrentAdminViewMode();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(isAdmin ? '/admin' : '/dashboard');
    }
  };

  const switchMode = (mode) => {
    localStorage.setItem(VIEW_MODE_KEY, mode);
    // Notify any listeners (sidebar widgets, etc.) that mode changed
    window.dispatchEvent(new CustomEvent('nc:admin-view-mode-change', { detail: mode }));
    // 'admin' → admin home, 'notary' → notary workspace (NOT the end-user dashboard)
    navigate(mode === 'admin' ? '/admin' : '/notary/dashboard');
  };

  // If nothing to show on this page (home + not admin), render nothing.
  if (onHome && !isAdmin) return null;

  return (
    <div className="bg-ink-800 border-b border-ink-700 text-cream-100" data-testid="global-subheader">
      <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between gap-4">
        {/* Back / breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          {!onHome ? (
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 text-[12px] text-cream-100 hover:text-coral-400 transition-colors group"
              data-testid="global-back-btn"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
              Back
            </button>
          ) : (
            <span className="text-[11px] uppercase tracking-[0.2em] text-ink-300 font-bold">
              {pathname === '/admin' ? 'Command Authority Suite' :
               pathname === '/notary/dashboard' ? 'Assurance Portal' :
               pathname === '/dashboard' ? 'Client Sovereign Hub' : 'Home'}
            </span>
          )}
          {!onHome && (
            <>
              <span className="text-ink-400">·</span>
              <Link
                to={isAdmin ? '/admin' : '/dashboard'}
                className="text-[12px] text-ink-200 hover:text-coral-400 transition-colors"
                data-testid="global-home-link"
              >
                {isAdmin ? 'Admin home' : 'Dashboard'}
              </Link>
              <span className="text-ink-400 hidden md:inline">·</span>
              <code className="text-[11px] text-ink-300 font-mono truncate hidden md:inline" data-testid="global-current-path">
                {pathname}
              </code>
            </>
          )}
        </div>

        {/* Admin/Notary view toggle (admins only) */}
        {isAdmin && (
          <div className="inline-flex items-center bg-ink-900 border border-ink-700 rounded-md p-0.5 text-[11px] uppercase tracking-wider font-semibold" data-testid="admin-view-toggle">
            <button
              onClick={() => switchMode('admin')}
              className={`px-3 py-1 rounded transition-colors ${
                currentMode === 'admin'
                  ? 'bg-coral-500 text-white'
                  : 'text-ink-200 hover:text-cream-100'
              }`}
              data-testid="admin-view-toggle-admin"
            >
              Admin
            </button>
            <button
              onClick={() => switchMode('notary')}
              className={`px-3 py-1 rounded transition-colors ${
                currentMode === 'notary'
                  ? 'bg-coral-500 text-white'
                  : 'text-ink-200 hover:text-cream-100'
              }`}
              data-testid="admin-view-toggle-notary"
            >
              Notary
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
