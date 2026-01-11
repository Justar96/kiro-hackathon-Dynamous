import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import { AuthModalProvider, useAuthModal } from './AuthModal';
import { ToastProvider, useToast } from './Toast';
import React, { useEffect, useState } from 'react';

/**
 * Feature: uiux-improvements
 * Property 6: Toast Display on Auth Success
 * 
 * For any successful authentication, a success toast SHALL appear 
 * AND the modal SHALL close.
 * 
 * Validates: Requirements 2.2, 1.5
 */

// Mock user type
interface MockUser {
  id: string;
  email: string;
  name: string;
}

// Mock session context for testing
const MockSessionContext = React.createContext<{
  user: MockUser | null;
  setUser: (user: MockUser | null) => void;
}>({
  user: null,
  setUser: () => {},
});

// Mock useSession hook
vi.mock('../lib/useSession', () => ({
  useSession: () => {
    const context = React.useContext(MockSessionContext);
    return {
      user: context.user,
      session: context.user ? { id: 'session-1', userId: context.user.id, expiresAt: '' } : null,
      isLoading: false,
    };
  },
}));

// Mock useOnboardingToast hook - always return hasShownOnboarding as true to skip onboarding
vi.mock('./OnboardingToast', () => ({
  useOnboardingToast: () => ({
    showOnboarding: vi.fn(),
    hasShownOnboarding: true, // Always true to skip onboarding and show regular welcome toast
    resetOnboarding: vi.fn(),
  }),
  OnboardingToast: () => null,
  useAutoOnboarding: () => {},
}));

