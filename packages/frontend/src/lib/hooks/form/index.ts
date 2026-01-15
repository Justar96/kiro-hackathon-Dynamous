/**
 * Form Hooks Index
 * 
 * Hooks for form state management, validation, and preservation.
 */

// Form preservation
export { useFormPreservation } from './useFormPreservation';
export type {
  FormFieldState,
  FormState,
  UseFormPreservationOptions,
  UseFormPreservationReturn,
} from './useFormPreservation';

// Form validation
export {
  useFormValidation,
  required,
  email,
  minLength,
  maxLength,
  pattern,
  custom,
} from './useFormValidation';
export type {
  ValidationRule,
  FieldConfig,
  FieldState,
  FieldHandlers,
  UseFormValidationReturn,
} from './useFormValidation';

// Unsaved changes warning
export { useUnsavedChanges, useUnsavedChangesControl } from './useUnsavedChanges';
export type { UseUnsavedChangesOptions } from './useUnsavedChanges';
