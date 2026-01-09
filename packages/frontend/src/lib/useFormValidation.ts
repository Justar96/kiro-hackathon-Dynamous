import { useState, useCallback, useRef, useMemo } from 'react';

/**
 * Validation rule function type.
 * Returns error message string if invalid, undefined if valid.
 */
export type ValidationRule<T> = (value: T, formValues: Record<string, unknown>) => string | undefined;

/**
 * Field configuration for validation
 */
export interface FieldConfig<T = string> {
  /** Initial value for the field */
  initialValue: T;
  /** Array of validation rules to apply */
  rules?: ValidationRule<T>[];
  /** Whether to validate on blur (default: true) */
  validateOnBlur?: boolean;
}

/**
 * Form field state
 */
export interface FieldState<T = string> {
  /** Current field value */
  value: T;
  /** Current error message (if any) */
  error: string | undefined;
  /** Whether field has been touched (blurred) */
  touched: boolean;
  /** Whether field value differs from initial */
  dirty: boolean;
}

/**
 * Field handlers returned by the hook
 */
export interface FieldHandlers<T = string> {
  /** Update field value */
  setValue: (value: T) => void;
  /** Handle blur event - triggers validation */
  onBlur: () => void;
  /** Clear field error */
  clearError: () => void;
  /** Reset field to initial state */
  reset: () => void;
}

/**
 * Return type for useFormValidation hook
 */
export interface UseFormValidationReturn<TFields extends Record<string, FieldConfig>> {
  /** Current values for all fields */
  values: { [K in keyof TFields]: TFields[K]['initialValue'] };
  /** Current errors for all fields */
  errors: { [K in keyof TFields]: string | undefined };
  /** Touched state for all fields */
  touched: { [K in keyof TFields]: boolean };
  /** Dirty state for all fields */
  dirty: { [K in keyof TFields]: boolean };
  /** Whether the entire form is valid */
  isValid: boolean;
  /** Whether any field has been modified */
  isDirty: boolean;
  /** Get handlers for a specific field */
  getFieldProps: <K extends keyof TFields>(name: K) => {
    value: TFields[K]['initialValue'];
    error: string | undefined;
    onChange: (value: TFields[K]['initialValue']) => void;
    onBlur: () => void;
  };
  /** Validate all fields and return validity */
  validateAll: () => boolean;
  /** Reset all fields to initial state */
  resetForm: () => void;
  /** Set a specific field's error manually */
  setFieldError: (name: keyof TFields, error: string | undefined) => void;
  /** Refs for focusing fields */
  fieldRefs: { [K in keyof TFields]: React.RefObject<HTMLInputElement | HTMLTextAreaElement> };
  /** Focus the first invalid field */
  focusFirstInvalid: () => void;
}

/**
 * useFormValidation hook for managing form state and validation.
 * Validates on blur and submit, tracks touched/dirty state,
 * and focuses first invalid field on submit.
 * 
 * Requirements: 7.3, 7.4
 * 
 * @example
 * ```tsx
 * const form = useFormValidation({
 *   email: {
 *     initialValue: '',
 *     rules: [required('Email is required'), email('Invalid email')],
 *   },
 *   password: {
 *     initialValue: '',
 *     rules: [required('Password is required'), minLength(8, 'Min 8 characters')],
 *   },
 * });
 * 
 * const handleSubmit = (e: FormEvent) => {
 *   e.preventDefault();
 *   if (form.validateAll()) {
 *     // Submit form
 *   }
 * };
 * ```
 */
