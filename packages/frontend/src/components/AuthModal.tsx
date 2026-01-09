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
 * Requirements: 1.1, 1.2, 1.5, 2.2
 * - Tracks modal open/close state
 * - Tracks current view (sign-in or sign-up)
 * - Tracks returnUrl for post-auth redirect
 * - Shows success toast on auth completion
 */
export function AuthModalProvider({ children }: AuthModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<AuthView_Type>('sign-in');
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const { showToast } = useToast();
  const { user } = useSession();
  const wasOpenRef = useRef(false);
  const previousUserRef = useRef<typeof user>(null);

  // Track when modal was open and user becomes authenticated
  // Requirements: 1.5, 2.2 - Show success toast on auth completion
  useEffect(() => {
    // If modal was open and user just became authenticated
    if (wasOpenRef.current && user && !previousUserRef.current) {
      // Close modal
      setIsOpen(false);
      setReturnUrl(null);
      wasOpenRef.current = false;
      
      // Show success toast
      showToast({
        type: 'success',
        message: `Welcome${user.name ? `, ${user.name}` : ''}! You're now signed in.`,
      });
    }
    
    previousUserRef.current = user;
  }, [user, showToast]);

  // Track when modal opens
  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
    }
  }, [isOpen]);

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
 */
function AuthModal() {
  const { isOpen, view, close } = useAuthModal();

  // Map view to pathname for AuthView
  const pathname = view === 'sign-up' ? 'sign-up' : 'sign-in';

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
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2
            id="auth-modal-title"
            className="font-heading text-xl font-semibold text-text-primary"
          >
            {view === 'sign-up' ? 'Create your account' : 'Sign in'}
          </h2>
          {/* Close button - 44px minimum touch target for accessibility (Requirement 8.4) */}
          <button
            onClick={close}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-tertiary hover:text-text-primary transition-colors rounded-subtle hover:bg-black/5 -mr-2"
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

        {/* Subtitle */}
        <p className="text-body-small text-text-secondary mb-6">
          {view === 'sign-up'
            ? 'Join the Persuasion Market'
            : 'Welcome back to Persuasion'}
        </p>

        {/* Auth Form - Neon Auth handles loading states and error display */}
        <AuthView pathname={pathname} />

        {/* Toggle between sign-in and sign-up */}
        <div className="mt-6 pt-4 border-t border-black/[0.08] text-center">
          {view === 'sign-in' ? (
            <p className="text-body-small text-text-secondary">
              Don't have an account?{' '}
              <ToggleViewButton targetView="sign-up">Sign up</ToggleViewButton>
            </p>
          ) : (
            <p className="text-body-small text-text-secondary">
              Already have an account?{' '}
              <ToggleViewButton targetView="sign-in">Sign in</ToggleViewButton>
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

/**
 * Button to toggle between sign-in and sign-up views
 * Minimum 44px touch target for accessibility (Requirement 8.4)
 */
function ToggleViewButton({
  targetView,
  children,
}: {
  targetView: AuthView_Type;
  children: ReactNode;
}) {
  const { openSignIn, openSignUp, returnUrl } = useAuthModal();

  const handleClick = () => {
    if (targetView === 'sign-in') {
      openSignIn(returnUrl ?? undefined);
    } else {
      openSignUp(returnUrl ?? undefined);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="text-accent hover:text-accent/80 font-medium transition-colors min-h-[44px] px-1 inline-flex items-center"
    >
      {children}
    </button>
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
