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
import { Modal } from '../common/Modal';
import { useToast } from '../common/Toast';
import { useSession } from '../../lib';
import { useOnboardingToast } from './OnboardingToast';
import { XIcon } from '../icons';

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
 * Paper dossier aesthetic with dark theme colors.
 */
function AuthModal() {
  const { isOpen, view, close } = useAuthModal();
  const pathname = view === 'sign-up' ? 'sign-up' : 'sign-in';
  const isSignUp = view === 'sign-up';

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      size="sm"
      closeOnOverlayClick={true}
      closeOnEscape={true}
      trapFocus={true}
      ariaLabelledBy="auth-modal-title"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-divider bg-paper-aged rounded-t-small">
        <div className="flex items-center justify-between">
          <h2
            id="auth-modal-title"
            className="font-heading text-xl font-semibold text-text-primary"
          >
            {isSignUp ? 'Create account' : 'Welcome back'}
          </h2>
          <button
            onClick={close}
            className="w-8 h-8 flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-divider rounded-subtle transition-colors"
            aria-label="Close modal"
          >
            <XIcon size="sm" decorative />
          </button>
        </div>
        <p className="text-sm text-text-tertiary mt-1">
          {isSignUp ? 'Join to start trading predictions' : 'Sign in to continue trading'}
        </p>
      </div>

      {/* Auth Form */}
      <div className="p-6">
        <AuthView
          pathname={pathname}
          classNames={{
            title: 'hidden',
            description: 'hidden',
            header: 'hidden',
            form: {
              input: 'w-full px-3 py-2.5 bg-page-bg border border-divider rounded-subtle text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors',
              label: 'block text-sm font-medium text-text-secondary mb-1.5',
              primaryButton: 'w-full py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-subtle transition-colors',
              providerButton: 'w-full py-2.5 bg-paper-aged border border-divider hover:bg-divider text-text-primary font-medium rounded-subtle transition-colors flex items-center justify-center gap-2',
              icon: 'w-5 h-5 flex-shrink-0',
            },
            separator: 'text-xs text-text-tertiary uppercase tracking-wider',
            continueWith: 'text-xs text-text-tertiary',
            footer: 'text-sm text-text-secondary text-center mt-4 pt-4 border-t border-divider',
            footerLink: 'text-accent hover:text-accent-hover font-medium',
          }}
        />
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
