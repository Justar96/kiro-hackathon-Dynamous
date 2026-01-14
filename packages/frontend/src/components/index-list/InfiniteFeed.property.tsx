/**
 * Property-based tests for InfiniteFeed component.
 * 
 * Feature: reddit-style-feed
 * Property 1: Infinite Scroll State Machine
 * Property 7: Loading State Rendering
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 5.1, 5.2, 5.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, cleanup } from '@testing-library/react';
import { InfiniteFeed, VIRTUALIZATION_CONFIG } from './InfiniteFeed';
import type { DebateWithMarket, Debate, MarketPrice } from '@debate-platform/shared';

// Mock TanStack Router's Link component
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string; [key: string]: unknown }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

// Mock the usePrefetch hook
vi.mock('../../lib/usePrefetch', () => ({
  useDebateLinkPrefetch: () => ({}),
}));

// Mock IntersectionObserver
class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  elements: Element[] = [];
  
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  
  observe(element: Element) {
    this.elements.push(element);
  }
  
  unobserve(element: Element) {
    this.elements = this.elements.filter(el => el !== element);
  }
  
  disconnect() {
    this.elements = [];
  }
  
  // Helper to simulate intersection
  simulateIntersection(isIntersecting: boolean) {
    const entries: IntersectionObserverEntry[] = this.elements.map(element => ({
      isIntersecting,
      target: element,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRatio: isIntersecting ? 1 : 0,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: Date.now(),
    }));
    this.callback(entries, this as unknown as IntersectionObserver);
  }
}

let mockObserver: MockIntersectionObserver | null = null;

beforeEach(() => {
  // Setup IntersectionObserver mock
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) {
      mockObserver = new MockIntersectionObserver(callback);
      return mockObserver as unknown as IntersectionObserver;
    }
  });
});

afterEach(() => {
  cleanup();
  mockObserver = null;
  vi.unstubAllGlobals();
});

// Arbitraries for generating test data
const roundNumberArb = fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>;
const debateStatusArb = fc.constantFrom('active', 'concluded') as fc.Arbitrary<'active' | 'concluded'>;
const sideArb = fc.constantFrom('support', 'oppose') as fc.Arbitrary<'support' | 'oppose'>;

// Generate a valid debate
const debateArb: fc.Arbitrary<Debate> = fc.record({
  id: fc.uuid(),
  resolution: fc.string({ minLength: 1, maxLength: 200 }),
  status: debateStatusArb,
  currentRound: roundNumberArb,
  currentTurn: sideArb,
  supportDebaterId: fc.uuid(),
  opposeDebaterId: fc.option(fc.uuid(), { nil: null }),
  createdAt: fc.date(),
  concludedAt: fc.option(fc.date(), { nil: null }),
});

// Generate market price data
const marketPriceArb: fc.Arbitrary<MarketPrice> = fc.record({
  supportPrice: fc.integer({ min: 0, max: 100 }),
  opposePrice: fc.integer({ min: 0, max: 100 }),
  totalVotes: fc.integer({ min: 0, max: 10000 }),
  mindChangeCount: fc.integer({ min: 0, max: 1000 }),
});

// Generate debate with market price
const debateWithMarketArb: fc.Arbitrary<DebateWithMarket> = fc.record({
  debate: debateArb,
  marketPrice: fc.option(marketPriceArb, { nil: null }),
});

// Generate array of debates
const debatesArrayArb = (minLength: number, maxLength: number) =>
  fc.array(debateWithMarketArb, { minLength, maxLength });

describe('InfiniteFeed Property Tests - Infinite Scroll State Machine', () => {
  /**
   * Property 1: Infinite Scroll State Machine
   * For any scroll position and loading state combination, the feed SHALL:
   * - Trigger fetchNextPage when scroll position is within 200px of bottom AND hasNextPage is true AND not currently fetching
   * - Display loading indicator when isFetchingNextPage is true
   * - Display end-of-feed message when hasNextPage is false
   * 
   * Validates: Requirements 1.1, 1.2, 1.3
   */

  it('Property 1.1: fetchNextPage is called when sentinel intersects AND hasNextPage AND not fetching (Requirement 1.1)', () => {
    fc.assert(
      fc.property(
        debatesArrayArb(1, 10),
        (debates) => {
          const fetchNextPage = vi.fn();
          
          render(
            <InfiniteFeed
              debates={debates}
              fetchNextPage={fetchNextPage}
              hasNextPage={true}
              isFetchingNextPage={false}
              isLoading={false}
              isError={false}
              refetch={vi.fn()}
            />
          );

          // Simulate intersection
          mockObserver?.simulateIntersection(true);

          expect(fetchNextPage).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.2: fetchNextPage is NOT called when hasNextPage is false (Requirement 1.1)', () => {
    fc.assert(
      fc.property(
        debatesArrayArb(1, 10),
        (debates) => {
          const fetchNextPage = vi.fn();
          
          render(
            <InfiniteFeed
              debates={debates}
              fetchNextPage={fetchNextPage}
              hasNextPage={false}
              isFetchingNextPage={false}
              isLoading={false}
              isError={false}
              refetch={vi.fn()}
            />
          );

          // Simulate intersection
          mockObserver?.simulateIntersection(true);

          expect(fetchNextPage).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.3: fetchNextPage is NOT called when already fetching (Requirement 1.1)', () => {
    fc.assert(
      fc.property(
        debatesArrayArb(1, 10),
        (debates) => {
          const fetchNextPage = vi.fn();
          
          render(
            <InfiniteFeed
              debates={debates}
              fetchNextPage={fetchNextPage}
              hasNextPage={true}
              isFetchingNextPage={true} // Already fetching
              isLoading={false}
              isError={false}
              refetch={vi.fn()}
            />
          );

          // Simulate intersection
          mockObserver?.simulateIntersection(true);

          expect(fetchNextPage).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.4: fetchNextPage is NOT called when sentinel does not intersect (Requirement 1.1)', () => {
    fc.assert(
      fc.property(
        debatesArrayArb(1, 10),
        (debates) => {
          const fetchNextPage = vi.fn();
          
          render(
            <InfiniteFeed
              debates={debates}
              fetchNextPage={fetchNextPage}
              hasNextPage={true}
              isFetchingNextPage={false}
              isLoading={false}
              isError={false}
              refetch={vi.fn()}
            />
          );

          // Simulate NO intersection
          mockObserver?.simulateIntersection(false);

          expect(fetchNextPage).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.5: Loading spinner is displayed when isFetchingNextPage is true (Requirement 1.2)', () => {
    fc.assert(
      fc.property(
        debatesArrayArb(1, 10),
        (debates) => {
          const { container } = render(
            <InfiniteFeed
              debates={debates}
              fetchNextPage={vi.fn()}
              hasNextPage={true}
              isFetchingNextPage={true}
              isLoading={false}
              isError={false}
              refetch={vi.fn()}
            />
          );

          const spinner = container.querySelector('[data-testid="loading-spinner"]');
          expect(spinner).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.6: Loading spinner is NOT displayed when isFetchingNextPage is false (Requirement 1.2)', () => {
    fc.assert(
      fc.property(
        debatesArrayArb(1, 10),
        (debates) => {
          const { container } = render(
            <InfiniteFeed
              debates={debates}
              fetchNextPage={vi.fn()}
              hasNextPage={true}
              isFetchingNextPage={false}
              isLoading={false}
              isError={false}
              refetch={vi.fn()}
            />
          );

          const spinner = container.querySelector('[data-testid="loading-spinner"]');
          expect(spinner).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.7: End-of-feed message is displayed when hasNextPage is false (Requirement 1.3)', () => {
    fc.assert(
      fc.property(
        debatesArrayArb(1, 10),
        (debates) => {
          const { container } = render(
            <InfiniteFeed
              debates={debates}
              fetchNextPage={vi.fn()}
              hasNextPage={false}
              isFetchingNextPage={false}
              isLoading={false}
              isError={false}
              refetch={vi.fn()}
            />
          );

          const endOfFeed = container.querySelector('[data-testid="end-of-feed"]');
          expect(endOfFeed).not.toBeNull();
          expect(endOfFeed?.textContent).toContain('No more debates');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.8: End-of-feed message is NOT displayed when hasNextPage is true (Requirement 1.3)', () => {
    fc.assert(
      fc.property(
        debatesArrayArb(1, 10),
        (debates) => {
          const { container } = render(
            <InfiniteFeed
              debates={debates}
              fetchNextPage={vi.fn()}
              hasNextPage={true}
              isFetchingNextPage={false}
              isLoading={false}
              isError={false}
              refetch={vi.fn()}
            />
          );

          const endOfFeed = container.querySelector('[data-testid="end-of-feed"]');
          expect(endOfFeed).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.9: Sentinel element is always present in the feed (Requirement 1.1)', () => {
    fc.assert(
      fc.property(
        debatesArrayArb(1, 10),
        (debates) => {
          const { container } = render(
            <InfiniteFeed
              debates={debates}
              fetchNextPage={vi.fn()}
              hasNextPage={true}
              isFetchingNextPage={false}
              isLoading={false}
              isError={false}
              refetch={vi.fn()}
            />
          );

          const sentinel = container.querySelector('[data-testid="scroll-sentinel"]');
          expect(sentinel).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('InfiniteFeed Property Tests - Loading State Rendering', () => {
  /**
   * Property 7: Loading State Rendering
   * For any feed state:
   * - When isLoading is true, skeleton cards SHALL be rendered
   * - When isFetchingNextPage is true, bottom spinner SHALL be visible AND feed SHALL remain scrollable
   * - When isError is true, retry button SHALL be rendered
   * 
   * Validates: Requirements 5.1, 5.2, 5.3
   */

  it('Property 7.1: Skeleton cards are rendered when isLoading is true (Requirement 5.1)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }), // pageSize
        (pageSize) => {
          const { container } = render(
            <InfiniteFeed
              debates={[]}
              fetchNextPage={vi.fn()}
              hasNextPage={true}
              isFetchingNextPage={false}
              isLoading={true}
              isError={false}
              refetch={vi.fn()}
              pageSize={pageSize}
            />
          );

          const loadingContainer = container.querySelector('[data-testid="infinite-feed-loading"]');
          expect(loadingContainer).not.toBeNull();

          const skeletonCards = container.querySelectorAll('[data-testid="skeleton-debate-card"]');
          // Should render min(pageSize, 5) skeleton cards
          expect(skeletonCards.length).toBe(Math.min(pageSize, 5));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.2: Skeleton cards have correct aria attributes for accessibility (Requirement 5.1)', () => {
    const { container } = render(
      <InfiniteFeed
        debates={[]}
        fetchNextPage={vi.fn()}
        hasNextPage={true}
        isFetchingNextPage={false}
        isLoading={true}
        isError={false}
        refetch={vi.fn()}
      />
    );

    const loadingContainer = container.querySelector('[data-testid="infinite-feed-loading"]');
    expect(loadingContainer?.getAttribute('role')).toBe('status');
    expect(loadingContainer?.getAttribute('aria-label')).toBe('Loading debates');
  });

  it('Property 7.3: Feed content is rendered when isLoading is false (Requirement 5.1)', () => {
    fc.assert(
      fc.property(
        debatesArrayArb(1, 10),
        (debates) => {
          const { container } = render(
            <InfiniteFeed
              debates={debates}
              fetchNextPage={vi.fn()}
              hasNextPage={true}
              isFetchingNextPage={false}
              isLoading={false}
              isError={false}
              refetch={vi.fn()}
            />
          );

          const feed = container.querySelector('[data-testid="infinite-feed"]');
          expect(feed).not.toBeNull();

          // Should render debate cards, not skeletons
          const skeletonCards = container.querySelectorAll('[data-testid="skeleton-debate-card"]');
          expect(skeletonCards.length).toBe(0);

          const debateCards = container.querySelectorAll('[data-testid="compact-debate-card"]');
          expect(debateCards.length).toBe(debates.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.4: Bottom spinner is visible when isFetchingNextPage is true (Requirement 5.2)', () => {
    fc.assert(
      fc.property(
        debatesArrayArb(1, 10),
        (debates) => {
          const { container } = render(
            <InfiniteFeed
              debates={debates}
              fetchNextPage={vi.fn()}
              hasNextPage={true}
              isFetchingNextPage={true}
              isLoading={false}
              isError={false}
              refetch={vi.fn()}
            />
          );

          const spinner = container.querySelector('[data-testid="loading-spinner"]');
          expect(spinner).not.toBeNull();
          expect(spinner?.getAttribute('role')).toBe('status');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.5: Feed remains scrollable when isFetchingNextPage is true (Requirement 5.2)', () => {
    fc.assert(
      fc.property(
        debatesArrayArb(1, 10),
        (debates) => {
          const { container } = render(
            <InfiniteFeed
              debates={debates}
              fetchNextPage={vi.fn()}
              hasNextPage={true}
              isFetchingNextPage={true}
              isLoading={false}
              isError={false}
              refetch={vi.fn()}
            />
          );

          // Feed should still be rendered with debate cards
          const feed = container.querySelector('[data-testid="infinite-feed"]');
          expect(feed).not.toBeNull();

          const debateCards = container.querySelectorAll('[data-testid="compact-debate-card"]');
          expect(debateCards.length).toBe(debates.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.6: Retry button is rendered when isError is true (Requirement 5.3)', () => {
    const { container } = render(
      <InfiniteFeed
        debates={[]}
        fetchNextPage={vi.fn()}
        hasNextPage={true}
        isFetchingNextPage={false}
        isLoading={false}
        isError={true}
        refetch={vi.fn()}
      />
    );

    const errorState = container.querySelector('[data-testid="error-state"]');
    expect(errorState).not.toBeNull();

    const retryButton = container.querySelector('[data-testid="retry-button"]');
    expect(retryButton).not.toBeNull();
    expect(retryButton?.textContent).toContain('Try Again');
  });

  it('Property 7.7: Retry button calls refetch when clicked (Requirement 5.3)', () => {
    const refetch = vi.fn();
    
    const { container } = render(
      <InfiniteFeed
        debates={[]}
        fetchNextPage={vi.fn()}
        hasNextPage={true}
        isFetchingNextPage={false}
        isLoading={false}
        isError={true}
        refetch={refetch}
      />
    );

    const retryButton = container.querySelector('[data-testid="retry-button"]') as HTMLButtonElement;
    retryButton?.click();

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('Property 7.8: Empty state is shown when debates array is empty and not loading (Requirement 5.1)', () => {
    const { container } = render(
      <InfiniteFeed
        debates={[]}
        fetchNextPage={vi.fn()}
        hasNextPage={false}
        isFetchingNextPage={false}
        isLoading={false}
        isError={false}
        refetch={vi.fn()}
      />
    );

    const emptyState = container.querySelector('[data-testid="empty-state"]');
    expect(emptyState).not.toBeNull();
    expect(emptyState?.textContent).toContain('No debates yet');
  });

  it('Property 7.9: Error state takes precedence over empty state', () => {
    const { container } = render(
      <InfiniteFeed
        debates={[]}
        fetchNextPage={vi.fn()}
        hasNextPage={false}
        isFetchingNextPage={false}
        isLoading={false}
        isError={true}
        refetch={vi.fn()}
      />
    );

    const errorState = container.querySelector('[data-testid="error-state"]');
    const emptyState = container.querySelector('[data-testid="empty-state"]');
    
    expect(errorState).not.toBeNull();
    expect(emptyState).toBeNull();
  });

  it('Property 7.10: Loading state takes precedence over error state', () => {
    const { container } = render(
      <InfiniteFeed
        debates={[]}
        fetchNextPage={vi.fn()}
        hasNextPage={true}
        isFetchingNextPage={false}
        isLoading={true}
        isError={true}
        refetch={vi.fn()}
      />
    );

    const loadingContainer = container.querySelector('[data-testid="infinite-feed-loading"]');
    const errorState = container.querySelector('[data-testid="error-state"]');
    
    expect(loadingContainer).not.toBeNull();
    expect(errorState).toBeNull();
  });
});


describe('InfiniteFeed Property Tests - Virtualization Threshold', () => {
  /**
   * Property 8: Virtualization Threshold
   * For any list size:
   * - When list size <= 50, virtualization SHALL NOT be enabled
   * - When list size > 50, virtualization SHALL be enabled
   * - Virtualized list SHALL only render visible items + overscan buffer
   * 
   * Validates: Requirements 5.4
   */

  it('Property 8.1: Virtualization is NOT enabled when list size <= threshold (Requirement 5.4)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: VIRTUALIZATION_CONFIG.threshold }),
        (listSize) => {
          // Generate exactly listSize debates
          const debates: DebateWithMarket[] = Array.from({ length: listSize }, (_, i) => ({
            debate: {
              id: `debate-${i}`,
              resolution: `Resolution ${i}`,
              status: 'active' as const,
              currentRound: 1 as const,
              currentTurn: 'support' as const,
              supportDebaterId: 'user-1',
              opposeDebaterId: 'user-2',
              createdAt: new Date(),
              concludedAt: null,
            },
            marketPrice: {
              supportPrice: 50,
              opposePrice: 50,
              totalVotes: 100,
              mindChangeCount: 5,
            },
          }));

          const { container } = render(
            <InfiniteFeed
              debates={debates}
              fetchNextPage={vi.fn()}
              hasNextPage={true}
              isFetchingNextPage={false}
              isLoading={false}
              isError={false}
              refetch={vi.fn()}
            />
          );

          const feed = container.querySelector('[data-testid="infinite-feed"]');
          expect(feed?.getAttribute('data-virtualized')).toBe('false');
          
          // Should NOT have virtualized container
          const virtualizedContainer = container.querySelector('[data-testid="virtualized-container"]');
          expect(virtualizedContainer).toBeNull();
          
          // All cards should be rendered directly
          const debateCards = container.querySelectorAll('[data-testid="compact-debate-card"]');
          expect(debateCards.length).toBe(listSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8.2: Virtualization IS enabled when list size > threshold (Requirement 5.4)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: VIRTUALIZATION_CONFIG.threshold + 1, max: VIRTUALIZATION_CONFIG.threshold + 50 }),
        (listSize) => {
          // Generate exactly listSize debates
          const debates: DebateWithMarket[] = Array.from({ length: listSize }, (_, i) => ({
            debate: {
              id: `debate-${i}`,
              resolution: `Resolution ${i}`,
              status: 'active' as const,
              currentRound: 1 as const,
              currentTurn: 'support' as const,
              supportDebaterId: 'user-1',
              opposeDebaterId: 'user-2',
              createdAt: new Date(),
              concludedAt: null,
            },
            marketPrice: {
              supportPrice: 50,
              opposePrice: 50,
              totalVotes: 100,
              mindChangeCount: 5,
            },
          }));

          const { container } = render(
            <InfiniteFeed
              debates={debates}
              fetchNextPage={vi.fn()}
              hasNextPage={true}
              isFetchingNextPage={false}
              isLoading={false}
              isError={false}
              refetch={vi.fn()}
            />
          );

          const feed = container.querySelector('[data-testid="infinite-feed"]');
          expect(feed?.getAttribute('data-virtualized')).toBe('true');
          
          // Should have virtualized container
          const virtualizedContainer = container.querySelector('[data-testid="virtualized-container"]');
          expect(virtualizedContainer).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8.3: Virtualized list renders fewer items than total count (Requirement 5.4)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: VIRTUALIZATION_CONFIG.threshold + 20, max: VIRTUALIZATION_CONFIG.threshold + 100 }),
        (listSize) => {
          // Generate exactly listSize debates
          const debates: DebateWithMarket[] = Array.from({ length: listSize }, (_, i) => ({
            debate: {
              id: `debate-${i}`,
              resolution: `Resolution ${i}`,
              status: 'active' as const,
              currentRound: 1 as const,
              currentTurn: 'support' as const,
              supportDebaterId: 'user-1',
              opposeDebaterId: 'user-2',
              createdAt: new Date(),
              concludedAt: null,
            },
            marketPrice: {
              supportPrice: 50,
              opposePrice: 50,
              totalVotes: 100,
              mindChangeCount: 5,
            },
          }));

          const { container } = render(
            <InfiniteFeed
              debates={debates}
              fetchNextPage={vi.fn()}
              hasNextPage={true}
              isFetchingNextPage={false}
              isLoading={false}
              isError={false}
              refetch={vi.fn()}
            />
          );

          // Virtualized list should render fewer items than total
          const debateCards = container.querySelectorAll('[data-testid="compact-debate-card"]');
          
          // Should render at most visible items + overscan (much less than total)
          // In jsdom, viewport is typically 0, so only overscan items are rendered
          expect(debateCards.length).toBeLessThan(listSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8.4: forceVirtualization=true enables virtualization regardless of list size (Requirement 5.4)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (listSize) => {
          const debates: DebateWithMarket[] = Array.from({ length: listSize }, (_, i) => ({
            debate: {
              id: `debate-${i}`,
              resolution: `Resolution ${i}`,
              status: 'active' as const,
              currentRound: 1 as const,
              currentTurn: 'support' as const,
              supportDebaterId: 'user-1',
              opposeDebaterId: 'user-2',
              createdAt: new Date(),
              concludedAt: null,
            },
            marketPrice: {
              supportPrice: 50,
              opposePrice: 50,
              totalVotes: 100,
              mindChangeCount: 5,
            },
          }));

          const { container } = render(
            <InfiniteFeed
              debates={debates}
              fetchNextPage={vi.fn()}
              hasNextPage={true}
              isFetchingNextPage={false}
              isLoading={false}
              isError={false}
              refetch={vi.fn()}
              forceVirtualization={true}
            />
          );

          const feed = container.querySelector('[data-testid="infinite-feed"]');
          expect(feed?.getAttribute('data-virtualized')).toBe('true');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8.5: forceVirtualization=false disables virtualization regardless of list size (Requirement 5.4)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: VIRTUALIZATION_CONFIG.threshold + 1, max: VIRTUALIZATION_CONFIG.threshold + 20 }),
        (listSize) => {
          const debates: DebateWithMarket[] = Array.from({ length: listSize }, (_, i) => ({
            debate: {
              id: `debate-${i}`,
              resolution: `Resolution ${i}`,
              status: 'active' as const,
              currentRound: 1 as const,
              currentTurn: 'support' as const,
              supportDebaterId: 'user-1',
              opposeDebaterId: 'user-2',
              createdAt: new Date(),
              concludedAt: null,
            },
            marketPrice: {
              supportPrice: 50,
              opposePrice: 50,
              totalVotes: 100,
              mindChangeCount: 5,
            },
          }));

          const { container } = render(
            <InfiniteFeed
              debates={debates}
              fetchNextPage={vi.fn()}
              hasNextPage={true}
              isFetchingNextPage={false}
              isLoading={false}
              isError={false}
              refetch={vi.fn()}
              forceVirtualization={false}
            />
          );

          const feed = container.querySelector('[data-testid="infinite-feed"]');
          expect(feed?.getAttribute('data-virtualized')).toBe('false');
          
          // All cards should be rendered
          const debateCards = container.querySelectorAll('[data-testid="compact-debate-card"]');
          expect(debateCards.length).toBe(listSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8.6: Virtualization threshold is exactly 50 items (Requirement 5.4)', () => {
    // Test boundary: 50 items should NOT virtualize
    const debates50: DebateWithMarket[] = Array.from({ length: 50 }, (_, i) => ({
      debate: {
        id: `debate-${i}`,
        resolution: `Resolution ${i}`,
        status: 'active' as const,
        currentRound: 1 as const,
        currentTurn: 'support' as const,
        supportDebaterId: 'user-1',
        opposeDebaterId: 'user-2',
        createdAt: new Date(),
        concludedAt: null,
      },
      marketPrice: {
        supportPrice: 50,
        opposePrice: 50,
        totalVotes: 100,
        mindChangeCount: 5,
      },
    }));

    const { container: container50 } = render(
      <InfiniteFeed
        debates={debates50}
        fetchNextPage={vi.fn()}
        hasNextPage={true}
        isFetchingNextPage={false}
        isLoading={false}
        isError={false}
        refetch={vi.fn()}
      />
    );

    const feed50 = container50.querySelector('[data-testid="infinite-feed"]');
    expect(feed50?.getAttribute('data-virtualized')).toBe('false');

    cleanup();

    // Test boundary: 51 items SHOULD virtualize
    const debates51: DebateWithMarket[] = Array.from({ length: 51 }, (_, i) => ({
      debate: {
        id: `debate-${i}`,
        resolution: `Resolution ${i}`,
        status: 'active' as const,
        currentRound: 1 as const,
        currentTurn: 'support' as const,
        supportDebaterId: 'user-1',
        opposeDebaterId: 'user-2',
        createdAt: new Date(),
        concludedAt: null,
      },
      marketPrice: {
        supportPrice: 50,
        opposePrice: 50,
        totalVotes: 100,
        mindChangeCount: 5,
      },
    }));

    const { container: container51 } = render(
      <InfiniteFeed
        debates={debates51}
        fetchNextPage={vi.fn()}
        hasNextPage={true}
        isFetchingNextPage={false}
        isLoading={false}
        isError={false}
        refetch={vi.fn()}
      />
    );

    const feed51 = container51.querySelector('[data-testid="infinite-feed"]');
    expect(feed51?.getAttribute('data-virtualized')).toBe('true');
  });

  it('Property 8.7: Virtualized container has correct total height (Requirement 5.4)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: VIRTUALIZATION_CONFIG.threshold + 1, max: VIRTUALIZATION_CONFIG.threshold + 30 }),
        (listSize) => {
          const debates: DebateWithMarket[] = Array.from({ length: listSize }, (_, i) => ({
            debate: {
              id: `debate-${i}`,
              resolution: `Resolution ${i}`,
              status: 'active' as const,
              currentRound: 1 as const,
              currentTurn: 'support' as const,
              supportDebaterId: 'user-1',
              opposeDebaterId: 'user-2',
              createdAt: new Date(),
              concludedAt: null,
            },
            marketPrice: {
              supportPrice: 50,
              opposePrice: 50,
              totalVotes: 100,
              mindChangeCount: 5,
            },
          }));

          const { container } = render(
            <InfiniteFeed
              debates={debates}
              fetchNextPage={vi.fn()}
              hasNextPage={true}
              isFetchingNextPage={false}
              isLoading={false}
              isError={false}
              refetch={vi.fn()}
            />
          );

          const virtualizedContainer = container.querySelector('[data-testid="virtualized-container"]');
          expect(virtualizedContainer).not.toBeNull();
          
          // Container should have height set for all items
          const style = virtualizedContainer?.getAttribute('style');
          expect(style).toContain('height:');
          
          // Height should be approximately listSize * estimatedItemHeight
          const expectedHeight = listSize * VIRTUALIZATION_CONFIG.estimatedItemHeight;
          expect(style).toContain(`${expectedHeight}px`);
        }
      ),
      { numRuns: 100 }
    );
  });
});
