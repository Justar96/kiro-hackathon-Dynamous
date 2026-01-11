import { Component, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  /** Callback fired when an error is caught - useful for logging */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Callback fired when the error boundary resets */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary - catches JavaScript errors in child components
 * Displays a calm, paper-style error message with recovery options
 * 
 * Features:
 * - onError callback for external logging
 * - onReset callback for recovery actions
 * - Paper-clean fallback UI
 * - "Return to Home" button
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
    // Log to console for debugging (without exposing technical details to users)
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Call external error handler if provided (for logging services)
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetErrorBoundary = () => {
    // Call onReset callback if provided
    if (this.props.onReset) {
      this.props.onReset();
    }
    // Reset the error state
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback 
          error={this.state.error} 
          resetErrorBoundary={this.resetErrorBoundary}
        />
      );
    }

    return this.props.children;
  }
}

export interface ErrorFallbackProps {
  error: Error | null;
  resetErrorBoundary?: () => void;
}

/**
 * Default error fallback - paper-clean error display
 * Provides recovery options without exposing technical details
 */
export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="bg-paper rounded-small border border-black/[0.08] shadow-paper p-8 max-w-md text-center">
        {/* Error icon */}
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-oppose/10 flex items-center justify-center">
          <svg 
            className="w-6 h-6 text-oppose" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
        </div>
        
        {/* Error heading */}
        <h2 className="font-heading text-heading-3 text-text-primary mb-2">
          Something went wrong
        </h2>
        
        {/* User-friendly error message (no technical details) */}
        <p className="text-body-small text-text-secondary mb-6">
          {error?.message && !error.message.includes('Error:') 
            ? error.message 
            : 'An unexpected error occurred. Please try again or return to the home page.'}
        </p>
        
        {/* Recovery actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {/* Try Again button - calls resetErrorBoundary */}
          {resetErrorBoundary && (
            <button
              onClick={resetErrorBoundary}
              className="w-full sm:w-auto px-4 py-2 bg-text-primary text-paper text-body-small font-medium rounded-subtle hover:bg-text-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-text-primary/50"
            >
              Try Again
            </button>
          )}
          
          {/* Refresh Page button */}
          <button
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto px-4 py-2 border border-black/[0.08] text-text-primary text-body-small font-medium rounded-subtle hover:bg-page-bg transition-colors focus:outline-none focus:ring-2 focus:ring-text-primary/20"
          >
            Refresh Page
          </button>
          
          {/* Return to Home button - uses regular anchor for router-independence */}
          <a
            href="/"
            className="w-full sm:w-auto px-4 py-2 border border-black/[0.08] text-text-primary text-body-small font-medium rounded-subtle hover:bg-page-bg transition-colors text-center focus:outline-none focus:ring-2 focus:ring-text-primary/20"
          >
            Return to Home
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline error display for smaller components
 * Supports retry functionality
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
          className="text-body-small text-accent hover:text-accent-hover transition-colors focus:outline-none focus:underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export default ErrorBoundary;
