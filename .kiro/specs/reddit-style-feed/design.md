# Design Document: Reddit-Style Feed

## Overview

This design transforms the debate index page from a static list to a modern, Reddit-style infinite scroll feed. The architecture separates concerns between data fetching (infinite query), virtualization (performance), and presentation (compact cards). The trending section relocates to the right rail, freeing the center column for focused content browsing.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     IndexThreeColumnLayout                       │
├──────────────┬─────────────────────────────┬────────────────────┤
│  Left Rail   │      Center Column          │    Right Rail      │
│              │                             │                    │
│ Quick Actions│  ┌─────────────────────┐   │ ┌────────────────┐ │
│ How It Works │  │   Feed Header       │   │ │ Trending Now   │ │
│ Seeking Opp. │  │   (Tabs, Title)     │   │ │ (Relocated)    │ │
│ Progress     │  └─────────────────────┘   │ └────────────────┘ │
│              │  ┌─────────────────────┐   │ ┌────────────────┐ │
│              │  │   VirtualizedFeed   │   │ │ Most Persuasive│ │
│              │  │   ┌───────────────┐ │   │ └────────────────┘ │
│              │  │   │ DebateCard    │ │   │ ┌────────────────┐ │
│              │  │   └───────────────┘ │   │ │ Platform Stats │ │
│              │  │   ┌───────────────┐ │   │ └────────────────┘ │
│              │  │   │ DebateCard    │ │   │                    │
│              │  │   └───────────────┘ │   │                    │
│              │  │   ┌───────────────┐ │   │                    │
│              │  │   │ LoadingMore   │ │   │                    │
│              │  │   └───────────────┘ │   │                    │
│              │  └─────────────────────┘   │                    │
└──────────────┴─────────────────────────────┴────────────────────┘
```

### Data Flow

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Backend    │────▶│ useInfiniteQuery│────▶│ VirtualizedFeed  │
│   /debates   │     │ (TanStack Query)│     │ (react-virtual)  │
└──────────────┘     └─────────────────┘     └──────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │ Intersection    │
                     │ Observer        │
                     │ (Auto-fetch)    │
                     └─────────────────┘
```

## Components and Interfaces

### 1. InfiniteFeed Component

The main feed container managing infinite scroll and virtualization.

```typescript
interface InfiniteFeedProps {
  initialData?: DebateWithMarket[];
  pageSize?: number;
  onDebateClick?: (debateId: string) => void;
  userStances?: Record<string, number>;
  onQuickStance?: (debateId: string, side: 'support' | 'oppose') => void;
  isAuthenticated?: boolean;
}

interface UseInfiniteDebatesResult {
  debates: DebateWithMarket[];
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}
```

### 2. CompactDebateCard Component

A redesigned, compact card optimized for feed density.

```typescript
interface CompactDebateCardProps {
  debate: Debate;
  marketPrice?: MarketPrice | null;
  userStance?: number | null;
  onQuickStance?: (side: 'support' | 'oppose') => void;
  isAuthenticated?: boolean;
  isPrefetching?: boolean;
}

// Card dimensions for consistent feed density
const CARD_CONFIG = {
  minHeight: 120,
  maxHeight: 160,
  padding: 16,
  gap: 12,
};
```

### 3. TrendingRail Component

Relocated trending section for the right rail.

```typescript
interface TrendingRailProps {
  debates: DebateWithMarket[];
  maxCount?: number;
  onDebateClick?: (debateId: string) => void;
}

interface TrendingDebateItemProps {
  debate: Debate;
  marketPrice?: MarketPrice | null;
  rank: number;
}
```

### 4. useInfiniteDebates Hook

Custom hook wrapping TanStack Query's useInfiniteQuery.

```typescript
interface UseInfiniteDebatesOptions {
  pageSize?: number;
  filter?: 'all' | 'my-debates';
  userId?: string;
}

function useInfiniteDebates(options: UseInfiniteDebatesOptions): UseInfiniteDebatesResult;
```

### 5. useScrollRestoration Hook

Manages scroll position persistence across navigation.

```typescript
interface UseScrollRestorationOptions {
  key: string;
  enabled?: boolean;
}

function useScrollRestoration(options: UseScrollRestorationOptions): {
  scrollRef: React.RefObject<HTMLDivElement>;
  savePosition: () => void;
  restorePosition: () => void;
};
```

## Data Models

### Backend Pagination Response

```typescript
interface PaginatedDebatesResponse {
  debates: DebateWithMarket[];
  nextCursor?: string;
  hasMore: boolean;
  totalCount: number;
}

// API endpoint: GET /api/debates?cursor={cursor}&limit={limit}&filter={filter}
```

