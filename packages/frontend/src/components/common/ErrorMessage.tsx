import { XCircleIcon } from '../icons';

export type ErrorMessageVariant = 'inline' | 'block' | 'toast';

export interface ErrorMessageProps {
  /** The error to display - can be an Error object, string, or null */
  error: Error | string | null;
  /** Optional retry callback - shows a retry button when provided */
  onRetry?: () => void;
  /** Display variant: inline (compact), block (full-width), or toast (notification style) */
  variant?: ErrorMessageVariant;
  /** Additional CSS classes */
  className?: string;
  /** Custom retry button text */
  retryText?: string;
}

/**
 * ErrorMessage - Displays error messages with optional retry functionality
 * 
 * Supports three variants:
 * - inline: Compact error display for form fields or small areas
 * - block: Full-width error display for sections
 * - toast: Notification-style error (typically used with toast system)
 * 
 * Requirements: 5.1, 5.2
 */
export function ErrorMessage({
  error,
  onRetry,
  variant = 'inline',
  className = '',
  retryText = 'Try again',
}: ErrorMessageProps) {
  // Don't render if no error
  if (!error) {
    return null;
  }

  // Extract error message
  const message = typeof error === 'string' ? error : error.message;

  // Render based on variant
  switch (variant) {
    case 'inline':
      return (
        <InlineErrorMessage
          message={message}
          onRetry={onRetry}
          retryText={retryText}
          className={className}
        />
      );
    case 'block':
      return (
        <BlockErrorMessage
          message={message}
          onRetry={onRetry}
          retryText={retryText}
          className={className}
        />
      );
    case 'toast':
      return (
        <ToastErrorMessage
          message={message}
          onRetry={onRetry}
          retryText={retryText}
          className={className}
        />
      );
    default:
      return (
        <InlineErrorMessage
          message={message}
          onRetry={onRetry}
          retryText={retryText}
          className={className}
        />
      );
  }
}

interface ErrorVariantProps {
  message: string;
  onRetry?: () => void;
  retryText: string;
  className: string;
}

/**
 * Inline error - compact display for form fields
 * Retry button has 44px minimum touch target for accessibility (Requirement 8.4)
 */
function InlineErrorMessage({ message, onRetry, retryText, className }: ErrorVariantProps) {
  return (
    <div 
      className={`flex items-center gap-2 text-oppose ${className}`}
      role="alert"
      aria-live="polite"
    >
      <XCircleIcon size="sm" className="text-oppose flex-shrink-0" decorative />
      <span className="text-body-small">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="min-h-[44px] px-2 text-body-small text-accent hover:text-accent-hover transition-colors underline focus:outline-none focus:ring-2 focus:ring-accent/50 rounded inline-flex items-center"
          type="button"
        >
          {retryText}
        </button>
      )}
    </div>
  );
}

/**
 * Block error - full-width display for sections
 * Retry button has 44px minimum touch target for accessibility (Requirement 8.4)
 */
function BlockErrorMessage({ message, onRetry, retryText, className }: ErrorVariantProps) {
  return (
    <div 
      className={`py-4 px-6 bg-oppose/5 border border-oppose/10 rounded-subtle ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <XCircleIcon size="md" className="text-oppose flex-shrink-0" decorative />
        <div className="flex-1">
          <p className="text-body-small text-oppose mb-1">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="min-h-[44px] px-2 text-body-small text-accent hover:text-accent-hover transition-colors focus:outline-none focus:underline inline-flex items-center -ml-2"
              type="button"
            >
              {retryText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Toast error - notification style (for use outside toast system)
 * Retry button has 44px minimum touch target for accessibility (Requirement 8.4)
 */
function ToastErrorMessage({ message, onRetry, retryText, className }: ErrorVariantProps) {
  return (
    <div 
      className={`
        flex items-start gap-3 px-4 py-3 rounded-lg border shadow-md
        bg-paper border-oppose/30 text-ink
        ${className}
      `}
      role="alert"
      aria-live="assertive"
    >
      <span className="flex-shrink-0 mt-0.5 text-oppose">
        <XCircleIcon size="md" decorative />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-relaxed">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 min-h-[44px] px-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors inline-flex items-center -ml-2"
            type="button"
          >
            {retryText}
          </button>
        )}
      </div>
    </div>
  );
}

export default ErrorMessage;
