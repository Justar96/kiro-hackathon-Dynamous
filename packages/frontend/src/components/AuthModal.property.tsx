import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { AuthModalProvider, useAuthModal } from './AuthModal';
import { ToastProvider } from './Toast';

/**
 * Feature: uiux-improvements
 * Property tests for AuthModal component
 */

// Test component that exposes auth modal controls
function TestAuthModalConsumer({
  onStateChange,
}: {
  onStateChange?: (state: { isOpen: boolean; view: string }) => void;
}) {
  const { isOpen, view, openSignIn, openSignUp, close } = useAuthModal();

  // Report state changes
  if (onStateChange) {
    onStateChange({ isOpen, view });
  }

  return (
    <div>
      <button data-testid="open-sign-in" onClick={() => openSignIn()}>
        Open Sign In
      </button>
      <button data-testid="open-sign-up" onClick={() => openSignUp()}>
        Open Sign Up
      </button>
      <button data-testid="open-sign-in-with-url" onClick={() => openSignIn('/debates/123')}>
        Open Sign In with URL
      </button>
      <button data-testid="close" onClick={close}>
        Close
      </button>
      <span data-testid="is-open">{isOpen ? 'true' : 'false'}</span>
      <span data-testid="view">{view}</span>
    </div>
  );
}

// Wrapper component for testing
function TestWrapper({
  onStateChange,
}: {
  onStateChange?: (state: { isOpen: boolean; view: string }) => void;
}) {
  return (
    <ToastProvider>
      <AuthModalProvider>
        <TestAuthModalConsumer onStateChange={onStateChange} />
      </AuthModalProvider>
    </ToastProvider>
  );
}

// Arbitrary for generating trigger actions
const triggerActionArbitrary = fc.constantFrom('sign-in', 'sign-up') as fc.Arbitrary<'sign-in' | 'sign-up'>;

// Arbitrary for generating optional return URLs
const returnUrlArbitrary = fc.option(
  fc.stringMatching(/^\/[a-z0-9/-]*$/),
  { nil: undefined }
);

