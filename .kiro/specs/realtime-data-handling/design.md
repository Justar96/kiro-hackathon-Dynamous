# Design Document: Real-Time Data Handling

## Overview

This design document outlines the architecture for comprehensive real-time data handling in Thesis. The solution integrates Server-Sent Events (SSE) with TanStack Query cache management to provide live updates across all platform features.

The architecture follows a unified broadcast pattern on the backend and a hook-based subscription pattern on the frontend, ensuring consistent behavior across all real-time features while maintaining compatibility with existing optimistic update patterns.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              REAL-TIME ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                           BACKEND (Hono)                                  │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐   │   │
│  │  │  API Endpoints  │  │ Broadcast Module│  │  Connection Manager     │   │   │
│  │  │  (mutations)    │──│ broadcastEvent()│──│  debateConnections Map  │   │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────┘   │   │
│  │           │                    │                       │                  │   │
│  │           ▼                    ▼                       ▼                  │   │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                    SSE Stream Endpoint                               │ │   │
│  │  │                 GET /api/debates/:id/stream                          │ │   │
│  │  │  Events: market | comment | argument | reaction | round | steelman   │ │   │
│  │  └─────────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                           │
│                                      │ SSE                                       │
│                                      ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                          FRONTEND (React)                                 │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐   │   │
│  │  │   SSEProvider   │  │ useSSEQuerySync │  │   TanStack Query        │   │   │
│  │  │   (Context)     │──│ (Cache Updates) │──│   queryClient           │   │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────┘   │   │
│  │           │                    │                       │                  │   │
│  │           ▼                    ▼                       ▼                  │   │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                    Event-Specific Hooks                              │ │   │
│  │  │  useSSEMarket | useSSEComments | useSSEArguments | useSSEReactions   │ │   │
│  │  └─────────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Backend Components

#### BroadcastModule

Centralized module for all SSE broadcasts.

```typescript
// packages/backend/src/broadcast.ts

type EventType = 'market' | 'comment' | 'argument' | 'reaction' | 'round' | 'steelman' | 'debate-join';

interface BroadcastPayload {
  market: MarketPrice;
  comment: { action: 'add'; comment: Comment; parentId?: string | null };
  argument: { argumentId: string; roundNumber: number; side: Side; content: string; debaterId: string; createdAt: Date };
  reaction: { argumentId: string; reactionType: string; counts: ReactionCounts };
  round: { debateId: string; newRoundNumber: number; currentTurn: Side; previousRoundCompleted: boolean; status?: 'concluded' };
  steelman: { steelmanId: string; debateId: string; roundNumber: number; status: SteelmanStatus; rejectionReason?: string };
  'debate-join': { debateId: string; opposeDebaterId: string; opposeDebaterUsername: string };
}

interface BroadcastModule {
  broadcastDebateEvent<T extends EventType>(
    debateId: string,
    eventType: T,
    payload: BroadcastPayload[T]
  ): void;
  
  getConnectionCount(debateId: string): number;
  
  cleanupStaleConnections(): void;
}
```

#### ConnectionManager

Manages SSE connections per debate.

```typescript
// packages/backend/src/connections.ts

interface Connection {
  id: string;
  debateId: string;
  sendEvent: (event: string, data: string) => Promise<void>;
  lastHeartbeat: Date;
  createdAt: Date;
}

interface ConnectionManager {
  connections: Map<string, Set<Connection>>;
  
  addConnection(debateId: string, connection: Connection): void;
  removeConnection(debateId: string, connectionId: string): void;
  getConnections(debateId: string): Set<Connection>;
  broadcastToDebate(debateId: string, event: string, data: unknown): void;
}
```

### Frontend Components

#### SSEProvider Enhancement

Enhanced context provider with connection state management.

```typescript
// packages/frontend/src/lib/useSSE.tsx

interface SSEContextValue {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error' | 'circuit-breaker';
  subscribe: <T>(event: EventType, handler: (data: T) => void) => () => void;
  debateId: string | null;
  reconnect: () => void;
  errorCount: number;
}

interface SSEProviderProps {
  children: ReactNode;
  debateId?: string;
  onReconnect?: () => void;
}
```

#### useSSEQuerySync Hook

Generic hook for syncing SSE events with TanStack Query cache.

```typescript
// packages/frontend/src/lib/useSSEQuerySync.ts

interface UseSSEQuerySyncOptions<T> {
  eventType: EventType;
  queryKey: QueryKey;
  updateFn: (oldData: T | undefined, eventData: unknown) => T;
  shouldUpdate?: (eventData: unknown, currentData: T | undefined) => boolean;
  onUpdate?: (eventData: unknown) => void;
}

function useSSEQuerySync<T>(options: UseSSEQuerySyncOptions<T>): {
  isConnected: boolean;
  lastUpdate: Date | null;
}
```

#### Event-Specific Hooks

