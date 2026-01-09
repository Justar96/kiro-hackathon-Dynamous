import { createFileRoute } from '@tanstack/react-router';
import { debatesQueryOptions } from '../lib/queries';
import { DebateIndexList, SkeletonDebateRow } from '../components';
import type { Debate, MarketPrice } from '@debate-platform/shared';
import { useQueries } from '@tanstack/react-query';

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    // Prefetch debates data using React Query's ensureQueryData
    const debates = await context.queryClient.ensureQueryData(debatesQueryOptions);
    return { debates };
  },
  pendingComponent: HomePagePending,
  pendingMs: 200,
  component: HomePage,
});

interface MarketResponse {
  marketPrice: MarketPrice;
}

function HomePage() {
  const { debates } = Route.useLoaderData();

  // Fetch market data for each debate to show support/oppose and mind changes
  const marketQueries = useQueries({
    queries: debates.map((debate: Debate) => ({
      queryKey: ['debate', debate.id, 'market-public'] as const,
      queryFn: async (): Promise<MarketResponse | null> => {
        try {
          const response = await fetch(`/api/debates/${debate.id}/market`);
          if (!response.ok) return null;
          return response.json();
        } catch {
          return null;
        }
      },
      staleTime: 1000 * 30, // 30 seconds
    })),
  });

  // Combine debates with their market data
  const debatesWithMarket = debates.map((debate: Debate, index: number) => ({
    debate,
    marketPrice: marketQueries[index]?.data?.marketPrice as MarketPrice | null | undefined,
  }));

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
        {/* Header skeleton */}
        <header className="mb-8 sm:mb-10">
          <div className="h-8 sm:h-10 w-40 sm:w-48 bg-gray-200 rounded animate-pulse" />
          <div className="mt-3 h-4 sm:h-5 w-64 sm:w-72 bg-gray-200 rounded animate-pulse" />
        </header>

        {/* List skeleton */}
        <div className="bg-paper rounded-small border border-gray-100 shadow-paper">
          {/* Header row skeleton - hidden on mobile */}
          <div className="hidden sm:flex items-center gap-4 py-3 px-2 border-b border-gray-200 bg-page-bg/30">
            <div className="flex-1">
              <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="w-16 flex-shrink-0">
              <div className="h-3 w-8 mx-auto bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="w-12 flex-shrink-0 hidden md:block">
              <div className="h-3 w-10 mx-auto bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="w-16 flex-shrink-0">
              <div className="h-3 w-12 ml-auto bg-gray-200 rounded animate-pulse" />
            </div>
          </div>

          {/* Row skeletons */}
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonDebateRow key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