// Test component that exposes auth modal controls and toast state
function TestAuthModalConsumer({
  onStateChange,
}: {
  onStateChange?: (state: { isOpen: boolean; view: string }) => void;
}) {
  const { isOpen, view, openSignIn, openSignUp, close } = useAuthModal();
  const { toasts } = useToast();

  // Report state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange({ isOpen, view });
    }
  }, [isOpen, view, onStateChange]);

  return (
    <div>
      <button data-testid="open-sign-in" onClick={() => openSignIn()}>
        Open Sign In
      </button>
      <button data-testid="open-sign-up" onClick={() => openSignUp()}>
        Open Sign Up
      </button>
      <button data-testid="close" onClick={close}>
        Close
      </button>
      <span data-testid="is-open">{isOpen ? 'true' : 'false'}</span>
      <span data-testid="view">{view}</span>
      <span data-testid="toast-count">{toasts.length}</span>
      <div data-testid="toasts">
        {toasts.map((toast) => (
          <div key={toast.id} data-testid={`toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}

// Wrapper component for testing with mock session
function TestWrapper({
  onStateChange,
  children,
}: {
  onStateChange?: (state: { isOpen: boolean; view: string }) => void;
  children?: React.ReactNode;
}) {
  const [user, setUser] = useState<MockUser | null>(null);

  return (
    <MockSessionContext.Provider value={{ user, setUser }}>
      <ToastProvider>
        <AuthModalProvider>
          <TestAuthModalConsumer onStateChange={onStateChange} />
          {children}
          <SimulateAuthButton setUser={setUser} />
        </AuthModalProvider>
      </ToastProvider>
    </MockSessionContext.Provider>
  );
}

// Button to simulate authentication
function SimulateAuthButton({ 
  setUser 
}: { 
  setUser: (user: MockUser | null) => void;
}) {
  return (
    <button
      data-testid="simulate-auth"
      onClick={() => setUser({ id: 'user-1', email: 'test@example.com', name: 'Test User' })}
    >
      Simulate Auth
    </button>
  );
}

// Arbitrary for generating trigger actions
const triggerActionArbitrary = fc.constantFrom('sign-in', 'sign-up') as fc.Arbitrary<'sign-in' | 'sign-up'>;

describe('Property 6: Toast Display on Auth Success', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  /**
   * Property 6: Toast Display on Auth Success
   * For any successful authentication, a success toast SHALL appear 
   * AND the modal SHALL close.
   * Validates: Requirements 2.2, 1.5
   */
  it('Property 6: Auth success should show toast and close modal', async () => {
    await fc.assert(
      fc.asyncProperty(triggerActionArbitrary, async (action) => {
        cleanup();
        document.body.style.overflow = '';

        render(<TestWrapper />);

        // Verify initial state - modal closed
        expect(screen.getByTestId('is-open').textContent).toBe('false');
        expect(screen.getByTestId('toast-count').textContent).toBe('0');

        // Open the modal
        const buttonId = action === 'sign-in' ? 'open-sign-in' : 'open-sign-up';
        act(() => {
          screen.getByTestId(buttonId).click();
        });

        // Verify modal is open
        expect(screen.getByTestId('is-open').textContent).toBe('true');

        // Simulate successful authentication
        act(() => {
          screen.getByTestId('simulate-auth').click();
        });

        // Wait for state updates
        await waitFor(() => {
          // Modal should be closed
          expect(screen.getByTestId('is-open').textContent).toBe('false');
        });

        // Success toast should be displayed
        await waitFor(() => {
          const successToast = screen.queryByTestId('toast-success');
          expect(successToast).toBeInTheDocument();
        });
      }),
      { numRuns: 100 }
    );
  });

  it('Property 6 (message): Success toast should contain welcome message', async () => {
    render(<TestWrapper />);

    // Open sign-in modal
    act(() => {
      screen.getByTestId('open-sign-in').click();
    });

    expect(screen.getByTestId('is-open').textContent).toBe('true');

    // Simulate successful authentication
    act(() => {
      screen.getByTestId('simulate-auth').click();
    });

    // Wait for toast to appear
    await waitFor(() => {
      const successToast = screen.queryByTestId('toast-success');
      expect(successToast).toBeInTheDocument();
      expect(successToast?.textContent).toContain('Welcome');
    });
  });

  it('Property 6 (no toast without modal): Auth without modal open should not show toast', async () => {
    render(<TestWrapper />);

    // Verify modal is closed
    expect(screen.getByTestId('is-open').textContent).toBe('false');
    expect(screen.getByTestId('toast-count').textContent).toBe('0');

    // Simulate authentication without opening modal
    act(() => {
      screen.getByTestId('simulate-auth').click();
    });

    // Wait a bit for any potential state updates
    await new Promise(resolve => setTimeout(resolve, 100));

    // No toast should appear since modal wasn't open
    expect(screen.getByTestId('toast-count').textContent).toBe('0');
  });

  it('Property 6 (sequence): Multiple auth flows should each show toast', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(triggerActionArbitrary, { minLength: 1, maxLength: 3 }),
        async (actions) => {
          cleanup();
          document.body.style.overflow = '';

          // For this test, we need to reset user state between iterations
          // We'll use a custom wrapper that allows resetting

          function TestWrapperWithReset() {
            const [user, setUser] = useState<MockUser | null>(null);

            return (
              <MockSessionContext.Provider value={{ user, setUser }}>
                <ToastProvider>
                  <AuthModalProvider>
                    <TestAuthModalConsumer />
                    <button
                      data-testid="simulate-auth"
                      onClick={() => setUser({ id: 'user-1', email: 'test@example.com', name: 'Test User' })}
                    >
                      Simulate Auth
                    </button>
                    <button
                      data-testid="reset-auth"
                      onClick={() => setUser(null)}
                    >
                      Reset Auth
                    </button>
                  </AuthModalProvider>
                </ToastProvider>
              </MockSessionContext.Provider>
            );
          }

          render(<TestWrapperWithReset />);

          for (const action of actions) {
            // Reset auth state
            act(() => {
              screen.getByTestId('reset-auth').click();
            });

            // Wait for reset
            await waitFor(() => {
              expect(screen.getByTestId('is-open').textContent).toBe('false');
            });

            // Open modal
            const buttonId = action === 'sign-in' ? 'open-sign-in' : 'open-sign-up';
            act(() => {
              screen.getByTestId(buttonId).click();
            });

            // Verify modal is open
            expect(screen.getByTestId('is-open').textContent).toBe('true');

            // Simulate auth
            act(() => {
              screen.getByTestId('simulate-auth').click();
            });

            // Wait for modal to close
            await waitFor(() => {
              expect(screen.getByTestId('is-open').textContent).toBe('false');
            });

            // Toast should be shown
            await waitFor(() => {
              const successToasts = screen.queryAllByTestId('toast-success');
              expect(successToasts.length).toBeGreaterThan(0);
            });
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
