/**
 * Form Preservation Hook
 * 
 * Hook for preserving form input on submission error.
 * Features:
 * - Preserves form values on submission error
 * - Clears form only on successful submission
 * - Tracks dirty state and submission status
 * - Provides error handling per field
 * 
 * Requirements: 5.3
 */

import { useState, useCallback, useRef } from 'react';

/**
 * Form field state with value and error
 */
export interface FormFieldState<T = string> {
  value: T;
  error?: string;
  touched?: boolean;
  dirty?: boolean;
}

/**
 * Form state with multiple fields
 */
export type FormState<T extends Record<string, unknown>> = {
  [K in keyof T]: FormFieldState<T[K]>;
};

/**
 * Options for useFormPreservation hook
 */
export interface UseFormPreservationOptions<T extends Record<string, unknown>> {
  /** Initial values for form fields */
  initialValues: T;
  /** Callback when form is submitted successfully */
  onSuccess?: () => void;
  /** Callback when form submission fails */
  onError?: (error: Error) => void;
}

/**
 * Return type for useFormPreservation hook
 */
export interface UseFormPreservationReturn<T extends Record<string, unknown>> {
  /** Current form values */
  values: T;
  /** Form errors by field */
  errors: Partial<Record<keyof T, string>>;
  /** Whether form has been modified */
  isDirty: boolean;
  /** Whether form is currently submitting */
  isSubmitting: boolean;
  /** Last submission error */
  submissionError: Error | null;
  /** Set a single field value */
  setValue: <K extends keyof T>(field: K, value: T[K]) => void;
  /** Set multiple field values */
  setValues: (values: Partial<T>) => void;
  /** Set a field error */
  setError: <K extends keyof T>(field: K, error: string | undefined) => void;
  /** Set multiple field errors */
  setErrors: (errors: Partial<Record<keyof T, string>>) => void;
  /** Clear all errors */
  clearErrors: () => void;
  /** Reset form to initial values (clears all state) */
  reset: () => void;
  /** Handle form submission with preservation on error */
  handleSubmit: (submitFn: () => Promise<void>) => Promise<void>;
  /** Mark form as successfully submitted (clears values) */
  markSuccess: () => void;
}

/**
 * useFormPreservation - Hook for preserving form input on submission error
 * 
 * @example
 * ```tsx
 * const { values, setValue, handleSubmit, errors, submissionError } = useFormPreservation({
 *   initialValues: { email: '', password: '' }
 * });
 * 
 * const onSubmit = async () => {
 *   await handleSubmit(async () => {
 *     await loginUser(values.email, values.password);
 *   });
 * };
 * ```
 */
export function useFormPreservation<T extends Record<string, unknown>>({
  initialValues,
  onSuccess,
  onError,
}: UseFormPreservationOptions<T>): UseFormPreservationReturn<T> {
  // Form values state
  const [values, setValuesState] = useState<T>(initialValues);
  
  // Form errors state
  const [errors, setErrorsState] = useState<Partial<Record<keyof T, string>>>({});
  
  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<Error | null>(null);
  
  // Track if form has been modified
  const [isDirty, setIsDirty] = useState(false);
  
  // Store initial values for reset
  const initialValuesRef = useRef(initialValues);

  /**
   * Set a single field value
   */
  const setValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValuesState(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    // Clear field error when value changes
    setErrorsState(prev => {
      if (prev[field]) {
        const { [field]: _, ...rest } = prev;
        return rest as Partial<Record<keyof T, string>>;
      }
      return prev;
    });
  }, []);

  /**
   * Set multiple field values
   */
  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState(prev => ({ ...prev, ...newValues }));
    setIsDirty(true);
  }, []);

  /**
   * Set a field error
   */
  const setError = useCallback(<K extends keyof T>(field: K, error: string | undefined) => {
    setErrorsState(prev => {
      if (error === undefined) {
        const { [field]: _, ...rest } = prev;
        return rest as Partial<Record<keyof T, string>>;
      }
      return { ...prev, [field]: error };
    });
  }, []);

  /**
   * Set multiple field errors
   */
  const setErrors = useCallback((newErrors: Partial<Record<keyof T, string>>) => {
    setErrorsState(prev => ({ ...prev, ...newErrors }));
  }, []);

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setErrorsState({});
    setSubmissionError(null);
  }, []);

  /**
   * Reset form to initial values
   */
  const reset = useCallback(() => {
    setValuesState(initialValuesRef.current);
    setErrorsState({});
    setSubmissionError(null);
    setIsDirty(false);
    setIsSubmitting(false);
  }, []);

  /**
   * Mark form as successfully submitted - clears values
   */
  const markSuccess = useCallback(() => {
    setValuesState(initialValuesRef.current);
    setErrorsState({});
    setSubmissionError(null);
    setIsDirty(false);
    setIsSubmitting(false);
    onSuccess?.();
  }, [onSuccess]);

  /**
   * Handle form submission with preservation on error
   * - On success: clears form values
   * - On error: preserves form values, stores error
   */
  const handleSubmit = useCallback(async (submitFn: () => Promise<void>) => {
    setIsSubmitting(true);
    setSubmissionError(null);
    
    try {
      await submitFn();
      // Success - clear form
      markSuccess();
    } catch (error) {
      // Error - preserve form values
      const err = error instanceof Error ? error : new Error(String(error));
      setSubmissionError(err);
      onError?.(err);
      // Values are preserved automatically (not cleared)
    } finally {
      setIsSubmitting(false);
    }
  }, [markSuccess, onError]);

  return {
    values,
    errors,
    isDirty,
    isSubmitting,
    submissionError,
    setValue,
    setValues,
    setError,
    setErrors,
    clearErrors,
    reset,
    handleSubmit,
    markSuccess,
  };
}
