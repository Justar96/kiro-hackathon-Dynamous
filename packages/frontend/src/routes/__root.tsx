import { createRootRouteWithContext, Outlet, Link } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import { useAuthModal, ProfileDropdown, WarningIcon } from '../components';
import { useSessionWatcher, useSession } from '../lib';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  pendingComponent: RootPendingComponent,
});

interface QueryErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function QueryErrorFallback({ error, resetErrorBoundary }: QueryErrorFallbackProps) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center bg-page-bg">
      <div className="bg-paper rounded-subtle shadow-sm p-8 text-center max-w-md mx-4">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <WarningIcon size="lg" className="text-red-600" decorative />
        </div>
        <h2 className="font-heading text-heading-2 text-text-primary mb-2">
          Something went wrong
        </h2>
        <p className="text-body text-text-secondary mb-4">
          {error.message || 'An unexpected error occurred while loading this page.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={resetErrorBoundary}
            className="px-4 py-2 bg-accent text-white rounded-subtle hover:bg-accent-hover transition-colors"
          >
            Try Again
          </button>
          <Link
            to="/"
            className="px-4 py-2 border border-hairline text-text-primary rounded-subtle hover:bg-page-bg transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function RootComponent() {
  const sessionState = useSession();
  useSessionWatcher(sessionState);

  return (
    <div className="min-h-screen bg-page-bg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-subtle focus:text-body-small focus:font-medium"
      >
        Skip to main content
      </a>
      <Navigation sessionState={sessionState} />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <QueryErrorResetBoundary>
          {({ reset }) => (
            <ErrorBoundary
              onReset={reset}
              fallbackRender={({ error, resetErrorBoundary }) => (
                <QueryErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} />
              )}
            >
              <Outlet />
            </ErrorBoundary>
          )}
        </QueryErrorResetBoundary>
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

interface NavigationProps {
  sessionState: {
    user: { id: string; email: string; name: string; image?: string | null } | null;
    isLoading: boolean;
  };
}

function Navigation({ sessionState }: NavigationProps) {
  const { user, isLoading } = sessionState;

  return (
    <nav className="bg-paper border-b border-black/[0.08]" aria-label="Main navigation">
      <div className="max-w-[1320px] mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2 sm:gap-2.5 group min-h-[44px]">
            <div className="w-7 h-7 bg-text-primary rounded-subtle flex items-center justify-center">
              <span className="text-paper font-heading font-semibold text-sm">T</span>
            </div>
            <span className="font-heading text-base sm:text-lg text-text-primary group-hover:text-accent transition-colors">
              Thesis
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/"
              className="min-h-[44px] min-w-[44px] px-2 py-1 rounded-small border border-hairline bg-paper hover:bg-page-bg transition-colors hidden sm:inline-flex items-center text-body-small font-medium text-text-secondary"
              activeProps={{ className: 'text-text-primary' }}
            >
              Markets
            </Link>
            <Link
              to="/portfolio"
              className="min-h-[44px] min-w-[44px] px-2 py-1 rounded-small border border-hairline bg-paper hover:bg-page-bg transition-colors hidden sm:inline-flex items-center text-body-small font-medium text-text-secondary"
              activeProps={{ className: 'text-text-primary' }}
            >
              Portfolio
            </Link>

            {!isLoading && user && (
              <ProfileDropdown
                user={{
                  id: user.id,
                  name: user.name || null,
                  email: user.email,
                  image: user.image || null,
                }}
                platformUser={null}
                showName={false}
              />
            )}

            {!isLoading && !user && <AuthButtons />}

            {isLoading && (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

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
        <Link
          to="/"
          className="mt-6 inline-block px-4 py-2 bg-text-primary text-paper font-medium rounded-subtle hover:bg-text-primary/90 transition-colors"
        >
          Back to Markets
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
