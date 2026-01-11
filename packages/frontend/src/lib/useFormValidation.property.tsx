import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { 
  useFormValidation, 
  required, 
  email, 
  minLength,
  FieldConfig,
} from './useFormValidation';
import { FormField } from '../components/common/FormField';

/**
 * Feature: uiux-improvements
 * Form Validation Property Tests
 * 
 * Property 21: Form Validation Behavior
 * For any form field with validation rules:
 * - Validation SHALL run on blur AND on submit
 * - Error messages SHALL appear below invalid fields
 * - Error messages SHALL clear when the field becomes valid
 * Validates: Requirements 7.1, 7.2, 7.3
 */

// Test component that uses the form validation hook with proper re-rendering
function TestForm({ 
  fields, 
  onValidateAll 
}: { 
  fields: Record<string, FieldConfig>;
  onValidateAll?: (isValid: boolean) => void;
}) {
  const form = useFormValidation(fields);
  // Force re-render on state changes by using the form values
  const [, forceUpdate] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = form.validateAll();
    forceUpdate(n => n + 1);
    onValidateAll?.(isValid);
  };

  return (
    <form onSubmit={handleSubmit} data-testid="test-form">
      {Object.keys(fields).map((fieldName) => {
        const fieldProps = form.getFieldProps(fieldName);
        return (
          <div key={fieldName} data-testid={`field-${fieldName}`}>
            <FormField
              name={fieldName}
              label={fieldName}
              value={fieldProps.value}
              onChange={(val) => {
                fieldProps.onChange(val);
                forceUpdate(n => n + 1);
              }}
              onBlur={() => {
                fieldProps.onBlur();
                forceUpdate(n => n + 1);
              }}
              error={fieldProps.error}
              touched={form.touched[fieldName]}
              ref={form.fieldRefs[fieldName]}
            />
          </div>
        );
      })}
      <button type="submit" data-testid="submit-btn">Submit</button>
    </form>
  );
}

// Arbitrary for generating alphanumeric strings (safe for userEvent.type)
const safeStringArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'),
  { minLength: 1, maxLength: 20 }
);