```typescript
// packages/frontend/src/lib/useSSEMarket.ts
function useSSEMarket(debateId: string): {
  isConnected: boolean;
  lastUpdate: Date | null;
}

// packages/frontend/src/lib/useSSEArguments.ts
function useSSEArguments(debateId: string): {
  isConnected: boolean;
  newArgumentId: string | null;
}

// packages/frontend/src/lib/useSSEReactions.ts
function useSSEReactions(argumentId: string): {
  isConnected: boolean;
}

// packages/frontend/src/lib/useSSERound.ts
function useSSERound(debateId: string): {
  isConnected: boolean;
  roundTransition: { from: number; to: number } | null;
}
```

#### IndexPagePolling Hook

```typescript
// packages/frontend/src/lib/useIndexPolling.ts

interface UseIndexPollingOptions {
  enabled?: boolean;
  interval?: number; // default: 15000ms
  pauseWhenHidden?: boolean; // default: true
}

function useIndexPolling(options?: UseIndexPollingOptions): {
  isPolling: boolean;
  lastRefresh: Date | null;
  refresh: () => void;
  pausePolling: () => void;
  resumePolling: () => void;
}
```

## Data Models

### SSE Event Schemas

```typescript
// packages/shared/src/sse-events.ts

interface SSEEventBase {
  timestamp: string;
  debateId: string;
}

interface MarketEvent extends SSEEventBase {
  type: 'market';
  data: {
    supportPrice: number;
    opposePrice: number;
    totalVotes: number;
    mindChangeCount: number;
  };
}

interface CommentEvent extends SSEEventBase {
  type: 'comment';
  data: {
    action: 'add';
    comment: Comment;
    parentId: string | null;
  };
}

interface ArgumentEvent extends SSEEventBase {
  type: 'argument';
  data: {
    argumentId: string;
    roundNumber: 1 | 2 | 3;
    side: 'support' | 'oppose';
    content: string;
    debaterId: string;
    createdAt: string;
  };
}

interface ReactionEvent extends SSEEventBase {
  type: 'reaction';
  data: {
    argumentId: string;
    reactionType: 'agree' | 'strong_reasoning';
    counts: {
      agree: number;
      strongReasoning: number;
    };
  };
}

interface RoundEvent extends SSEEventBase {
  type: 'round';
  data: {
    newRoundNumber: 1 | 2 | 3;
    currentTurn: 'support' | 'oppose';
    previousRoundCompleted: boolean;
    status?: 'active' | 'concluded';
  };
}

interface SteelmanEvent extends SSEEventBase {
  type: 'steelman';
  data: {
    steelmanId: string;
    roundNumber: 2 | 3;
    status: 'pending' | 'approved' | 'rejected';
    rejectionReason?: string;
    authorId: string;
  };
}

interface DebateJoinEvent extends SSEEventBase {
  type: 'debate-join';
  data: {
    opposeDebaterId: string;
    opposeDebaterUsername: string;
  };
}

type SSEEvent = MarketEvent | CommentEvent | ArgumentEvent | ReactionEvent | RoundEvent | SteelmanEvent | DebateJoinEvent;
```

### Connection State

