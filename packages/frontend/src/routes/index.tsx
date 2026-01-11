import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { debatesWithMarketQueryOptions } from '../lib/queries';
import { DebateIndexList, SkeletonDebateRow, SkeletonHeading, SkeletonText } from '../components';

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    // Prefetch debates WITH market data in a single request (eliminates N+1)
    // Errors will be caught by errorComponent
    const debatesWithMarket = await context.queryClient.ensureQueryData(
      debatesWithMarketQueryOptions
    );
    return { debatesWithMarket };
  },
  pendingComponent: HomePagePending,
  pendingMs: 200, // Minimum loading duration as per Requirements 4.6
  component: HomePage,
  errorComponent: HomePageError,
});

function HomePage() {
  const { debatesWithMarket } = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-paper mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header - library catalog style */}
        <header className="mb-8 sm:mb-10">
          <h1 className="font-heading text-2xl sm:text-heading-1 text-text-primary">
            Debate Index
          </h1>
          <p className="mt-2 text-body-small sm:text-body text-text-secondary">
            Structured debates where minds change through reason
          </p>
        </header>

        {/* Index list */}
        <section>
          <DebateIndexList 
            debates={debatesWithMarket}
            emptyMessage="No debates yet. Be the first to start a structured discussion."
          />
        </section>

        {/* Footer note */}
        <footer className="mt-6 sm:mt-8 text-center">
          <p className="text-caption text-text-tertiary">
            Track your stance before and after reading • See which arguments change minds
          </p>
        </footer>
      </div>
    </div>
  );
}

function HomePagePending() {
  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-paper mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header skeleton - using enhanced skeleton components */}
        <header className="mb-8 sm:mb-10">
          <SkeletonHeading className="mb-3" width="12rem" />
          <SkeletonText lines={1} className="max-w-xs" />
        </header>

        {/* List skeleton */}
        <div className="bg-paper rounded-small border border-gray-100 shadow-paper">
          {/* Header row skeleton - hidden on mobile */}
          <div className="hidden sm:flex items-center gap-4 py-3 px-2 border-b border-gray-200 bg-page-bg/30">
            <div className="flex-1">
              <SkeletonText lines={1} width="5rem" height={12} />
            </div>
            <div className="w-16 flex-shrink-0">
              <SkeletonText lines={1} width="2rem" height={12} className="mx-auto" />
            </div>
            <div className="w-12 flex-shrink-0 hidden md:block">
              <SkeletonText lines={1} width="2.5rem" height={12} className="mx-auto" />
            </div>
            <div className="w-16 flex-shrink-0">
              <SkeletonText lines={1} width="3rem" height={12} className="ml-auto" />
            </div>
          </div>

          {/* Row skeletons - matching exact dimensions of content */}
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonDebateRow key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Error component for the home page.
 * Displays user-friendly error message with retry option.
 */
function HomePageError() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center">
      <div className="bg-paper rounded-subtle shadow-sm p-8 text-center max-w-md mx-4">
        <h2 className="font-heading text-heading-2 text-text-primary mb-2">
          Unable to load debates
        </h2>
        <p className="text-body text-text-secondary mb-6">
          We couldn't load the debate list. This might be a temporary issue.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.invalidate()}
            className="px-4 py-2 bg-accent text-white rounded-subtle hover:bg-accent-hover transition-colors"
          >
            Try Again
          </button>
          <Link
            to="/"
            className="px-4 py-2 border border-hairline text-text-primary rounded-subtle hover:bg-page-bg transition-colors"
          >
            Refresh Page
          </Link>
        </div>
      </div>
    </div>
  );
}
