import React from 'react';
import { Shield, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
    // Report to Sentry if configured
    if (window.__SENTRY_DSN__) {
      try {
        import('@sentry/react').then(Sentry => {
          Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
        }).catch(() => {});
      } catch {}
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-cream-100 flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-white text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-slate-500 text-sm mb-6">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleReset} className="bg-coral-500 text-black hover:bg-coral-600">
                <RefreshCw className="w-4 h-4 mr-2" /> Try Again
              </Button>
              <Button onClick={() => window.location.href = '/'} variant="outline" className="border-slate-200 text-slate-500">
                Go Home
              </Button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="mt-6 text-left text-xs text-red-400 bg-red-500/5 p-4 rounded-lg overflow-auto max-h-40">
                {this.state.error.toString()}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
