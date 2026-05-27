/**
 * useDashboardTelemetry — single shared audit stream for the admin and notary
 * dashboards (and the onboarding tour).
 *
 * Usage:
 *   const { log } = useDashboardTelemetry();
 *   log({ surface:'command_authority', action:'approve_notary',
 *         target_id: notaryId, outcome:'success' });
 *
 * Behaviour:
 *   • Buffers calls in-memory (ring-buffered to last 200) so a UI panel can
 *     show "recent operator activity" even before the backend round-trip.
 *   • Fires-and-forgets a POST to /api/telemetry/event. Failures are silent
 *     by design — telemetry must never break the user flow.
 *   • Listens for `telemetry:event` window events so any module can emit
 *     without holding a hook reference (used by the OnboardingTour).
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const MAX_BUFFER = 200;

// Module-level ring buffer so multiple hook instances share the same view.
let _buffer = [];
const _listeners = new Set();

function _push(event) {
  _buffer = [event, ..._buffer].slice(0, MAX_BUFFER);
  _listeners.forEach((l) => l(_buffer));
}

/**
 * Emit a telemetry event from any module — no hook required.
 * Backend dispatch uses the auth token attached by `useDashboardTelemetry`'s
 * mount-time installer; if no token is in localStorage we skip the network
 * round-trip and only update the in-memory buffer.
 */
export function emitTelemetry(event) {
  const enriched = {
    ...event,
    ts: new Date().toISOString(),
    client_only: true,
  };
  _push(enriched);
  try {
    const token =
      localStorage.getItem('access_token') ||
      localStorage.getItem('token') ||
      sessionStorage.getItem('access_token');
    if (token) {
      axios
        .post(`${API}/telemetry/event`, event, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .catch(() => {});
    }
  } catch {
    /* silent */
  }
}

/**
 * Hook used inside the admin/notary dashboards. Returns:
 *   - log(event)   — record an event (in-memory + backend POST)
 *   - recent       — last MAX_BUFFER events, newest first (live-updated)
 */
export default function useDashboardTelemetry() {
  const { token } = useAuth();
  const [recent, setRecent] = useState(_buffer);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    const listener = (next) => setRecent([...next]);
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  }, []);

  // Allow window-level event emitters (e.g. OnboardingTour) to feed in.
  useEffect(() => {
    const handler = (e) => {
      if (e?.detail) emitTelemetry(e.detail);
    };
    window.addEventListener('telemetry:event', handler);
    return () => window.removeEventListener('telemetry:event', handler);
  }, []);

  const log = useCallback(
    (event) => {
      const enriched = { ...event, ts: new Date().toISOString() };
      _push(enriched);
      if (!tokenRef.current) return;
      axios
        .post(`${API}/telemetry/event`, event, {
          headers: { Authorization: `Bearer ${tokenRef.current}` },
        })
        .catch(() => {});
    },
    [],
  );

  return { log, recent };
}
