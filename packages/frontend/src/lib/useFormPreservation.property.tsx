import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useFormPreservation } from './useFormPreservation';

/**
 * Feature: uiux-improvements
 * Property 15: Form Input Preservation on Error
 * 
 * For any form submission failure, all user-entered values SHALL be preserved 
 * in the form fields.
 * 
 * Validates: Requirements 5.3
 */

// Arbitrary for generating form field values - simple alphanumeric strings
const fieldValueArbitrary = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/)
  .filter(s => s.length >= 1 && s.length <= 50);

describe('useFormPreservation Property Tests', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  /**
   * Property 15: Form Input Preservation on Error
   * For any form submission failure, all user-entered values SHALL be preserved 
   * in the form fields.
   * Validates: Requirements 5.3
   */
  describe('Property 15: Form Input Preservation on Error', () => {
    it('Should preserve form values when submission fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fieldValueArbitrary,
          fieldValueArbitrary,
          async (email, password) => {
            cleanup();
            
            const { result } = renderHook(() => 
              useFormPreservation({
                initialValues: { email: '', password: '' }
              })
            );
            
            // Set form values
            act(() => {
              result.current.setValue('email', email);
              result.current.setValue('password', password);
            });
            
            // Verify values are set
            expect(result.current.values.email).toBe(email);
            expect(result.current.values.password).toBe(password);
            
            // Submit with failure
            const failingSubmit = async () => {
              throw new Error('Submission failed');
            };
            
            await act(async () => {
              await result.current.handleSubmit(failingSubmit);
            });
            
            // Values should be PRESERVED after failure
            expect(result.current.values.email).toBe(email);
            expect(result.current.values.password).toBe(password);
            
            // Error should be captured
            expect(result.current.submissionError).toBeInstanceOf(Error);
            expect(result.current.submissionError?.message).toBe('Submission failed');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Should clear form values only on successful submission', async () => {
      await fc.assert(
        fc.asyncProperty(
          fieldValueArbitrary,
          fieldValueArbitrary,
          async (email, password) => {
            cleanup();
            
            const { result } = renderHook(() => 
              useFormPreservation({
                initialValues: { email: '', password: '' }
              })
            );
            
            // Set form values
            act(() => {
              result.current.setValue('email', email);
              result.current.setValue('password', password);
            });
            
            // Verify values are set
            expect(result.current.values.email).toBe(email);
            expect(result.current.values.password).toBe(password);
            
            // Submit successfully
            const successfulSubmit = async () => {
              // Success - no error thrown
            };
            
            await act(async () => {
              await result.current.handleSubmit(successfulSubmit);
            });
            
            // Values should be CLEARED after success
            expect(result.current.values.email).toBe('');
            expect(result.current.values.password).toBe('');
            
            // No error should be present
            expect(result.current.submissionError).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Should preserve values across multiple failed submissions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fieldValueArbitrary,
          fc.integer({ min: 2, max: 5 }),
          async (value, failCount) => {
            cleanup();
            
            const { result } = renderHook(() => 
              useFormPreservation({
                initialValues: { field: '' }
              })
            );
            
            // Set form value
            act(() => {
              result.current.setValue('field', value);
            });
            
            // Fail multiple times
            for (let i = 0; i < failCount; i++) {
              await act(async () => {
                await result.current.handleSubmit(async () => {
                  throw new Error(`Failure ${i + 1}`);
                });
              });
              
              // Value should still be preserved
              expect(result.current.values.field).toBe(value);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Should track dirty state correctly', () => {
      fc.assert(
        fc.property(fieldValueArbitrary, (value) => {
          cleanup();
          
          const { result } = renderHook(() => 
            useFormPreservation({
              initialValues: { field: '' }
            })
          );
          
          // Initially not dirty
          expect(result.current.isDirty).toBe(false);
          
          // After setting value, should be dirty
          act(() => {
            result.current.setValue('field', value);
          });
          
          expect(result.current.isDirty).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('Should reset dirty state after successful submission', async () => {
      await fc.assert(
        fc.asyncProperty(fieldValueArbitrary, async (value) => {
          cleanup();
          
          const { result } = renderHook(() => 
            useFormPreservation({
              initialValues: { field: '' }
            })
          );
          
          // Set value (makes dirty)
          act(() => {
            result.current.setValue('field', value);
          });
          
          expect(result.current.isDirty).toBe(true);
          
          // Submit successfully
          await act(async () => {
            await result.current.handleSubmit(async () => {});
          });
          
          // Should no longer be dirty
          expect(result.current.isDirty).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('Should keep dirty state after failed submission', async () => {
      await fc.assert(
        fc.asyncProperty(fieldValueArbitrary, async (value) => {
          cleanup();
          
          const { result } = renderHook(() => 
            useFormPreservation({
              initialValues: { field: '' }
            })
          );
          
          // Set value (makes dirty)
          act(() => {
            result.current.setValue('field', value);
          });
          
          expect(result.current.isDirty).toBe(true);
          
          // Submit with failure
          await act(async () => {
            await result.current.handleSubmit(async () => {
              throw new Error('Failed');
            });
          });
          
          // Should still be dirty (values preserved)
          expect(result.current.isDirty).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Error handling', () => {
    it('Should call onError callback when submission fails', async () => {
      await fc.assert(
        fc.asyncProperty(fieldValueArbitrary, async (errorMessage) => {
          cleanup();
          const onError = vi.fn();
          
          const { result } = renderHook(() => 
            useFormPreservation({
              initialValues: { field: '' },
              onError,
            })
          );
          
          await act(async () => {
            await result.current.handleSubmit(async () => {
              throw new Error(errorMessage);
            });
          });
          
          expect(onError).toHaveBeenCalledTimes(1);
          expect(onError).toHaveBeenCalledWith(expect.any(Error));
        }),
        { numRuns: 50 }
      );
    });

    it('Should call onSuccess callback when submission succeeds', async () => {
      const onSuccess = vi.fn();
      
      const { result } = renderHook(() => 
        useFormPreservation({
          initialValues: { field: '' },
          onSuccess,
        })
      );
      
      await act(async () => {
        await result.current.handleSubmit(async () => {});
      });
      
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  describe('Field errors', () => {
    it('Should clear field error when value changes', () => {
      fc.assert(
        fc.property(fieldValueArbitrary, fieldValueArbitrary, (errorMsg, newValue) => {
          cleanup();
          
          const { result } = renderHook(() => 
            useFormPreservation({
              initialValues: { field: '' }
            })
          );
          
          // Set an error
          act(() => {
            result.current.setError('field', errorMsg);
          });
          
          expect(result.current.errors.field).toBe(errorMsg);
          
          // Change the value
          act(() => {
            result.current.setValue('field', newValue);
          });
          
          // Error should be cleared
          expect(result.current.errors.field).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });

    it('Should preserve field errors when submission fails', async () => {
      await fc.assert(
        fc.asyncProperty(fieldValueArbitrary, async (errorMsg) => {
          cleanup();
          
          const { result } = renderHook(() => 
            useFormPreservation({
              initialValues: { field: '' }
            })
          );
          
          // Set an error
          act(() => {
            result.current.setError('field', errorMsg);
          });
          
          // Submit with failure
          await act(async () => {
            await result.current.handleSubmit(async () => {
              throw new Error('Failed');
            });
          });
          
          // Field error should still be present
          expect(result.current.errors.field).toBe(errorMsg);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Reset functionality', () => {
    it('Should reset all state to initial values', () => {
      fc.assert(
        fc.property(fieldValueArbitrary, fieldValueArbitrary, (value, errorMsg) => {
          cleanup();
          
          const { result } = renderHook(() => 
            useFormPreservation({
              initialValues: { field: 'initial' }
            })
          );
          
          // Modify state
          act(() => {
            result.current.setValue('field', value);
            result.current.setError('field', errorMsg);
          });
          
          // Reset
          act(() => {
            result.current.reset();
          });
          
          // Should be back to initial state
          expect(result.current.values.field).toBe('initial');
          expect(result.current.errors.field).toBeUndefined();
          expect(result.current.isDirty).toBe(false);
          expect(result.current.submissionError).toBeNull();
        }),
        { numRuns: 100 }
      );
    });
  });
});
