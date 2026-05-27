/**
 * useViewMode — shared admin-view-mode state across the app.
 *
 * Persisted in localStorage under `nc_admin_view_mode`.
 * Synced across React subtrees + cross-tab via the same custom event
 * already dispatched by GlobalSubheader (`nc:admin-view-mode-change`).
 *
 * Values: 'admin' (default for admins) | 'notary' | 'client'
 *
 * Non-admin users never see the mode switcher; their effective mode is
 * derived purely from their primary role.
 */
import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'nc_admin_view_mode';
const EVENT_NAME = 'nc:admin-view-mode-change';

function readMode() {
  if (typeof window === 'undefined') return 'admin';
  try {
    return localStorage.getItem(STORAGE_KEY) || 'admin';
  } catch {
    return 'admin';
  }
}

export function useViewMode() {
  const [mode, setMode] = useState(readMode);

  useEffect(() => {
    const onCustom = (e) => {
      const next = e.detail || readMode();
      setMode(next);
    };
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setMode(e.newValue || 'admin');
    };
    window.addEventListener(EVENT_NAME, onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setViewMode = useCallback((next) => {
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
    setMode(next);
  }, []);

  return [mode, setViewMode];
}

export default useViewMode;