### Feed State

```typescript
interface FeedState {
  scrollPosition: number;
  loadedPages: number;
  activeFilter: 'all' | 'my-debates';
  userStances: Record<string, number>;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Infinite Scroll State Machine

*For any* scroll position and loading state combination, the feed SHALL:
- Trigger fetchNextPage when scroll position is within 200px of bottom AND hasNextPage is true AND not currently fetching
- Display loading indicator when isFetchingNextPage is true
- Display end-of-feed message when hasNextPage is false

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Scroll Position Preservation

*For any* feed with loaded debates, when new content is appended, the scroll position relative to existing content SHALL remain unchanged. Additionally, when navigating away and returning, the saved scroll position SHALL be restored.

**Validates: Requirements 1.4, 1.5**

### Property 3: Debate Card Data Display

*For any* debate with market price data, the CompactDebateCard SHALL:
- Display support/oppose bar with widths matching the percentage values
- Display mind change count when count > 0
- Display correct status badge based on debate.status and opposeDebaterId
- Display round information for active debates
- Show pulsing indicator when debate.status === 'active'
- Render sparkline SVG with data points

**Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6, 2.8**

### Property 4: Quick Stance Interaction

*For any* authenticated user viewing a debate card:
- Quick stance buttons SHALL be rendered
- Clicking a stance button SHALL call onQuickStance with correct debateId and side
- Clicking a stance button SHALL NOT trigger navigation (event propagation stopped)
- After stance is recorded, the card SHALL display the user's stance visually
- If user has existing stance, it SHALL be displayed on initial render

**Validates: Requirements 3.3, 3.4, 3.5, 3.6**

### Property 5: Card Navigation

*For any* debate card, clicking the card (outside of quick stance buttons) SHALL navigate to `/debates/{debateId}`.

**Validates: Requirements 3.2**

### Property 6: Trending Section Data

*For any* list of debates, the TrendingRail SHALL:
- Display at most maxCount (default 5) debates
- Sort debates by activity (mind changes, then recency)
- Display resolution, support percentage, and mind change count for each item
- Navigate to correct debate page when item is clicked

**Validates: Requirements 4.2, 4.3, 4.4**

### Property 7: Loading State Rendering

*For any* feed state:
- When isLoading is true, skeleton cards SHALL be rendered
- When isFetchingNextPage is true, bottom spinner SHALL be visible AND feed SHALL remain scrollable
- When isError is true, retry button SHALL be rendered

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 8: Virtualization Threshold

*For any* feed with more than 50 debates, virtualization SHALL be active (only visible items + buffer rendered in DOM).

**Validates: Requirements 5.4**

### Property 9: Responsive Layout Adaptation

*For any* viewport width:
- Below 768px: Trending section hidden, cards full width
- All interactive elements SHALL have minimum 44px touch target
- Quick stance buttons SHALL be larger on mobile viewports

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

## Error Handling

### Network Errors
- Display inline error message with retry button
- Preserve existing loaded content on error
- Show toast notification for transient errors

### Empty States
- "No debates yet" message for empty feed
- "No more debates" message at end of infinite scroll
- "No trending debates" when no active debates exist

### Loading Failures
- Skeleton timeout after 10 seconds shows error state
- Partial load failures show loaded content with error indicator

## Testing Strategy

### Property-Based Tests (fast-check)

Property-based tests will validate universal properties across generated inputs:

1. **Infinite scroll state machine** - Generate scroll positions and loading states, verify correct behavior
2. **Card data display** - Generate debates with various market prices, verify all fields render correctly
3. **Quick stance interactions** - Generate auth states and stance values, verify button behavior
4. **Trending section limits** - Generate debate lists of various sizes, verify max count respected
5. **Loading state rendering** - Generate loading state combinations, verify correct UI
6. **Responsive breakpoints** - Generate viewport widths, verify layout changes

Configuration:
- Minimum 100 iterations per property test
- Use `@tanstack/react-testing-library` for component rendering
- Use `fast-check` for input generation

### Unit Tests

Unit tests will cover specific examples and edge cases:

1. **Empty feed rendering** - Verify empty state message
2. **Single debate card** - Verify all elements present
3. **Error state with retry** - Verify retry button functionality
4. **Scroll restoration** - Verify position saved/restored correctly
5. **Prefetch on hover** - Verify prefetch triggered after delay

### Integration Tests

1. **Full feed flow** - Load, scroll, load more, navigate, return
2. **Quick stance flow** - Click stance, verify optimistic update, verify persistence
3. **Trending to detail navigation** - Click trending item, verify navigation

