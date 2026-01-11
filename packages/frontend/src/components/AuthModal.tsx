import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { AuthView } from '@neondatabase/neon-js/auth/react';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { useSession } from '../lib/useSession';
import { useOnboardingToast } from './OnboardingToast';

// Types for auth modal state
type AuthView_Type = 'sign-in' | 'sign-up';

interface AuthModalContextValue {
  isOpen: boolean;
  view: AuthView_Type;
  returnUrl: string | null;
  openSignIn: (returnUrl?: string) => void;
  openSignUp: (returnUrl?: string) => void;
  close: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

interface AuthModalProviderProps {
  children: ReactNode;
}

/**
 * AuthModalProvider - Provides auth modal state and controls to the app
 * 
 * Requirements: 1.1, 1.2, 1.5, 2.2, 2.5, 2.6, 2.7
 * - Tracks modal open/close state
 * - Tracks current view (sign-in or sign-up)
 * - Tracks returnUrl for post-auth redirect
 * - Shows success toast on auth completion
 * - Shows onboarding toast for new sign-ups
 */
export function AuthModalProvider({ children }: AuthModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<AuthView_Type>('sign-in');
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const { showToast } = useToast();
  const { showOnboarding, hasShownOnboarding } = useOnboardingToast();
  const { user } = useSession();
  const wasOpenRef = useRef(false);
  const wasSignUpRef = useRef(false);
  const previousUserRef = useRef<typeof user>(null);

  // Track when modal was open and user becomes authenticated
  // Requirements: 1.5, 2.2, 2.5, 2.6, 2.7 - Show success/onboarding toast on auth completion
  useEffect(() => {
    // If modal was open and user just became authenticated
    if (wasOpenRef.current && user && !previousUserRef.current) {
      // Close modal
      setIsOpen(false);
      setReturnUrl(null);
      
      // Check if this was a sign-up (show onboarding) or sign-in (show welcome)
      if (wasSignUpRef.current && !hasShownOnboarding) {
        // Show onboarding toast for new sign-ups
        // Requirements: 2.5, 2.6, 2.7
        showOnboarding(user.name || 'there');
      } else {
        // Show regular welcome toast for sign-ins
        showToast({
          type: 'success',
          message: `Welcome${user.name ? `, ${user.name}` : ''}! You're now signed in.`,
        });
      }
      
      wasOpenRef.current = false;
      wasSignUpRef.current = false;
    }
    
    previousUserRef.current = user;
  }, [user, showToast, showOnboarding, hasShownOnboarding]);

  // Track when modal opens and which view
  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      wasSignUpRef.current = view === 'sign-up';
    }
  }, [isOpen, view]);

  const openSignIn = useCallback((url?: string) => {
    setView('sign-in');
    setReturnUrl(url ?? null);
    setIsOpen(true);
  }, []);

  const openSignUp = useCallback((url?: string) => {
    setView('sign-up');
    setReturnUrl(url ?? null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // Reset returnUrl after closing
    setReturnUrl(null);
    wasOpenRef.current = false;
  }, []);

  return (
    <AuthModalContext.Provider
      value={{
        isOpen,
        view,
        returnUrl,
        openSignIn,
        openSignUp,
        close,
      }}
    >
      {children}
      <AuthModal />
    </AuthModalContext.Provider>
  );
}

/**
 * Hook to access auth modal controls
 * 
 * @throws Error if used outside AuthModalProvider
 */
export function useAuthModal(): AuthModalContextValue {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error('useAuthModal must be used within an AuthModalProvider');
  }
  return context;
}

/**
 * AuthModal - Modal component for authentication
 * 
 * Requirements: 1.1, 1.2, 1.8, 2.1
 * - Integrates with Neon Auth AuthView
 * - Handles sign-in and sign-up views
 * - Displays loading state on submit button (handled by AuthView)
 * - Displays error messages within modal (handled by AuthView)
 * - Google OAuth button included via NeonAuthUIProvider social config
 * - AuthView includes built-in toggle between sign-in/sign-up
 */
function AuthModal() {
  const { isOpen, view, close } = useAuthModal();

  // Map view to pathname for AuthView
  const pathname = view === 'sign-up' ? 'sign-up' : 'sign-in';

  const isSignUp = view === 'sign-up';

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      size="md"
      closeOnOverlayClick={true}
      closeOnEscape={true}
      trapFocus={true}
      ariaLabelledBy="auth-modal-title"
    >
      <div className="p-6">
        {/* Header with close button */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h2
              id="auth-modal-title"
              className="font-heading text-2xl font-semibold text-text-primary"
            >
              {isSignUp ? 'Join Persuasion' : 'Welcome back'}
            </h2>
            {isSignUp && (
              <p className="text-sm text-text-secondary mt-1">
                Track debates, make predictions, build your reputation
              </p>
            )}
          </div>
          {/* Close button - 44px minimum touch target for accessibility */}
          <button
            onClick={close}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-tertiary hover:text-text-primary transition-colors rounded-lg hover:bg-black/5 -mr-2 -mt-1"
            aria-label="Close modal"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Auth Form - Neon Auth handles loading states, error display, and view toggle */}
        {/* Google OAuth button appears automatically via NeonAuthUIProvider social config */}
        <div className="mt-4">
          <AuthView pathname={pathname} />
        </div>

        {/* Footer note for sign-up */}
        {isSignUp && (
          <p className="text-xs text-text-tertiary text-center mt-4">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </p>
        )}
      </div>
    </Modal>
  );
}

export { AuthModalContext };
export default AuthModalProvider;

/**
 * useRequireAuth - Hook for protected actions that require authentication
 * 
 * Requirements: 2.6
 * - Opens sign-in modal when unauthenticated user attempts protected action
 * - Returns a function that wraps the protected action
 * 
 * @param returnUrl - Optional URL to redirect to after successful auth
 * @returns Object with requireAuth function and isAuthenticated state
 */
export function useRequireAuth(returnUrl?: string) {
  const { openSignIn } = useAuthModal();
  const { user, isLoading } = useSession();
  
  const isAuthenticated = !!user;

  /**
   * Wraps a protected action - executes if authenticated, opens modal if not
   * @param action - The action to execute if authenticated
   */
  const requireAuth = useCallback(
    <T extends unknown[]>(action: (...args: T) => void) => {
      return (...args: T) => {
        if (isAuthenticated) {
          action(...args);
        } else {
          openSignIn(returnUrl);
        }
      };
    },
    [isAuthenticated, openSignIn, returnUrl]
  );

  /**
   * Check auth and open modal if not authenticated
   * Returns true if authenticated, false if modal was opened
   */
  const checkAuth = useCallback(() => {
    if (isAuthenticated) {
      return true;
    }
    openSignIn(returnUrl);
    return false;
  }, [isAuthenticated, openSignIn, returnUrl]);

  return {
    requireAuth,
    checkAuth,
    isAuthenticated,
    isLoading,
  };
}
