import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorMessage, ErrorMessageVariant } from './ErrorMessage';

/**
 * Feature: uiux-improvements
 * Property 13: Error State with Retry
 * 
 * For any failed data fetch, an error message SHALL be displayed AND 
 * a retry button SHALL be available.
 * 
 * Validates: Requirements 4.5, 5.1, 5.2
 */

// Arbitrary for generating error messages - simple alphanumeric strings
const errorMessageArbitrary = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/)
  .filter(s => s.length >= 2 && s.length <= 50);

// Arbitrary for error message variants
const variantArbitrary = fc.constantFrom<ErrorMessageVariant>('inline', 'block', 'toast');

describe('ErrorMessage Property Tests', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 13: Error State with Retry
   * For any failed data fetch, an error message SHALL be displayed AND 
   * a retry button SHALL be available.
   * Validates: Requirements 4.5, 5.1, 5.2
   */
  describe('Property 13: Error State with Retry', () => {
    it('Should display error message for any error string', () => {
      fc.assert(
        fc.property(errorMessageArbitrary, variantArbitrary, (errorMessage, variant) => {
          cleanup();
          
          render(
            <ErrorMessage error={errorMessage} variant={variant} />
          );
          
          // Error message should be displayed
          expect(screen.getByRole('alert')).toBeInTheDocument();
          expect(screen.getByText(errorMessage)).toBeInTheDocument();
        }),
        { numRuns: 100 }
      );
    });

    it('Should display error message for any Error object', () => {
      fc.assert(
        fc.property(errorMessageArbitrary, variantArbitrary, (errorMessage, variant) => {
          cleanup();
          
          const error = new Error(errorMessage);
          render(
            <ErrorMessage error={error} variant={variant} />
          );
          
          // Error message should be displayed
          expect(screen.getByRole('alert')).toBeInTheDocument();
          expect(screen.getByText(errorMessage)).toBeInTheDocument();
        }),
        { numRuns: 100 }
      );
    });

    it('Should show retry button when onRetry is provided', () => {
      fc.assert(
        fc.property(errorMessageArbitrary, variantArbitrary, (errorMessage, variant) => {
          cleanup();
          const onRetry = vi.fn();
          
          render(
            <ErrorMessage error={errorMessage} variant={variant} onRetry={onRetry} />
          );
          
          // Retry button should be available
          const retryButton = screen.getByRole('button', { name: /try again/i });
          expect(retryButton).toBeInTheDocument();
        }),
        { numRuns: 100 }
      );
    });

    it('Should NOT show retry button when onRetry is not provided', () => {
      fc.assert(
        fc.property(errorMessageArbitrary, variantArbitrary, (errorMessage, variant) => {
          cleanup();
          
          render(
            <ErrorMessage error={errorMessage} variant={variant} />
          );
          
          // Retry button should NOT be present
          expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
        }),
        { numRuns: 100 }
      );
    });

    it('Should call onRetry when retry button is clicked', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(errorMessageArbitrary, variantArbitrary, async (errorMessage, variant) => {
          cleanup();
          const onRetry = vi.fn();
          
          render(
            <ErrorMessage error={errorMessage} variant={variant} onRetry={onRetry} />
          );
          
          // Click retry button
          const retryButton = screen.getByRole('button', { name: /try again/i });
          await user.click(retryButton);
          
          // onRetry should have been called
          expect(onRetry).toHaveBeenCalledTimes(1);
        }),
        { numRuns: 50 } // Reduced for async tests
      );
    });

    it('Should render nothing when error is null', () => {
      fc.assert(
        fc.property(variantArbitrary, (variant) => {
          cleanup();
          
          const { container } = render(
            <ErrorMessage error={null} variant={variant} />
          );
          
          // Should render nothing
          expect(container.firstChild).toBeNull();
        }),
        { numRuns: 10 }
      );
    });

    it('Should use custom retry text when provided', () => {
      fc.assert(
        fc.property(
          errorMessageArbitrary, 
          variantArbitrary,
          errorMessageArbitrary, // Use as custom retry text
          (errorMessage, variant, customRetryText) => {
            cleanup();
            const onRetry = vi.fn();
            
            render(
              <ErrorMessage 
                error={errorMessage} 
                variant={variant} 
                onRetry={onRetry}
                retryText={customRetryText}
              />
            );
            
            // Custom retry text should be displayed
            expect(screen.getByRole('button', { name: customRetryText })).toBeInTheDocument();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Variant-specific behavior', () => {
    it('Inline variant should have compact styling', () => {
      render(
        <ErrorMessage error="Test error" variant="inline" />
      );
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('flex', 'items-center');
    });

    it('Block variant should have full-width styling', () => {
      render(
        <ErrorMessage error="Test error" variant="block" />
      );
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('py-4', 'px-6');
    });

    it('Toast variant should have notification styling', () => {
      render(
        <ErrorMessage error="Test error" variant="toast" />
      );
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('rounded-lg', 'shadow-md');
    });

    it('Should default to inline variant when not specified', () => {
      render(
        <ErrorMessage error="Test error" />
      );
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('flex', 'items-center');
    });
  });

  describe('Accessibility', () => {
    it('Should have proper ARIA attributes for all variants', () => {
      fc.assert(
        fc.property(errorMessageArbitrary, variantArbitrary, (errorMessage, variant) => {
          cleanup();
          
          render(
            <ErrorMessage error={errorMessage} variant={variant} />
          );
          
          const alert = screen.getByRole('alert');
          expect(alert).toHaveAttribute('aria-live');
        }),
        { numRuns: 30 }
      );
    });

    it('Toast variant should use assertive aria-live', () => {
      render(
        <ErrorMessage error="Test error" variant="toast" />
      );
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });

    it('Inline and block variants should use polite aria-live', () => {
      const variants: ErrorMessageVariant[] = ['inline', 'block'];
      
      variants.forEach(variant => {
        cleanup();
        render(
          <ErrorMessage error="Test error" variant={variant} />
        );
        
        const alert = screen.getByRole('alert');
        expect(alert).toHaveAttribute('aria-live', 'polite');
      });
    });
  });
});