describe('Form Validation Property Tests', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 21: Form Validation Behavior
   * Validates: Requirements 7.1, 7.2, 7.3
   */
  describe('Property 21: Form Validation Behavior', () => {
    it('Validation SHALL run on blur - error appears after blur on invalid field', async () => {
      const user = userEvent.setup();
      
      const fields = {
        testField: {
          initialValue: '',
          rules: [required('This field is required')],
        },
      };
      
      render(<TestForm fields={fields} />);
      
      const input = screen.getByRole('textbox');
      
      // Focus and immediately blur without typing (empty field)
      await user.click(input);
      await user.tab();
      
      // After blur, error should appear (Requirements 7.1, 7.3)
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('This field is required')).toBeInTheDocument();
      });
    });

    it('Validation SHALL run on submit - all errors appear on submit', async () => {
      const user = userEvent.setup();
      
      let validationResult: boolean | null = null;
      
      const fields = {
        email: {
          initialValue: '',
          rules: [required('Email is required'), email('Invalid email')],
        },
        password: {
          initialValue: '',
          rules: [required('Password is required'), minLength(8, 'Min 8 characters')],
        },
      };
      
      render(
        <TestForm 
          fields={fields} 
          onValidateAll={(isValid) => { validationResult = isValid; }}
        />
      );
      
      // Submit without filling fields
      const submitBtn = screen.getByTestId('submit-btn');
      await user.click(submitBtn);
      
      // Validation should fail
      expect(validationResult).toBe(false);
      
      // Both error messages should appear (Requirements 7.1, 7.3)
      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
        expect(screen.getByText('Password is required')).toBeInTheDocument();
      });
    });

    it('Error messages SHALL clear when field becomes valid (Requirements 7.2)', async () => {
      const user = userEvent.setup();
      
      const fields = {
        testField: {
          initialValue: '',
          rules: [required('This field is required')],
        },
      };
      
      render(<TestForm fields={fields} />);
      
      const input = screen.getByRole('textbox');
      
      // Blur empty field to trigger error
      await user.click(input);
      await user.tab();
      
      // Error should appear
      await waitFor(() => {
        expect(screen.getByText('This field is required')).toBeInTheDocument();
      });
      
      // Type valid value - error should clear
      await user.click(input);
      await user.type(input, 'validvalue');
      
      // Error should clear when value becomes valid (Requirements 7.2)
      await waitFor(() => {
        expect(screen.queryByText('This field is required')).not.toBeInTheDocument();
      });
    });

    it('Error messages SHALL appear below invalid fields (Requirements 7.1)', async () => {
      const user = userEvent.setup();
      
      const fields = {
        username: {
          initialValue: '',
          rules: [required('Username is required')],
        },
      };
      
      render(<TestForm fields={fields} />);
      
      const input = screen.getByRole('textbox');
      const fieldContainer = screen.getByTestId('field-username');
      
      // Blur empty field to trigger validation
      await user.click(input);
      await user.tab();
      
      // Error should be within the field container (below the field)
      await waitFor(() => {
        const errorElement = screen.getByRole('alert');
        expect(fieldContainer.contains(errorElement)).toBe(true);
      });
    });

    it('Valid input should not show errors after blur - property test', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(safeStringArb, async (validValue) => {
          cleanup();
          
          const fields = {
            testField: {
              initialValue: '',
              rules: [required('This field is required')],
            },
          };
          
          render(<TestForm fields={fields} />);
          
          const input = screen.getByRole('textbox');
          
          // Type valid value first, then blur
          await user.type(input, validValue);
          await user.tab();
          
          // No error should appear for valid input
          expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        }),
        { numRuns: 50 }
      );
    }, 60000);

    it('minLength validation should correctly validate string length - property test', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (shortLength) => {
            cleanup();
            
            const minLen = 8;
            const shortString = 'a'.repeat(shortLength);
            
            const fields = {
              testField: {
                initialValue: '',
                rules: [minLength(minLen, `Min ${minLen} characters`)],
              },
            };
            
            render(<TestForm fields={fields} />);
            
            const input = screen.getByRole('textbox');
            await user.type(input, shortString);
            await user.tab();
            
            // Error should appear for short string
            await waitFor(() => {
              expect(screen.getByText(`Min ${minLen} characters`)).toBeInTheDocument();
            });
          }
        ),
        { numRuns: 50 }
      );
    }, 60000);

    it('Long enough strings should pass minLength validation - property test', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 8, max: 12 }),
          async (longLength) => {
            cleanup();
            
            const minLen = 8;
            const longString = 'a'.repeat(longLength);
            
            const fields = {
              password: {
                initialValue: '',
                rules: [minLength(minLen, `Min ${minLen} characters`)],
              },
            };
            
            render(<TestForm fields={fields} />);
            
            const input = screen.getByRole('textbox');
            await user.type(input, longString);
            await user.tab();
            
            // No error should appear for long enough string
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
          }
        ),
        { numRuns: 50 }
      );
    }, 60000);
  });

  /**
   * Property 22: Invalid Form Focus
   * For any form submission with validation errors, focus SHALL move to the first invalid field.
   * Validates: Requirements 7.4
   */
  describe('Property 22: Invalid Form Focus', () => {
    it('Focus SHALL move to first invalid field on submit', async () => {
      const user = userEvent.setup();
      
      const fields = {
        firstName: {
          initialValue: '',
          rules: [required('First name is required')],
        },
        lastName: {
          initialValue: '',
          rules: [required('Last name is required')],
        },
        email: {
          initialValue: '',
          rules: [required('Email is required')],
        },
      };
      
      render(<TestForm fields={fields} />);
      
      // Submit without filling any fields
      const submitBtn = screen.getByTestId('submit-btn');
      await user.click(submitBtn);
      
      // First invalid field (firstName) should be focused
      await waitFor(() => {
        const firstInput = screen.getByTestId('field-firstName').querySelector('input');
        expect(document.activeElement).toBe(firstInput);
      });
    });

    it('Focus SHALL move to first invalid field when some fields are valid - property test', async () => {
      const user = userEvent.setup();
      
      // Test with different numbers of valid fields before the first invalid one
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 2 }),
          async (validFieldCount) => {
            cleanup();
            
            const fieldNames = ['field1', 'field2', 'field3'];
            const fields: Record<string, FieldConfig> = {};
            
            // Create fields - some valid (with initial values), some invalid (empty)
            fieldNames.forEach((name, index) => {
              fields[name] = {
                initialValue: index < validFieldCount ? 'validvalue' : '',
                rules: [required(`${name} is required`)],
              };
            });
            
            render(<TestForm fields={fields} />);
            
            // Submit form
            const submitBtn = screen.getByTestId('submit-btn');
            await user.click(submitBtn);
            
            // The first invalid field should be focused
            const firstInvalidFieldName = fieldNames[validFieldCount];
            if (firstInvalidFieldName) {
              await waitFor(() => {
                const firstInvalidInput = screen.getByTestId(`field-${firstInvalidFieldName}`).querySelector('input');
                expect(document.activeElement).toBe(firstInvalidInput);
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('No focus change when all fields are valid', async () => {
      const user = userEvent.setup();
      
      let validationResult: boolean | null = null;
      
      const fields = {
        firstName: {
          initialValue: 'John',
          rules: [required('First name is required')],
        },
        lastName: {
          initialValue: 'Doe',
          rules: [required('Last name is required')],
        },
      };
      
      render(
        <TestForm 
          fields={fields} 
          onValidateAll={(isValid) => { validationResult = isValid; }}
        />
      );
      
      // Submit with all valid fields
      const submitBtn = screen.getByTestId('submit-btn');
      await user.click(submitBtn);
      
      // Validation should pass
      expect(validationResult).toBe(true);
      
      // No errors should appear
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  /**
   * Property 23: Character Count Display
   * For any form field with a character limit, the current character count 
   * SHALL be displayed and updated on each keystroke.
   * Validates: Requirements 7.5
   */
  describe('Property 23: Character Count Display', () => {
    it('Character count SHALL be displayed when showCharCount is true', () => {
      render(
        <form>
          <FormField
            name="description"
            label="Description"
            value=""
            onChange={() => {}}
            maxLength={100}
            showCharCount={true}
          />
        </form>
      );
      
      // Character count should be displayed
      expect(screen.getByText('0/100')).toBeInTheDocument();
    });

    it('Character count SHALL update on each keystroke - property test', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (charCount) => {
            cleanup();
            
            const maxLength = 100;
            const testString = 'a'.repeat(charCount);
            
            // Create a controlled component for testing
            function ControlledFormField() {
              const [value, setValue] = useState('');
              return (
                <form>
                  <FormField
                    name="description"
                    label="Description"
                    value={value}
                    onChange={setValue}
                    maxLength={maxLength}
                    showCharCount={true}
                  />
                </form>
              );
            }
            
            render(<ControlledFormField />);
            
            const input = screen.getByRole('textbox');
            
            // Type characters
            await user.type(input, testString);
            
            // Character count should match typed length
            expect(screen.getByText(`${charCount}/${maxLength}`)).toBeInTheDocument();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Character count SHALL show warning style when over limit', async () => {
      const user = userEvent.setup();
      
      const maxLength = 10;
      
      function ControlledFormField() {
        const [value, setValue] = useState('');
        return (
          <form>
            <FormField
              name="description"
              label="Description"
              value={value}
              onChange={setValue}
              maxLength={maxLength}
              showCharCount={true}
            />
          </form>
        );
      }
      
      render(<ControlledFormField />);
      
      const input = screen.getByRole('textbox');
      
      // Type more than max length
      await user.type(input, 'a'.repeat(15));
      
      // Character count should show over limit
      const countElement = screen.getByText('15/10');
      expect(countElement).toBeInTheDocument();
      // Should have warning style (text-oppose class)
      expect(countElement).toHaveClass('text-oppose');
    });

    it('Character count SHALL not show warning when under limit', async () => {
      const user = userEvent.setup();
      
      const maxLength = 20;
      
      function ControlledFormField() {
        const [value, setValue] = useState('');
        return (
          <form>
            <FormField
              name="description"
              label="Description"
              value={value}
              onChange={setValue}
              maxLength={maxLength}
              showCharCount={true}
            />
          </form>
        );
      }
      
      render(<ControlledFormField />);
      
      const input = screen.getByRole('textbox');
      
      // Type less than max length
      await user.type(input, 'hello');
      
      // Character count should show under limit
      const countElement = screen.getByText('5/20');
      expect(countElement).toBeInTheDocument();
      // Should have normal style (text-text-tertiary class)
      expect(countElement).toHaveClass('text-text-tertiary');
    });
  });
});
