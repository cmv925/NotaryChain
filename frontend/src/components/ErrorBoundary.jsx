import React from 'react';
import { Shield, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

/**
 * ErrorBoundary — top-level catch for uncaught render-time exceptions.
 *
 * Special handling for ChunkLoadError / "is not a function" / "Cannot find module" —
 * those almost always come from a stale Service Worker cache serving an old JS chunk
 * that mismatches the freshly-loaded module graph. We auto-purge caches + SW + reload
 * once per session so the user doesn't have to know about hard refreshes.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null, recovering: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
    this.setState({ info });

    const msg = (error?.message || '').toLowerCase();
    const isStaleBundle =
      msg.includes('chunkloaderror') ||
      msg.includes('loading chunk') ||
      msg.includes('is not a function') ||
      msg.includes('cannot find module') ||
      msg.includes("can't find variable") ||
      error?.name === 'ChunkLoadError';

    // Auto-recover from stale-cache symptoms, but only once per session to avoid loops.
    if (isStaleBundle && !sessionStorage.getItem('nc_sw_purged')) {
      sessionStorage.setItem('nc_sw_purged', '1');
      this.setState({ recovering: true });
      this.purgeAndReload();
    }
  }

  async purgeAndReload() {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (e) {
      console.warn('Cache purge failed:', e);
    }
    // Force-reload bypassing the HTTP cache.
    window.location.reload();
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, info: null, recovering: false });
  };

  handleHardReload = () => {
    sessionStorage.removeItem('nc_sw_purged');
    this.purgeAndReload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.state.recovering) {
      return (
        <div className="min-h-screen bg-cream-100 flex items-center justify-center p-6">
          <div className="text-center">
            <RefreshCw className="w-10 h-10 text-coral-500 animate-spin mx-auto mb-3" />
            <p className="text-navy-900 font-semibold">Refreshing application…</p>
            <p className="text-slate-500 text-sm mt-1">Clearing stale caches.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-navy-900 text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-slate-500 text-sm mb-6">
            An unexpected error occurred. Try the buttons below — the second one clears app caches and forces a clean reload.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button
              onClick={this.handleReset}
              className="bg-coral-500 text-white hover:bg-coral-600"
              data-testid="error-try-again-btn"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Try Again
            </Button>
            <Button
              onClick={this.handleHardReload}
              variant="outline"
              className="border-coral-300 text-coral-700 hover:bg-coral-50"
              data-testid="error-hard-reload-btn"
            >
              Clear cache & reload
            </Button>
            <Button
              onClick={() => { window.location.href = '/'; }}
              variant="outline"
              className="border-slate-200 text-slate-500"
              data-testid="error-go-home-btn"
            >
              Go Home
            </Button>
          </div>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <pre
              className="mt-6 text-left text-xs text-red-500 bg-red-50 border border-red-100 p-4 rounded-lg overflow-auto max-h-60"
              data-testid="error-stack"
            >
              {this.state.error.toString()}
              {this.state.info?.componentStack ? '\n\nComponent stack:' + this.state.info.componentStack : ''}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
