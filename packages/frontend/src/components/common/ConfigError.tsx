/**
 * ConfigError - Displays configuration errors when contract addresses are missing
 * 
 * Shows a user-friendly error message when the application is not properly configured
 * for blockchain interactions.
 * 
 * Requirements: 1.3, 5.4
 */

import { XCircleIcon } from '../icons';

export interface ConfigErrorProps {
  /** List of missing contract address names */
  missingAddresses: string[];
  /** List of configuration errors */
  errors?: string[];
  /** Whether to show as a full-page error or inline banner */
  variant?: 'page' | 'banner';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format contract name for display
 */
function formatContractName(name: string): string {
  // Convert camelCase to Title Case with spaces
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * ConfigError component for displaying missing configuration
 */
export function ConfigError({
  missingAddresses,
  errors = [],
  variant = 'banner',
  className = '',
}: ConfigErrorProps) {
  if (missingAddresses.length === 0 && errors.length === 0) {
    return null;
  }

  if (variant === 'page') {
    return (
      <PageConfigError
        missingAddresses={missingAddresses}
        errors={errors}
        className={className}
      />
    );
  }

  return (
    <BannerConfigError
      missingAddresses={missingAddresses}
      errors={errors}
      className={className}
    />
  );
}

interface ConfigErrorVariantProps {
  missingAddresses: string[];
  errors: string[];
  className: string;
}

/**
 * Full-page configuration error display
 */
function PageConfigError({ missingAddresses, errors, className }: ConfigErrorVariantProps) {
  return (
    <div
      className={`min-h-screen flex items-center justify-center bg-canvas p-4 ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="max-w-md w-full bg-paper rounded-lg shadow-lg border border-oppose/20 p-6">
        <div className="flex items-center gap-3 mb-4">
          <XCircleIcon size="lg" className="text-oppose flex-shrink-0" decorative />
          <h1 className="text-heading-3 text-ink">Configuration Error</h1>
        </div>

        <p className="text-body text-ink-muted mb-4">
          The application is not properly configured for blockchain interactions.
          Please contact the administrator or check the environment configuration.
        </p>

        {missingAddresses.length > 0 && (
          <div className="mb-4">
            <h2 className="text-body-small font-medium text-ink mb-2">
              Missing Contract Addresses:
            </h2>
            <ul className="list-disc list-inside text-body-small text-ink-muted space-y-1">
              {missingAddresses.map((name) => (
                <li key={name}>
                  <code className="bg-canvas px-1 py-0.5 rounded text-xs">
                    {formatContractName(name)}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        )}

        {errors.length > 0 && (
          <div className="mb-4">
            <h2 className="text-body-small font-medium text-ink mb-2">
              Configuration Errors:
            </h2>
            <ul className="list-disc list-inside text-body-small text-oppose space-y-1">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-ink/10">
          <p className="text-body-small text-ink-muted">
            Required environment variables:
          </p>
          <ul className="mt-2 text-xs text-ink-muted font-mono space-y-1">
            <li>VITE_EXCHANGE_ADDRESS</li>
            <li>VITE_VAULT_ADDRESS</li>
            <li>VITE_USDC_ADDRESS</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Banner-style configuration error display
 */
function BannerConfigError({ missingAddresses, errors, className }: ConfigErrorVariantProps) {
  return (
    <div
      className={`bg-oppose/10 border border-oppose/20 rounded-lg p-4 ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <XCircleIcon size="md" className="text-oppose flex-shrink-0 mt-0.5" decorative />
        <div className="flex-1 min-w-0">
          <h3 className="text-body font-medium text-ink mb-1">
            Configuration Required
          </h3>
          <p className="text-body-small text-ink-muted mb-2">
            Some blockchain features are unavailable due to missing configuration.
          </p>

          {missingAddresses.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {missingAddresses.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center px-2 py-1 rounded bg-canvas text-xs text-ink-muted"
                >
                  {formatContractName(name)}
                </span>
              ))}
            </div>
          )}

          {errors.length > 0 && (
            <ul className="mt-2 text-body-small text-oppose space-y-1">
              {errors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConfigError;
