import { useRef, useEffect, useCallback } from 'react';
import { CompactMarketCard } from './CompactMarketCard';

interface Market {
  id: string;
  question: string;
  yesPercent: number;
  endDate: string;
  category?: string;
  volume?: string;
}

export interface InfiniteFeedProps {
  markets: Market[];
  fetchNextPage?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  refetch?: () => void;
}

function SkeletonCard() {
  return (
    <div className="dossier-card rounded-subtle p-4 animate-pulse h-full">
      <div className="h-3 w-16 bg-divider rounded mb-2" />
      <div className="space-y-2 mb-4">
        <div className="h-4 w-full bg-divider rounded" />
        <div className="h-4 w-3/4 bg-divider rounded" />
      </div>
      <div className="h-2 w-full bg-divider rounded mb-4" />
      <div className="flex gap-2">
        <div className="flex-1 h-9 bg-divider rounded" />
        <div className="flex-1 h-9 bg-divider rounded" />
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-6" role="status" aria-label="Loading more">
      <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
    </div>
  );
}

function EndOfFeed() {
  return (
    <div className="text-center py-8 text-text-tertiary">
      <p className="text-sm">No more markets to show</p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="text-center py-8">
      <p className="text-text-secondary mb-4">Failed to load markets</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent/90 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 bg-paper rounded-lg border border-divider">
      <p className="text-text-secondary">No markets yet</p>
    </div>
  );
}

export function InfiniteFeed({
  markets,
  fetchNextPage,
  hasNextPage = false,
  isFetchingNextPage = false,
  isLoading = false,
  isError = false,
  refetch,
}: InfiniteFeedProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage && fetchNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: '200px',
      threshold: 0,
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleIntersection]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" role="status" aria-label="Loading markets">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorState onRetry={refetch} />;
  }

  if (markets.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="infinite-feed">
      {markets.map((market) => (
        <CompactMarketCard
          key={market.id}
          marketId={market.id}
          question={market.question}
          yesPercent={market.yesPercent}
          endDate={market.endDate}
          category={market.category}
          volume={market.volume}
        />
      ))}

      <div ref={sentinelRef} className="h-1" aria-hidden="true" />

      {isFetchingNextPage && <LoadingSpinner />}
      {!hasNextPage && !isFetchingNextPage && markets.length > 0 && <EndOfFeed />}
    </div>
  );
}
