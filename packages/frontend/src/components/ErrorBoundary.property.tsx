import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary, ErrorFallback } from './ErrorBoundary';
import React from 'react';

/**
 * Feature: uiux-improvements
 * Property 16: Error Boundary Fallback
 * 
 * For any rendering error caught by ErrorBoundary, a fallback UI SHALL be 
 * displayed instead of a blank screen.
 * 
 * Validates: Requirements 5.4
 */

// Component that throws an error when shouldThrow is true
function ThrowingComponent({ shouldThrow, errorMessage }: { shouldThrow: boolean; errorMessage: string }) {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div data-testid="child-content">Child content rendered successfully</div>;
}

// Arbitrary for generating error messages - simple alphanumeric strings without consecutive spaces
const errorMessageArbitrary = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/)
  .filter(s => s.length >= 2 && s.length <= 50);

describe('ErrorBoundary Property Tests', () => {
  beforeEach(() => {
    cleanup();
    // Suppress console.error for cleaner test output (errors are expected)
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  /**
   * Property 16: Error Boundary Fallback
   * For any rendering error caught by ErrorBoundary, a fallback UI SHALL be 
   * displayed instead of a blank screen.
   * Validates: Requirements 5.4
   */
  describe('Property 16: Error Boundary Fallback', () => {
    it('Should display fallback UI for any error message', () => {
      fc.assert(
        fc.property(errorMessageArbitrary, (errorMessage) => {
          cleanup();
          
          render(
            <ErrorBoundary>
              <ThrowingComponent shouldThrow={true} errorMessage={errorMessage} />
            </ErrorBoundary>
          );
          
          // Fallback UI should be displayed (not a blank screen)
          expect(screen.getByText('Something went wrong')).toBeInTheDocument();
          
          // Should have recovery options
          expect(screen.getByText('Try Again')).toBeInTheDocument();
          expect(screen.getByText('Refresh Page')).toBeInTheDocument();
          expect(screen.getByText('Return to Home')).toBeInTheDocument();
          
          // Child content should NOT be rendered
          expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();
        }),
        { numRuns: 100 }
      );
    });

    it('Should render children normally when no error occurs', () => {
      fc.assert(
        fc.property(errorMessageArbitrary, (content) => {
          cleanup();
          
          render(
            <ErrorBoundary>
              <div data-testid="normal-content">{content}</div>
            </ErrorBoundary>
          );
          
          // Child content should be rendered
          expect(screen.getByTestId('normal-content')).toBeInTheDocument();
          
          // Fallback UI should NOT be displayed
          expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
        }),
        { numRuns: 100 }
      );
    });

    it('Should call onError callback when error is caught', () => {
      fc.assert(
        fc.property(errorMessageArbitrary, (errorMessage) => {
          cleanup();
          const onError = vi.fn();
          
          render(
            <ErrorBoundary onError={onError}>
              <ThrowingComponent shouldThrow={true} errorMessage={errorMessage} />
            </ErrorBoundary>
          );
          
          // onError should have been called
          expect(onError).toHaveBeenCalledTimes(1);
          
          // First argument should be the error
          const [error] = onError.mock.calls[0];
          expect(error).toBeInstanceOf(Error);
          expect(error.message).toBe(errorMessage);
        }),
        { numRuns: 100 }
      );
    });

    it('Should use custom fallback when provided', () => {
      fc.assert(
        fc.property(
          errorMessageArbitrary,
          errorMessageArbitrary,
          (errorMessage, customFallbackText) => {
            cleanup();
            
            render(
              <ErrorBoundary fallback={<div data-testid="custom-fallback">{customFallbackText}</div>}>
                <ThrowingComponent shouldThrow={true} errorMessage={errorMessage} />
              </ErrorBoundary>
            );
            
            // Custom fallback should be displayed
            expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
            
            // Default fallback should NOT be displayed
            expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('ErrorFallback Component', () => {
    it('Should display error message when provided', () => {
      fc.assert(
        fc.property(errorMessageArbitrary, (errorMessage) => {
          cleanup();
          
          const error = new Error(errorMessage);
          render(<ErrorFallback error={error} />);
          
          // Should display the error message
          expect(screen.getByText(errorMessage)).toBeInTheDocument();
          
          // Should have heading
          expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        }),
        { numRuns: 100 }
      );
    });

    it('Should call resetErrorBoundary when Try Again is clicked', async () => {
      const user = userEvent.setup();
      const resetFn = vi.fn();
      
      render(<ErrorFallback error={new Error('Test error')} resetErrorBoundary={resetFn} />);
      
      const tryAgainButton = screen.getByText('Try Again');
      await user.click(tryAgainButton);
      
      expect(resetFn).toHaveBeenCalledTimes(1);
    });

    it('Should have Return to Home link', () => {
      render(<ErrorFallback error={new Error('Test error')} />);
      
      const homeLink = screen.getByText('Return to Home');
      expect(homeLink).toBeInTheDocument();
      expect(homeLink).toHaveAttribute('href', '/');
    });

    it('Should display generic message when error message contains "Error:"', () => {
      fc.assert(
        fc.property(
          errorMessageArbitrary,
          (suffix) => {
            cleanup();
            
            const error = new Error(`Error: ${suffix}`);
            render(<ErrorFallback error={error} />);
            
            // Should display generic message instead of technical error
            expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('onReset callback', () => {
    it('Should call onReset when resetErrorBoundary is triggered', async () => {
      const user = userEvent.setup();
      const onReset = vi.fn();
      
      // Create a component that can toggle error state
      function TestComponent() {
        const [shouldThrow, setShouldThrow] = React.useState(true);
        
        return (
          <ErrorBoundary 
            onReset={() => {
              onReset();
              setShouldThrow(false);
            }}
          >
            <ThrowingComponent shouldThrow={shouldThrow} errorMessage="Test error" />
          </ErrorBoundary>
        );
      }
      
      render(<TestComponent />);
      
      // Should show fallback
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      
      // Click Try Again
      const tryAgainButton = screen.getByText('Try Again');
      await user.click(tryAgainButton);
      
      // onReset should have been called
      expect(onReset).toHaveBeenCalledTimes(1);
    });
  });
});
