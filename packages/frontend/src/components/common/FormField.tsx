import { useId, forwardRef, useCallback, useState, useEffect } from 'react';

export interface FormFieldProps {
  /** Field name for form identification */
  name: string;
  /** Label text displayed above the field */
  label: string;
  /** Input type - text, email, password, or textarea */
  type?: 'text' | 'email' | 'password' | 'textarea';
  /** Current field value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Error message to display below field */
  error?: string;
  /** Whether field is required */
  required?: boolean;
  /** Maximum character length */
  maxLength?: number;
  /** Whether to show character count */
  showCharCount?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Whether to auto-focus on mount */
  autoFocus?: boolean;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Number of rows for textarea */
  rows?: number;
  /** Blur handler for validation */
  onBlur?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Help text displayed below field */
  helpText?: string;
  /** External touched state (overrides internal tracking) */
  touched?: boolean;
}

/**
 * FormField component with validation feedback and character counting.
 * Supports text, email, password, and textarea types.
 * Follows paper-clean aesthetic with clear error states.
 * 
 * Requirements: 7.1, 7.2, 7.5
 */
export const FormField = forwardRef<HTMLInputElement | HTMLTextAreaElement, FormFieldProps>(
  function FormField(
    {
      name,
      label,
      type = 'text',
      value,
      onChange,
      error,
      required = false,
      maxLength,
      showCharCount = false,
      placeholder,
      autoFocus = false,
      disabled = false,
      rows = 4,
      onBlur,
      className = '',
      helpText,
      touched: externalTouched,
    },
    ref
  ) {
    const id = useId();
    const errorId = `${id}-error`;
    const helpId = `${id}-help`;
    
    // Track if field has been interacted with for error display
    const [internalTouched, setInternalTouched] = useState(false);
    
    // Use external touched state if provided, otherwise use internal
    const touched = externalTouched !== undefined ? externalTouched : internalTouched;
    
    // Clear error state when value becomes valid
    const [prevError, setPrevError] = useState(error);
    useEffect(() => {
      if (error !== prevError) {
        setPrevError(error);
      }
    }, [error, prevError]);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onChange(e.target.value);
      },
      [onChange]
    );

    const handleBlur = useCallback(() => {
      setInternalTouched(true);
      onBlur?.();
    }, [onBlur]);

    const charCount = value.length;
    const isOverLimit = maxLength !== undefined && charCount > maxLength;
    const showError = error && touched;
    
    // Base input styles following paper-clean aesthetic
    const baseInputStyles = `
      w-full px-3 sm:px-4 py-3
      border rounded-subtle
      text-body-small sm:text-body text-text-primary
      placeholder:text-text-tertiary
      focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent
      disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50
      transition-colors
    `;
    
    const errorStyles = showError
      ? 'border-oppose focus:ring-oppose/20 focus:border-oppose'
      : 'border-black/[0.08]';

    const inputProps = {
      id,
      name,
      value,
      onChange: handleChange,
      onBlur: handleBlur,
      placeholder,
      autoFocus,
      disabled,
      required,
      maxLength: maxLength ? maxLength + 10 : undefined, // Allow slight overflow for UX
      'aria-invalid': showError ? true : undefined,
      'aria-describedby': [
        showError ? errorId : null,
        helpText ? helpId : null,
      ].filter(Boolean).join(' ') || undefined,
      className: `${baseInputStyles} ${errorStyles} ${className}`,
    };

    return (
      <div className="w-full">
        {/* Label */}
        <label
          htmlFor={id}
          className="block text-label uppercase tracking-wider text-text-secondary mb-2"
        >
          {label}
          {required && <span className="text-oppose ml-1" aria-hidden="true">*</span>}
        </label>

        {/* Input or Textarea */}
        {type === 'textarea' ? (
          <textarea
            {...inputProps}
            ref={ref as React.Ref<HTMLTextAreaElement>}
            rows={rows}
            className={`${inputProps.className} resize-none`}
          />
        ) : (
          <input
            {...inputProps}
            ref={ref as React.Ref<HTMLInputElement>}
            type={type}
          />
        )}

        {/* Footer: Error, Help Text, and Character Count */}
        <div className="mt-2 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Error Message - Requirements 7.1, 7.2 */}
            {showError && (
              <p
                id={errorId}
                className="text-caption text-oppose"
                role="alert"
                aria-live="polite"
              >
                {error}
              </p>
            )}
            
            {/* Help Text */}
            {helpText && !showError && (
              <p id={helpId} className="text-caption text-text-tertiary">
                {helpText}
              </p>
            )}
          </div>

          {/* Character Count - Requirements 7.5 */}
          {showCharCount && maxLength !== undefined && (
            <span
              className={`text-caption flex-shrink-0 ${
                isOverLimit ? 'text-oppose font-medium' : 'text-text-tertiary'
              }`}
              aria-live="polite"
              aria-atomic="true"
            >
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  }
);

export default FormField;
