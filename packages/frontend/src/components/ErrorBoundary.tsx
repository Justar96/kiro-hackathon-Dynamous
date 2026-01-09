import { Component, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary - catches JavaScript errors in child components
 * Displays a calm, paper-style error message
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

/**
 * Default error fallback - paper-style error display
 */
function ErrorFallback({ error }: { error: Error | null }) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="bg-paper rounded-small border border-black/[0.08] shadow-paper p-8 max-w-md text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-oppose/10 flex items-center justify-center">
          <span className="text-oppose text-xl">!</span>
        </div>
        <h2 className="font-heading text-heading-3 text-text-primary mb-2">
          Something went wrong
        </h2>
        <p className="text-body-small text-text-secondary mb-4">
          {error?.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-text-primary text-paper text-body-small font-medium rounded-subtle hover:bg-text-primary/90 transition-colors"
          >
            Refresh Page
          </button>
          <Link
            to="/"
            className="px-4 py-2 border border-black/[0.08] text-text-primary text-body-small font-medium rounded-subtle hover:bg-page-bg transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline error display for smaller components
 */
export function InlineError({ 
  message, 
  onRetry 
}: { 
  message: string; 
  onRetry?: () => void;
}) {
  return (
    <div className="py-4 px-6 bg-oppose/5 border border-oppose/10 rounded-subtle">
      <p className="text-body-small text-oppose mb-2">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-body-small text-accent hover:text-accent-hover transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export default ErrorBoundary;