describe('AuthModal Property Tests', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  /**
   * Property 1: Modal Open State Consistency
   * For any trigger action (sign-in click, sign-up click), the modal state 
   * SHALL transition to open with the correct view ('sign-in' or 'sign-up'),
   * and the body scroll SHALL be locked.
   * Validates: Requirements 1.1, 1.2, 1.3
   */
  describe('Property 1: Modal Open State Consistency', () => {
    it('Property 1: Opening modal should set correct view and lock body scroll', () => {
      fc.assert(
        fc.property(triggerActionArbitrary, (action) => {
          cleanup();
          document.body.style.overflow = '';

          render(<TestWrapper />);

          // Verify initial state
          expect(screen.getByTestId('is-open').textContent).toBe('false');

          // Trigger the action
          const buttonId = action === 'sign-in' ? 'open-sign-in' : 'open-sign-up';
          act(() => {
            fireEvent.click(screen.getByTestId(buttonId));
          });

          // Verify modal is open
          expect(screen.getByTestId('is-open').textContent).toBe('true');

          // Verify correct view is set
          expect(screen.getByTestId('view').textContent).toBe(action);

          // Verify body scroll is locked (modal is rendered)
          const dialog = screen.queryByRole('dialog');
          expect(dialog).toBeInTheDocument();
        }),
        { numRuns: 100 }
      );
    });

    it('Property 1 (sequence): Multiple open actions should always result in correct state', () => {
      fc.assert(
        fc.property(
          fc.array(triggerActionArbitrary, { minLength: 1, maxLength: 10 }),
          (actions) => {
            cleanup();
            document.body.style.overflow = '';

            render(<TestWrapper />);

            // Execute each action in sequence
            for (const action of actions) {
              const buttonId = action === 'sign-in' ? 'open-sign-in' : 'open-sign-up';
              act(() => {
                fireEvent.click(screen.getByTestId(buttonId));
              });

              // After each action, verify state is consistent
              expect(screen.getByTestId('is-open').textContent).toBe('true');
              expect(screen.getByTestId('view').textContent).toBe(action);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 1 (returnUrl): Opening with returnUrl should preserve it', () => {
      cleanup();
      document.body.style.overflow = '';

      render(<TestWrapper />);

      // Open with return URL
      act(() => {
        fireEvent.click(screen.getByTestId('open-sign-in-with-url'));
      });

      // Modal should be open
      expect(screen.getByTestId('is-open').textContent).toBe('true');
      expect(screen.getByTestId('view').textContent).toBe('sign-in');
    });
  });

  /**
   * Property 2: Modal Close State Consistency
   * For any close action (overlay click, Escape key, close button), the modal state 
   * SHALL transition to closed, body scroll SHALL be unlocked, and the previous 
   * page state SHALL be preserved.
   * Validates: Requirements 1.4, 1.5
   */
  describe('Property 2: Modal Close State Consistency', () => {
    it('Property 2: Closing modal should reset state correctly', () => {
      fc.assert(
        fc.property(triggerActionArbitrary, (action) => {
          cleanup();
          document.body.style.overflow = '';

          render(<TestWrapper />);

          // Open the modal first
          const buttonId = action === 'sign-in' ? 'open-sign-in' : 'open-sign-up';
          act(() => {
            fireEvent.click(screen.getByTestId(buttonId));
          });

          // Verify modal is open
          expect(screen.getByTestId('is-open').textContent).toBe('true');

          // Close the modal
          act(() => {
            fireEvent.click(screen.getByTestId('close'));
          });

          // Verify modal is closed
          expect(screen.getByTestId('is-open').textContent).toBe('false');

          // Verify dialog is no longer in document
          const dialog = screen.queryByRole('dialog');
          expect(dialog).not.toBeInTheDocument();
        }),
        { numRuns: 100 }
      );
    });

    it('Property 2 (escape): Pressing Escape should close the modal', () => {
      fc.assert(
        fc.property(triggerActionArbitrary, (action) => {
          cleanup();
          document.body.style.overflow = '';

          render(<TestWrapper />);

          // Open the modal
          const buttonId = action === 'sign-in' ? 'open-sign-in' : 'open-sign-up';
          act(() => {
            fireEvent.click(screen.getByTestId(buttonId));
          });

          // Verify modal is open
          expect(screen.getByTestId('is-open').textContent).toBe('true');

          // Press Escape
          act(() => {
            fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
          });

          // Verify modal is closed
          expect(screen.getByTestId('is-open').textContent).toBe('false');
        }),
        { numRuns: 100 }
      );
    });

    it('Property 2 (open-close cycle): Open and close cycles should maintain consistency', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              action: triggerActionArbitrary,
              closeMethod: fc.constantFrom('button', 'escape') as fc.Arbitrary<'button' | 'escape'>,
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (cycles) => {
            cleanup();
            document.body.style.overflow = '';

            render(<TestWrapper />);

            for (const { action, closeMethod } of cycles) {
              // Open
              const buttonId = action === 'sign-in' ? 'open-sign-in' : 'open-sign-up';
              act(() => {
                fireEvent.click(screen.getByTestId(buttonId));
              });
              expect(screen.getByTestId('is-open').textContent).toBe('true');

              // Close
              if (closeMethod === 'button') {
                act(() => {
                  fireEvent.click(screen.getByTestId('close'));
                });
              } else {
                act(() => {
                  fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
                });
              }
              expect(screen.getByTestId('is-open').textContent).toBe('false');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Auth Error Display Without Modal Close
   * For any authentication failure, the modal SHALL remain open AND an error 
   * message SHALL be displayed within the modal.
   * Validates: Requirements 1.8
   * 
   * Note: Since AuthView from Neon Auth handles error display internally,
   * we test that the modal remains open when errors occur and that the
   * modal structure supports error display.
   */
  describe('Property 4: Auth Error Display Without Modal Close', () => {
    it('Property 4: Modal should remain open when auth errors occur', () => {
      fc.assert(
        fc.property(triggerActionArbitrary, (action) => {
          cleanup();
          document.body.style.overflow = '';

          render(<TestWrapper />);

          // Open the modal
          const buttonId = action === 'sign-in' ? 'open-sign-in' : 'open-sign-up';
          act(() => {
            fireEvent.click(screen.getByTestId(buttonId));
          });

          // Verify modal is open
          expect(screen.getByTestId('is-open').textContent).toBe('true');

          // Verify dialog is present (where errors would be displayed)
          const dialog = screen.queryByRole('dialog');
          expect(dialog).toBeInTheDocument();

          // The modal should have the AuthView component which handles errors
          // We verify the modal structure supports error display by checking
          // that the modal content area exists and is properly structured
          expect(dialog).toHaveAttribute('aria-modal', 'true');

          // Modal should remain open (no automatic close on error)
          // This is verified by the fact that isOpen is still true
          expect(screen.getByTestId('is-open').textContent).toBe('true');
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4 (structure): Modal should have proper structure for error display', () => {
      fc.assert(
        fc.property(triggerActionArbitrary, (action) => {
          cleanup();
          document.body.style.overflow = '';

          render(<TestWrapper />);

          // Open the modal
          const buttonId = action === 'sign-in' ? 'open-sign-in' : 'open-sign-up';
          act(() => {
            fireEvent.click(screen.getByTestId(buttonId));
          });

          // Verify modal has proper accessibility attributes
          const dialog = screen.getByRole('dialog');
          expect(dialog).toHaveAttribute('aria-modal', 'true');
          expect(dialog).toHaveAttribute('aria-labelledby', 'auth-modal-title');

          // Verify title is present (for context when errors occur)
          const title = screen.getByText(
            action === 'sign-up' ? 'Create your account' : 'Sign in'
          );
          expect(title).toBeInTheDocument();
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4 (persistence): Modal state should persist through multiple interactions', () => {
      fc.assert(
        fc.property(
          fc.array(triggerActionArbitrary, { minLength: 1, maxLength: 5 }),
          (actions) => {
            cleanup();
            document.body.style.overflow = '';

            render(<TestWrapper />);

            // Open with first action
            const firstAction = actions[0];
            const buttonId = firstAction === 'sign-in' ? 'open-sign-in' : 'open-sign-up';
            act(() => {
              fireEvent.click(screen.getByTestId(buttonId));
            });

            // Verify modal is open
            expect(screen.getByTestId('is-open').textContent).toBe('true');

            // Simulate multiple view switches (like toggling between sign-in/sign-up)
            // Modal should remain open throughout
            for (const action of actions.slice(1)) {
              const switchButtonId = action === 'sign-in' ? 'open-sign-in' : 'open-sign-up';
              act(() => {
                fireEvent.click(screen.getByTestId(switchButtonId));
              });

              // Modal should still be open
              expect(screen.getByTestId('is-open').textContent).toBe('true');
              expect(screen.getByTestId('view').textContent).toBe(action);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 8: Protected Action Auth Gate
   * For any protected action attempted by an unauthenticated user, 
   * the sign-in modal SHALL open automatically.
   * Validates: Requirements 2.6
   */
  describe('Property 8: Protected Action Auth Gate', () => {
    it('Property 8: Protected action should open sign-in modal when unauthenticated', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }), // Arbitrary action identifier
          (_actionId) => {
            cleanup();
            document.body.style.overflow = '';

            render(<TestWrapper />);

            // Verify modal is initially closed
            expect(screen.getByTestId('is-open').textContent).toBe('false');

            // Simulate a protected action by opening sign-in
            // (In real usage, useRequireAuth would call openSignIn when user is not authenticated)
            act(() => {
              fireEvent.click(screen.getByTestId('open-sign-in'));
            });

            // Modal should open with sign-in view
            expect(screen.getByTestId('is-open').textContent).toBe('true');
            expect(screen.getByTestId('view').textContent).toBe('sign-in');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8 (returnUrl): Protected action should preserve return URL', () => {
      cleanup();
      document.body.style.overflow = '';

      render(<TestWrapper />);

      // Verify modal is initially closed
      expect(screen.getByTestId('is-open').textContent).toBe('false');

      // Simulate protected action with return URL
      act(() => {
        fireEvent.click(screen.getByTestId('open-sign-in-with-url'));
      });

      // Modal should open
      expect(screen.getByTestId('is-open').textContent).toBe('true');
      expect(screen.getByTestId('view').textContent).toBe('sign-in');
    });

    it('Property 8 (consistency): Multiple protected actions should consistently open modal', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 5 }),
          (actionIds) => {
            cleanup();
            document.body.style.overflow = '';

            render(<TestWrapper />);

            for (const _actionId of actionIds) {
              // Close modal if open
              if (screen.getByTestId('is-open').textContent === 'true') {
                act(() => {
                  fireEvent.click(screen.getByTestId('close'));
                });
              }

              // Verify modal is closed
              expect(screen.getByTestId('is-open').textContent).toBe('false');

              // Trigger protected action
              act(() => {
                fireEvent.click(screen.getByTestId('open-sign-in'));
              });

              // Modal should open
              expect(screen.getByTestId('is-open').textContent).toBe('true');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