export function useFormValidation<TFields extends Record<string, FieldConfig>>(
  fields: TFields
): UseFormValidationReturn<TFields> {
  type FieldNames = keyof TFields;
  type Values = { [K in FieldNames]: TFields[K]['initialValue'] };
  type Errors = { [K in FieldNames]: string | undefined };
  type TouchedState = { [K in FieldNames]: boolean };
  type DirtyState = { [K in FieldNames]: boolean };

  // Initialize state from field configs
  const initialValues = useMemo(() => {
    const values = {} as Values;
    for (const key in fields) {
      values[key as FieldNames] = fields[key].initialValue;
    }
    return values;
  }, [fields]);

  const [values, setValues] = useState<Values>(initialValues);
  const [errors, setErrors] = useState<Errors>(() => {
    const errs = {} as Errors;
    for (const key in fields) {
      errs[key as FieldNames] = undefined;
    }
    return errs;
  });
  const [touched, setTouched] = useState<TouchedState>(() => {
    const t = {} as TouchedState;
    for (const key in fields) {
      t[key as FieldNames] = false;
    }
    return t;
  });

  // Create refs for each field
  const fieldRefs = useMemo(() => {
    const refs = {} as { [K in FieldNames]: React.RefObject<HTMLInputElement | HTMLTextAreaElement> };
    for (const key in fields) {
      refs[key as FieldNames] = { current: null } as React.RefObject<HTMLInputElement | HTMLTextAreaElement>;
    }
    return refs;
  }, [fields]);

  // Store refs in a ref to avoid recreating on each render
  const refsRef = useRef(fieldRefs);

  // Calculate dirty state
  const dirty = useMemo(() => {
    const d = {} as DirtyState;
    for (const key in fields) {
      d[key as FieldNames] = values[key as FieldNames] !== fields[key].initialValue;
    }
    return d;
  }, [values, fields]);

  // Validate a single field
  const validateField = useCallback(
    (name: FieldNames, value: unknown): string | undefined => {
      const config = fields[name as string];
      if (!config.rules) return undefined;

      for (const rule of config.rules) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const error = (rule as ValidationRule<any>)(value, values as Record<string, unknown>);
        if (error) return error;
      }
      return undefined;
    },
    [fields, values]
  );

  // Set field value
  const setValue = useCallback(
    (name: FieldNames, value: unknown) => {
      setValues((prev) => ({ ...prev, [name]: value }));
      
      // Clear error if value becomes valid (Requirements 7.2)
      const error = validateField(name, value);
      if (!error) {
        setErrors((prev) => ({ ...prev, [name]: undefined }));
      }
    },
    [validateField]
  );

  // Handle field blur - validate on blur (Requirements 7.3)
  const handleBlur = useCallback(
    (name: FieldNames) => {
      setTouched((prev) => ({ ...prev, [name]: true }));
      
      const config = fields[name as string];
      if (config.validateOnBlur !== false) {
        const error = validateField(name, values[name]);
        setErrors((prev) => ({ ...prev, [name]: error }));
      }
    },
    [fields, validateField, values]
  );

  // Get props for a field
  const getFieldProps = useCallback(
    <K extends FieldNames>(name: K) => ({
      value: values[name],
      error: errors[name],
      onChange: (value: TFields[K]['initialValue']) => setValue(name, value),
      onBlur: () => handleBlur(name),
    }),
    [values, errors, setValue, handleBlur]
  );

  // Validate all fields (Requirements 7.3)
  const validateAll = useCallback((): boolean => {
    const newErrors = {} as Errors;
    let firstInvalidField: FieldNames | null = null;

    for (const key in fields) {
      const name = key as FieldNames;
      const error = validateField(name, values[name]);
      newErrors[name] = error;
      
      if (error && firstInvalidField === null) {
        firstInvalidField = name;
      }
    }

    setErrors(newErrors);
    
    // Mark all fields as touched
    const allTouched = {} as TouchedState;
    for (const key in fields) {
      allTouched[key as FieldNames] = true;
    }
    setTouched(allTouched);

    // Focus first invalid field (Requirements 7.4)
    if (firstInvalidField !== null) {
      const ref = refsRef.current[firstInvalidField];
      ref?.current?.focus();
    }

    return !Object.values(newErrors).some(Boolean);
  }, [fields, validateField, values]);

  // Focus first invalid field
  const focusFirstInvalid = useCallback(() => {
    for (const key in fields) {
      const name = key as FieldNames;
      if (errors[name]) {
        const ref = refsRef.current[name];
        ref?.current?.focus();
        return;
      }
    }
  }, [fields, errors]);

  // Reset form to initial state
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors(() => {
      const errs = {} as Errors;
      for (const key in fields) {
        errs[key as FieldNames] = undefined;
      }
      return errs;
    });
    setTouched(() => {
      const t = {} as TouchedState;
      for (const key in fields) {
        t[key as FieldNames] = false;
      }
      return t;
    });
  }, [initialValues, fields]);

  // Set field error manually
  const setFieldError = useCallback((name: FieldNames, error: string | undefined) => {
    setErrors((prev) => ({ ...prev, [name]: error }));
  }, []);

  // Calculate overall validity
  const isValid = useMemo(() => {
    for (const key in fields) {
      const error = validateField(key as FieldNames, values[key as FieldNames]);
      if (error) return false;
    }
    return true;
  }, [fields, validateField, values]);

  // Calculate overall dirty state
  const isDirty = useMemo(() => {
    return Object.values(dirty).some(Boolean);
  }, [dirty]);

  return {
    values,
    errors,
    touched,
    dirty,
    isValid,
    isDirty,
    getFieldProps,
    validateAll,
    resetForm,
    setFieldError,
    fieldRefs: refsRef.current,
    focusFirstInvalid,
  };
}

// ============================================================================
// Common Validation Rules
// ============================================================================

/**
 * Required field validation rule
 */
export function required(message = 'This field is required'): ValidationRule<string> {
  return (value) => {
    if (!value || value.trim() === '') {
      return message;
    }
    return undefined;
  };
}

/**
 * Email validation rule
 */
export function email(message = 'Please enter a valid email address'): ValidationRule<string> {
  return (value) => {
    if (!value) return undefined; // Let required handle empty
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return message;
    }
    return undefined;
  };
}

/**
 * Minimum length validation rule
 */
export function minLength(min: number, message?: string): ValidationRule<string> {
  return (value) => {
    if (!value) return undefined; // Let required handle empty
    if (value.length < min) {
      return message || `Must be at least ${min} characters`;
    }
    return undefined;
  };
}

/**
 * Maximum length validation rule
 */
export function maxLength(max: number, message?: string): ValidationRule<string> {
  return (value) => {
    if (!value) return undefined;
    if (value.length > max) {
      return message || `Must be at most ${max} characters`;
    }
    return undefined;
  };
}

/**
 * Pattern validation rule
 */
export function pattern(regex: RegExp, message: string): ValidationRule<string> {
  return (value) => {
    if (!value) return undefined;
    if (!regex.test(value)) {
      return message;
    }
    return undefined;
  };
}

/**
 * Custom validation rule
 */
export function custom<T>(
  validator: (value: T) => boolean,
  message: string
): ValidationRule<T> {
  return (value) => {
    if (!validator(value)) {
      return message;
    }
    return undefined;
  };
}

export default useFormValidation;
