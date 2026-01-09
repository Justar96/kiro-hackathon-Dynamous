import { createRootRouteWithContext, Outlet, Link } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { UserButton, SignedIn, SignedOut } from '@neondatabase/neon-js/auth/react';
import type { QueryClient } from '@tanstack/react-query';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  pendingComponent: RootPendingComponent,
});

function RootComponent() {
  return (
    <div className="min-h-screen bg-page-bg">
      <Navigation />
      <Outlet />
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
 * Clean minimal header with logo and Neon Auth UserButton
 * Requirements: 9.1, 15.3
 */
function Navigation() {
  return (
    <nav className="bg-paper border-b border-black/[0.08]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo / Brand - Clean minimal style */}
          <Link to="/" className="flex items-center gap-2 sm:gap-2.5 group">
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
              className="text-text-secondary hover:text-text-primary text-body-small font-medium transition-colors hidden sm:inline"
              activeProps={{ className: 'text-text-primary' }}
            >
              Index
            </Link>

            {/* Auth Section - Signed In */}
            <SignedIn>
              <div className="flex items-center gap-2 sm:gap-4">
                <Link
                  to="/debates/new"
                  className="px-2.5 sm:px-3 py-1.5 bg-text-primary text-paper text-body-small font-medium rounded-subtle hover:bg-text-primary/90 transition-colors active:bg-text-primary/80"
                >
                  <span className="hidden sm:inline">New Debate</span>
                  <span className="sm:hidden">+</span>
                </Link>
                <div className="ml-0.5 sm:ml-1">
                  <UserButton />
                </div>
              </div>
            </SignedIn>

            {/* Auth Section - Signed Out */}
            <SignedOut>
              <div className="flex items-center gap-2 sm:gap-3">
                <Link
                  to="/auth/$pathname"
                  params={{ pathname: 'sign-in' }}
                  className="text-text-secondary hover:text-text-primary text-body-small font-medium transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/auth/$pathname"
                  params={{ pathname: 'sign-up' }}
                  className="px-2.5 sm:px-3 py-1.5 bg-text-primary text-paper text-body-small font-medium rounded-subtle hover:bg-text-primary/90 transition-colors active:bg-text-primary/80"
                >
                  Sign Up
                </Link>
              </div>
            </SignedOut>
          </div>
        </div>
      </div>
    </nav>
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
