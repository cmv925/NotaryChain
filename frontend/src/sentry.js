/**
 * Sentry bootstrap — DSN-gated, synchronous (NOT lazy-loaded).
 *
 * Imported as the FIRST import in index.js. When REACT_APP_SENTRY_DSN is absent
 * we never call Sentry.init, so the SDK stays completely inert (no network calls,
 * no overhead beyond the bundled code). This avoids the ChunkLoadError class of
 * bugs that come from lazy-loading the Sentry SDK into its own code-split chunk.
 */
import * as Sentry from '@sentry/react';

const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN;
const SENTRY_ENVIRONMENT =
  process.env.REACT_APP_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const SENTRY_RELEASE = process.env.REACT_APP_VERSION
  ? `notarychain-frontend@${process.env.REACT_APP_VERSION}`
  : undefined;

const isProduction = process.env.NODE_ENV === 'production';

let _initialized = false;

export function initSentry() {
  if (!SENTRY_DSN) {
    // No DSN → Sentry is a complete no-op.
    return false;
  }
  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: SENTRY_ENVIRONMENT,
      release: SENTRY_RELEASE,
      integrations: [Sentry.browserTracingIntegration()],
      tracesSampleRate: isProduction ? 0.2 : 1.0,
      tracePropagationTargets: [
        'localhost',
        process.env.REACT_APP_BACKEND_URL || /.*/,
      ],
      sendDefaultPii: false,
      // Drop noisy stale-bundle errors — the ErrorBoundary already auto-recovers these.
      ignoreErrors: [
        'ChunkLoadError',
        'Loading chunk',
        'is not a function',
        "Can't find variable",
      ],
    });
    _initialized = true;
    return true;
  } catch (e) {
    // Never let Sentry init crash the app.
    // eslint-disable-next-line no-console
    console.warn('Sentry init failed:', e);
    return false;
  }
}

/** Forward an error to Sentry if (and only if) it was initialized. */
export function captureError(error, errorInfo) {
  if (!_initialized) return;
  try {
    Sentry.captureException(error, errorInfo ? { extra: { errorInfo } } : undefined);
  } catch (_e) {
    /* swallow */
  }
}
