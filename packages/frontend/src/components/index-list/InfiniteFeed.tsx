import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { DebateWithMarket } from '@thesis/shared';
import { CompactDebateCard, CARD_CONFIG } from './CompactDebateCard';
import { Skeleton } from '../common/Skeleton';

/**
 * InfiniteFeed - Reddit-style infinite scroll feed for debates
 * 
 * Requirements:
 * - 1.1: Auto-load next batch when within 200px of bottom
 * - 1.2: Display loading indicator while loading
 * - 1.3: Display end-of-feed message when all loaded
 * - 5.1: Display skeleton cards while initial data loads
 * - 5.2: Show spinner at bottom when loading more
 * - 5.3: Display retry button on network error
 * - 5.4: Virtualize list when exceeds 50 items for performance
 */

/**
 * Virtualization configuration
 * Requirements: 5.4 - Only render visible items + buffer when list is large
 */
export const VIRTUALIZATION_CONFIG = {
  /** Threshold for enabling virtualization */
  threshold: 50,
  /** Estimated item height for virtualization */
  estimatedItemHeight: CARD_CONFIG.maxHeight + 12, // maxHeight + gap
  /** Overscan count (items to render outside viewport) */
  overscan: 5,
} as const;

export interface InfiniteFeedProps {
  /** Array of debates with market data */
  debates: DebateWithMarket[];
  /** Function to fetch the next page */
  fetchNextPage: () => void;
  /** Whether more pages are available */
  hasNextPage: boolean;
  /** Whether currently fetching next page */
  isFetchingNextPage: boolean;
  /** Whether initial load is in progress */
  isLoading: boolean;
  /** Whether an error occurred */
  isError: boolean;
  /** Function to retry/refetch */
  refetch: () => void;
  /** User's existing stances by debate ID */
  userStances?: Record<string, number | null>;
  /** Callback when user records a quick stance */
  onQuickStance?: (debateId: string, side: 'support' | 'oppose') => void;
  /** Whether user is authenticated */
  isAuthenticated?: boolean;
  /** Page size for skeleton count */
  pageSize?: number;
  /** Force virtualization on/off (for testing) */
  forceVirtualization?: boolean;
}

/**
 * Skeleton card for loading states
 * Matches CompactDebateCard dimensions
 */
function SkeletonDebateCard() {
  return (
    <div
      className="bg-paper rounded-lg border border-divider p-4 animate-pulse"
      style={{
        minHeight: CARD_CONFIG.minHeight,
        maxHeight: CARD_CONFIG.maxHeight,
      }}
      data-testid="skeleton-debate-card"
    >
      {/* Status badge skeleton */}
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
      {/* Resolution skeleton - 2 lines */}
      <div className="space-y-2 mb-3">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
      </div>
      {/* Bottom row skeleton */}
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-6 w-12 hidden sm:block" />
      </div>
    </div>
  );
}

/**
 * Loading spinner for fetching next page
 */
function LoadingSpinner() {
  return (
      <div 
        className="flex justify-center py-6"
        data-testid="loading-spinner"
        role="status"
        aria-label="Loading more debates"
      >
        <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        <span className="sr-only">Loading more debates</span>
      </div>
  );
}

/**
 * End of feed message
 */
function EndOfFeed() {
  return (
    <div 
      className="text-center py-8 text-text-tertiary"
      data-testid="end-of-feed"
    >
      <p className="text-sm">No more debates to show</p>
    </div>
  );
}

/**
 * Error state with retry button
 */
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div 
      className="text-center py-8"
      data-testid="error-state"
    >
      <p className="text-text-secondary mb-4">Failed to load debates</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent/90 transition-colors"
        data-testid="retry-button"
      >
        Try Again
      </button>
    </div>
  );
}

/**
 * Empty state when no debates exist
 */
function EmptyState() {
  return (
    <div 
      className="text-center py-12 bg-paper rounded-lg border border-divider"
      data-testid="empty-state"
    >
      <p className="text-text-secondary">No debates yet</p>
    </div>
  );
}