```typescript
// packages/frontend/src/lib/connectionState.ts

interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error' | 'circuit-breaker';
  reconnectAttempts: number;
  lastConnected: Date | null;
  lastError: Error | null;
  errorCount: number;
  circuitBreakerUntil: Date | null;
}

const INITIAL_CONNECTION_STATE: ConnectionState = {
  status: 'disconnected',
  reconnectAttempts: 0,
  lastConnected: null,
  lastError: null,
  errorCount: 0,
  circuitBreakerUntil: null,
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Broadcast Delivery Completeness

*For any* broadcast event and any set of connected clients, all clients in the connection pool for that debate SHALL receive the event.

**Validates: Requirements 1.2**

### Property 2: Event Schema Compliance

*For any* broadcast event of a given type, the serialized payload SHALL conform to the defined schema for that event type, containing all required fields.

**Validates: Requirements 1.5, 2.6, 3.2, 4.2, 5.2, 6.4, 10.3, 11.2**

### Property 3: Broadcast Trigger Consistency

*For any* mutation that modifies shared state (stance, argument, reaction, comment, round, steelman, debate-join), the backend SHALL trigger a corresponding broadcast event.

**Validates: Requirements 2.1, 2.2, 3.1, 4.1, 5.1, 6.1, 10.1, 10.2, 11.1**

### Property 4: Cache Update Correctness

*For any* SSE event received by the frontend, the TanStack Query cache for the corresponding query key SHALL be updated to reflect the event data.

**Validates: Requirements 2.3, 3.3, 4.3, 5.3, 6.3, 9.1, 11.3**

### Property 5: Optimistic Update Deduplication

*For any* SSE event where the current user is the actor, the frontend SHALL NOT create duplicate entries when reconciling optimistic updates with broadcast data.

**Validates: Requirements 3.5, 6.2**

### Property 6: User Reaction State Isolation

*For any* reaction broadcast event, the frontend SHALL NOT modify the current user's own reaction state; only aggregate counts SHALL be updated from broadcasts.

**Validates: Requirements 4.4**

### Property 7: Exponential Backoff Reconnection

*For any* sequence of N consecutive connection failures (N ≤ 10), the reconnection delay SHALL equal min(2^(N-1) * 1000ms, 30000ms).

**Validates: Requirements 8.1**

### Property 8: Connection Cleanup on Navigation

*For any* navigation event that unmounts the SSEProvider, the EventSource connection SHALL be closed and removed from memory.

**Validates: Requirements 8.5**

### Property 9: Circuit Breaker Activation

*For any* sequence of 3 consecutive SSE errors within a short window, the frontend SHALL enter circuit-breaker state and pause reconnection for 60 seconds.

**Validates: Requirements 12.3**

### Property 10: Malformed Event Resilience

*For any* SSE event containing malformed JSON, the frontend SHALL log the error and continue processing subsequent events without crashing.

**Validates: Requirements 12.1**

### Property 11: Cache Preservation on Update

*For any* cache update from SSE, fields not present in the event payload SHALL retain their previous values.

**Validates: Requirements 9.3**

### Property 12: Polling Pause on Tab Hidden

*For any* period where the browser tab is not visible, the index page polling SHALL be paused, and SHALL resume when the tab becomes visible again.

**Validates: Requirements 7.6**

### Property 13: Reconnection Cache Invalidation

*For any* successful reconnection after a disconnect, the frontend SHALL invalidate queries that may have missed updates during the disconnect period.

**Validates: Requirements 8.3**

### Property 14: Connection Failure Limit

*For any* sequence of 10 consecutive reconnection failures, the frontend SHALL stop automatic reconnection and display a manual retry option.

**Validates: Requirements 8.6**

### Property 15: Fallback to Polling on 404

*For any* SSE endpoint that returns 404, the frontend SHALL fall back to polling mode for that debate's data.

**Validates: Requirements 12.6**

## Error Handling

### Backend Error Handling

1. **Connection Failures During Broadcast**
   - Catch errors when writing to individual connections
   - Remove failed connections from the pool
   - Continue broadcasting to remaining connections
   - Log connection cleanup for monitoring

2. **Invalid Event Types**
   - Validate event type before broadcast
   - Log warning for unknown event types
   - Skip broadcast for invalid types

3. **Serialization Errors**
   - Wrap JSON.stringify in try-catch
   - Log serialization failures with payload info
   - Skip broadcast for unserializable payloads

### Frontend Error Handling

1. **Malformed SSE Events**
   - Wrap JSON.parse in try-catch
   - Log parsing errors with raw event data
   - Continue processing subsequent events

2. **Cache Update Failures**
   - Catch errors in setQueryData callbacks
   - Trigger full query invalidation as fallback
   - Log cache update failures

3. **Circuit Breaker Pattern**
   - Track consecutive error count
   - After 3 errors, enter circuit-breaker state
   - Pause reconnection for 60 seconds
   - Show user-facing banner with retry option

4. **Connection State Recovery**
   - On reconnect, invalidate stale queries
   - Fetch fresh data for critical queries
   - Clear error state on successful reconnect

## Testing Strategy

### Unit Tests

Unit tests verify specific examples and edge cases:

1. **BroadcastModule**
   - Test broadcast to empty connection pool (no error)
   - Test broadcast with single connection
   - Test connection cleanup on failure

2. **SSEProvider**
   - Test initial connection establishment
   - Test cleanup on unmount
   - Test status transitions

3. **useSSEQuerySync**
   - Test cache update with valid event
   - Test deduplication logic
   - Test shouldUpdate predicate

### Property-Based Tests

Property tests verify universal properties across all inputs using fast-check:

1. **Event Schema Compliance** (Property 2)
   - Generate random payloads for each event type
   - Verify serialized output contains required fields
   - Tag: **Feature: realtime-data-handling, Property 2: Event Schema Compliance**

2. **Exponential Backoff** (Property 7)
   - Generate random failure counts (1-10)
   - Verify delay calculation matches formula
   - Tag: **Feature: realtime-data-handling, Property 7: Exponential Backoff Reconnection**

3. **Cache Preservation** (Property 11)
   - Generate random existing cache state
   - Generate random partial update
   - Verify unchanged fields preserved
   - Tag: **Feature: realtime-data-handling, Property 11: Cache Preservation on Update**

4. **Deduplication** (Property 5)
   - Generate random optimistic IDs
   - Generate matching broadcast events
   - Verify no duplicates in final state
   - Tag: **Feature: realtime-data-handling, Property 5: Optimistic Update Deduplication**

5. **Circuit Breaker** (Property 9)
   - Generate random error sequences
   - Verify circuit breaker activates after 3 consecutive errors
   - Tag: **Feature: realtime-data-handling, Property 9: Circuit Breaker Activation**

### Integration Tests

1. **End-to-End Broadcast Flow**
   - Submit stance → verify market broadcast received
   - Submit argument → verify argument broadcast received
   - Add reaction → verify reaction broadcast received

2. **Reconnection Scenarios**
   - Simulate network disconnect
   - Verify reconnection with backoff
   - Verify cache invalidation on reconnect

3. **Index Page Polling**
   - Verify polling starts on mount
   - Verify polling pauses on tab hidden
   - Verify manual refresh works

### Test Configuration

- Minimum 100 iterations per property test
- Use fast-check for property-based testing
- Mock EventSource for frontend tests
- Use in-memory connection store for backend tests
