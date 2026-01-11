import { createRootRouteWithContext, Outlet, Link } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { QueryClient } from '@tanstack/react-query';
import { useAuthModal, ProfileDropdown } from '../components';
import { useSessionWatcher, useSession } from '../lib/useSession';
import { useCurrentUser } from '../lib/hooks';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  pendingComponent: RootPendingComponent,
});

function RootComponent() {
  // Watch for sign-out events and clear cache automatically
  // Requirements: 2.4 - Clear all user-specific cached data on sign out
  useSessionWatcher();
  
  return (
    <div className="min-h-screen bg-page-bg">
      {/* Skip to main content link for keyboard navigation (Requirement 1.7) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-subtle focus:text-body-small focus:font-medium"
      >
        Skip to main content
      </a>
      <Navigation />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      {import.meta.env.DEV && (
        <>
          <TanStackRouterDevtools position="bottom-right" />
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        </>
      )}
    </div>
  );
}

/**
 * Clean minimal header with logo and custom ProfileDropdown
 * Requirements: 9.1, 15.3, 1.7, 8.4
 * - Keyboard accessible navigation
 * - 44px minimum touch targets
 * Requirements: 1.1 - Display dropdown menu when clicking avatar
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5 - Display user info, sandbox status, reputation
 */
function Navigation() {
  const { user, isLoading } = useSession();
  const { data: currentUserData, isLoading: isLoadingPlatformUser } = useCurrentUser();

  // Map platform user data to ProfileDropdown format
  const platformUser = currentUserData?.user ? {
    id: currentUserData.user.id,
    username: currentUserData.user.username,
    reputationScore: currentUserData.user.reputationScore,
    sandboxCompleted: currentUserData.user.sandboxCompleted,
    debatesParticipated: currentUserData.user.debatesParticipated,
  } : null;

  return (
    <nav className="bg-paper border-b border-black/[0.08]" aria-label="Main navigation">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo / Brand - Clean minimal style */}
          <Link to="/" className="flex items-center gap-2 sm:gap-2.5 group min-h-[44px]">
            <div className="w-7 h-7 bg-text-primary rounded-subtle flex items-center justify-center">
              <span className="text-paper font-heading font-semibold text-sm">P</span>
            </div>
            <span className="font-heading text-base sm:text-lg text-text-primary group-hover:text-accent transition-colors">
              Persuasion
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-3 sm:gap-6">
            <Link
              to="/"
              className="min-h-[44px] px-2 text-text-secondary hover:text-text-primary text-body-small font-medium transition-colors hidden sm:inline-flex items-center"
              activeProps={{ className: 'text-text-primary' }}
            >
              Index
            </Link>

            {/* Auth Section - Signed In */}
            {!isLoading && user && (
              <div className="flex items-center gap-2 sm:gap-4">
                <Link
                  to="/debates/new"
                  className="min-h-[44px] px-2.5 sm:px-3 bg-text-primary text-paper text-body-small font-medium rounded-subtle hover:bg-text-primary/90 transition-colors active:bg-text-primary/80 inline-flex items-center"
                >
                  <span className="hidden sm:inline">New Debate</span>
                  <span className="sm:hidden">+</span>
                </Link>
                <ProfileDropdown
                  user={{
                    id: user.id,
                    name: user.name || null,
                    email: user.email,
                    image: user.image || null,
                  }}
                  platformUser={platformUser}
                  showName={false}
                />
              </div>
            )}

            {/* Auth Section - Signed Out */}
            {!isLoading && !user && (
              <AuthButtons />
            )}

            {/* Loading state */}
            {isLoading && (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

/**
 * Auth button component that uses the auth modal
 * Single "Sign In" button - modal allows switching to sign-up
 * Requirements: 1.1, 1.7, 8.4
 * - 44px minimum touch targets for accessibility
 * - Keyboard accessible with visible focus indicators
 */
function AuthButtons() {
  const { openSignIn } = useAuthModal();

  return (
    <button
      onClick={() => openSignIn()}
      className="min-h-[44px] px-4 bg-paper text-text-primary border border-hairline text-body-small font-medium rounded-small hover:bg-page-bg transition-colors inline-flex items-center"
    >
      Sign In
    </button>
  );
}

function NotFoundComponent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-page-bg">
      <div className="text-center max-w-md px-6">
        <h1 className="font-heading text-6xl font-semibold text-text-primary">404</h1>
        <p className="mt-4 text-body-large text-text-secondary">Page not found</p>
        <p className="mt-2 text-body-small text-text-tertiary">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block px-4 py-2 bg-text-primary text-paper font-medium rounded-subtle hover:bg-text-primary/90 transition-colors"
        >
          Back to Index
        </Link>
      </div>
    </div>
  );
}

function RootPendingComponent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-page-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-text-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-body-small text-text-secondary">Loading...</p>
      </div>
    </div>
  );
}