export function InfiniteFeed({
  debates,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  isError,
  refetch,
  userStances = {},
  onQuickStance,
  isAuthenticated = false,
  pageSize = 20,
  forceVirtualization,
}: InfiniteFeedProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Determine if virtualization should be enabled
  // Requirements: 5.4 - Activate when list exceeds 50 items
  const shouldVirtualize = useMemo(() => {
    if (forceVirtualization !== undefined) return forceVirtualization;
    return debates.length > VIRTUALIZATION_CONFIG.threshold;
  }, [debates.length, forceVirtualization]);

  // Set up virtualizer for large lists
  const virtualizer = useVirtualizer({
    count: debates.length,
    getScrollElement: () => document.documentElement,
    estimateSize: () => VIRTUALIZATION_CONFIG.estimatedItemHeight,
    overscan: VIRTUALIZATION_CONFIG.overscan,
    enabled: shouldVirtualize,
  });

  useEffect(() => {
    if (!shouldVirtualize) return;
    virtualizer.measure();
  }, [shouldVirtualize, debates.length, virtualizer]);

  const virtualItems = useMemo(() => virtualizer.getVirtualItems(), [virtualizer, debates.length, shouldVirtualize]);

  /**
   * Intersection Observer callback
   * Triggers fetchNextPage when sentinel is within 200px of viewport
   * Requirements: 1.1 - Auto-load when within 200px of bottom
   */
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  /**
   * Set up Intersection Observer
   * rootMargin: '200px' triggers when sentinel is 200px from viewport bottom
   */
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(handleIntersection, {
      root: null, // Use viewport as root
      rootMargin: '200px', // Trigger 200px before reaching bottom
      threshold: 0,
    });

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [handleIntersection]);

  // Initial loading state - show skeleton cards
  // Requirements: 5.1 - Display skeleton cards while initial data loads
  if (isLoading) {
    return (
      <div 
        className="space-y-3"
        data-testid="infinite-feed-loading"
        role="status"
        aria-label="Loading debates"
      >
        {Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
          <SkeletonDebateCard key={i} />
        ))}
      </div>
    );
  }

  // Error state - show retry button
  // Requirements: 5.3 - Display retry button on network error
  if (isError) {
    return <ErrorState onRetry={refetch} />;
  }

  // Empty state - no debates
  if (debates.length === 0) {
    return <EmptyState />;
  }

  return (
    <div
      ref={scrollContainerRef}
      className="space-y-3"
      data-testid="infinite-feed"
      data-virtualized={shouldVirtualize}
    >
      {/* Virtualized rendering for large lists */}
      {shouldVirtualize ? (
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
          data-testid="virtualized-container"
        >
          {virtualItems.map((virtualItem) => {
            const debateWithMarket = debates[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                data-index={virtualItem.index}
              >
                <CompactDebateCard
                  debate={debateWithMarket.debate}
                  marketPrice={debateWithMarket.marketPrice}
                  userStance={userStances[debateWithMarket.debate.id]}
                  onQuickStance={onQuickStance}
                  isAuthenticated={isAuthenticated}
                />
              </div>
            );
          })}
        </div>
      ) : (
        /* Non-virtualized rendering for small lists */
        debates.map((debateWithMarket) => (
          <CompactDebateCard
            key={debateWithMarket.debate.id}
            debate={debateWithMarket.debate}
            marketPrice={debateWithMarket.marketPrice}
            userStance={userStances[debateWithMarket.debate.id]}
            onQuickStance={onQuickStance}
            isAuthenticated={isAuthenticated}
          />
        ))
      )}

      {/* Sentinel element for Intersection Observer */}
      <div
        ref={sentinelRef}
        className="h-1"
        data-testid="scroll-sentinel"
        aria-hidden="true"
      />

      {/* Loading more indicator */}
      {/* Requirements: 1.2, 5.2 - Show spinner when loading more */}
      {isFetchingNextPage && <LoadingSpinner />}

      {/* End of feed message */}
      {/* Requirements: 1.3 - Display end-of-feed message */}
      {!hasNextPage && !isFetchingNextPage && debates.length > 0 && <EndOfFeed />}
    </div>
  );
}

export default InfiniteFeed;
