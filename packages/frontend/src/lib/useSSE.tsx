import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

export type SSEConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'circuit-breaker';

export interface SSEContextValue {
  isConnected: boolean;
  connectionStatus: SSEConnectionStatus;
  subscribe: <T>(event: string, handler: (data: T) => void) => () => void;
  debateId: string | null;
  reconnect: () => void;
  errorCount: number;
}

export interface SSEProviderProps {
  children: ReactNode;
  debateId?: string;
  onReconnect?: () => void;
}

export interface SSEEvent<T = unknown> {
  event: string;
  data: T;
}

// ============================================================================
// Constants
// ============================================================================

const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const RECONNECT_BACKOFF_MULTIPLIER = 2;
const MAX_RECONNECT_ATTEMPTS = 10; // Requirement 8.6
const CIRCUIT_BREAKER_THRESHOLD = 3; // Requirement 12.3
const CIRCUIT_BREAKER_RESET_TIME = 60000; // 60 seconds (Requirement 12.3)

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate exponential backoff delay for reconnection attempts.
 * Formula: min(2^(N-1) * 1000ms, 30000ms) where N is the attempt number
 * Requirement 8.1
 * 
 * @param attemptNumber - The current reconnection attempt (1-indexed)
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(attemptNumber: number): number {
  // Ensure attemptNumber is at least 1
  const n = Math.max(1, attemptNumber);
  // Calculate: 2^(n-1) * 1000, capped at MAX_RECONNECT_DELAY
  const delay = Math.pow(RECONNECT_BACKOFF_MULTIPLIER, n - 1) * INITIAL_RECONNECT_DELAY;
  return Math.min(delay, MAX_RECONNECT_DELAY);
}

// ============================================================================
// Context
// ============================================================================

const SSEContext = createContext<SSEContextValue | null>(null);

// ============================================================================
// SSEProvider Component
// ============================================================================

export function SSEProvider({ children, debateId, onReconnect }: SSEProviderProps) {
  const [connectionStatus, setConnectionStatus] = useState<SSEConnectionStatus>('disconnected');
  const [errorCount, setErrorCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const subscribersRef = useRef<Map<string, Set<(data: unknown) => void>>>(new Map());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const circuitBreakerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectAttemptsRef = useRef(0);
  const consecutiveErrorsRef = useRef(0);
  const isUnmountedRef = useRef(false);

  // Clean up function for EventSource
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (circuitBreakerTimeoutRef.current) {
      clearTimeout(circuitBreakerTimeoutRef.current);
      circuitBreakerTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Connect to SSE endpoint
  const connect = useCallback(() => {
    if (!debateId || isUnmountedRef.current) return;

    // Check if circuit breaker is active (Requirement 12.3)
    if (connectionStatus === 'circuit-breaker') {
      return;
    }

    // Check if max reconnection attempts reached (Requirement 8.6)
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionStatus('error');
      return;
    }

    cleanup();
    setConnectionStatus('connecting');

    const url = `/api/debates/${debateId}/stream`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (isUnmountedRef.current) return;
      setConnectionStatus('connected');
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
      reconnectAttemptsRef.current = 0;
      consecutiveErrorsRef.current = 0;
      setErrorCount(0);
      
      // Fire onReconnect callback if this was a reconnection
      if (onReconnect) {
        onReconnect();
      }
    };

    eventSource.onerror = () => {
      if (isUnmountedRef.current) return;
      
      eventSource.close();
      eventSourceRef.current = null;
      
      // Increment error counters
      consecutiveErrorsRef.current += 1;
      setErrorCount((count) => count + 1);
      reconnectAttemptsRef.current += 1;

      // Check if circuit breaker should activate (Requirement 12.3)
      if (consecutiveErrorsRef.current >= CIRCUIT_BREAKER_THRESHOLD) {
        setConnectionStatus('circuit-breaker');
        
        // Schedule circuit breaker reset
        circuitBreakerTimeoutRef.current = setTimeout(() => {
          if (!isUnmountedRef.current) {
            consecutiveErrorsRef.current = 0;
            reconnectAttemptsRef.current = 0;
            reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
            setConnectionStatus('disconnected');
            // Auto-reconnect after circuit breaker reset
            connect();
          }
        }, CIRCUIT_BREAKER_RESET_TIME);
        
        return;
      }

      // Check if max attempts reached (Requirement 8.6)
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        setConnectionStatus('error');
        return;
      }

      setConnectionStatus('error');

      // Schedule reconnection with exponential backoff (Requirement 8.1)
      const delay = calculateBackoffDelay(reconnectAttemptsRef.current);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        if (!isUnmountedRef.current) {
          reconnectDelayRef.current = Math.min(
            reconnectDelayRef.current * RECONNECT_BACKOFF_MULTIPLIER,
            MAX_RECONNECT_DELAY
          );
          connect();
        }
      }, delay);
    };

    // Handle market events
    eventSource.addEventListener('market', (event) => {
      if (isUnmountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        const handlers = subscribersRef.current.get('market');
        if (handlers) {
          handlers.forEach((handler) => handler(data));
        }
      } catch (e) {
        console.error('Failed to parse market event:', e);
      }
    });

    // Handle comment events
    eventSource.addEventListener('comment', (event) => {
      if (isUnmountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        const handlers = subscribersRef.current.get('comment');
        if (handlers) {
          handlers.forEach((handler) => handler(data));
        }
      } catch (e) {
        console.error('Failed to parse comment event:', e);
      }
    });

    // Handle round events
    eventSource.addEventListener('round', (event) => {
      if (isUnmountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        const handlers = subscribersRef.current.get('round');
        if (handlers) {
          handlers.forEach((handler) => handler(data));
        }
      } catch (e) {
        console.error('Failed to parse round event:', e);
      }
    });

    // Handle argument events
    eventSource.addEventListener('argument', (event) => {
      if (isUnmountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        const handlers = subscribersRef.current.get('argument');
        if (handlers) {
          handlers.forEach((handler) => handler(data));
        }
      } catch (e) {
        console.error('Failed to parse argument event:', e);
      }
    });

    // Handle reaction events
    eventSource.addEventListener('reaction', (event) => {
      if (isUnmountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        const handlers = subscribersRef.current.get('reaction');
        if (handlers) {
          handlers.forEach((handler) => handler(data));
        }
      } catch (e) {
        console.error('Failed to parse reaction event:', e);
      }
    });

    // Handle steelman events
    eventSource.addEventListener('steelman', (event) => {
      if (isUnmountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        const handlers = subscribersRef.current.get('steelman');
        if (handlers) {
          handlers.forEach((handler) => handler(data));
        }
      } catch (e) {
        console.error('Failed to parse steelman event:', e);
      }
    });

    // Handle debate-join events
    eventSource.addEventListener('debate-join', (event) => {
      if (isUnmountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        const handlers = subscribersRef.current.get('debate-join');
        if (handlers) {
          handlers.forEach((handler) => handler(data));
        }
      } catch (e) {
        console.error('Failed to parse debate-join event:', e);
      }
    });

    // Handle heartbeat events (keep-alive)
    eventSource.addEventListener('heartbeat', () => {
      // Heartbeat received, connection is alive
    });

    // Handle generic message events
    eventSource.onmessage = (event) => {
      if (isUnmountedRef.current) return;
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.event && parsed.data) {
          const handlers = subscribersRef.current.get(parsed.event);
          if (handlers) {
            handlers.forEach((handler) => handler(parsed.data));
          }
        }
      } catch {
        // Not JSON or doesn't have expected structure, ignore
      }
    };
  }, [debateId, cleanup]);

  // Subscribe to specific event types
  const subscribe = useCallback(<T,>(event: string, handler: (data: T) => void): (() => void) => {
    if (!subscribersRef.current.has(event)) {
      subscribersRef.current.set(event, new Set());
    }
    
    const handlers = subscribersRef.current.get(event)!;
    handlers.add(handler as (data: unknown) => void);

    // Return unsubscribe function
    return () => {
      handlers.delete(handler as (data: unknown) => void);
      if (handlers.size === 0) {
        subscribersRef.current.delete(event);
      }
    };
  }, []);

  // Connect when debateId changes
  useEffect(() => {
    isUnmountedRef.current = false;

    if (debateId) {
      connect();
    } else {
      cleanup();
      setConnectionStatus('disconnected');
    }

    return () => {
      isUnmountedRef.current = true;
      cleanup();
    };
  }, [debateId, connect, cleanup]);

  // Manual reconnect function (Requirement 8.6, 12.3)
  const reconnect = useCallback(() => {
    // Reset all counters
    consecutiveErrorsRef.current = 0;
    reconnectAttemptsRef.current = 0;
    reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
    setErrorCount(0);
    
    // Clear any pending timeouts
    if (circuitBreakerTimeoutRef.current) {
      clearTimeout(circuitBreakerTimeoutRef.current);
      circuitBreakerTimeoutRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Reset status and attempt connection
    setConnectionStatus('disconnected');
    
    // Use setTimeout to ensure state is updated before connecting
    setTimeout(() => {
      if (!isUnmountedRef.current && debateId) {
        connect();
      }
    }, 0);
  }, [debateId, connect]);

  const contextValue: SSEContextValue = {
    isConnected: connectionStatus === 'connected',
    connectionStatus,
    subscribe,
    debateId: debateId || null,
    reconnect,
    errorCount,
  };

  return (
    <SSEContext.Provider value={contextValue}>
      {children}
    </SSEContext.Provider>
  );
}

// ============================================================================
// useSSEContext Hook
// ============================================================================

export function useSSEContext(): SSEContextValue | null {
  return useContext(SSEContext);
}

// ============================================================================
// useSSE Hook
// ============================================================================

/**
 * Hook for subscribing to SSE events.
 * 
 * @param eventType - The type of event to subscribe to (e.g., 'market', 'comment', 'round')
 * @param handler - Callback function to handle the event data
 * @param deps - Optional dependency array for the handler
 * @returns Object with connection status information
 */
export function useSSE<T>(
  eventType: string,
  handler: (data: T) => void,
  deps: React.DependencyList = []
): {
  isConnected: boolean;
  connectionStatus: SSEConnectionStatus;
} {
  const context = useSSEContext();
  
  // Memoize handler to prevent unnecessary re-subscriptions
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!context) return;

    const wrappedHandler = (data: T) => {
      handlerRef.current(data);
    };

    const unsubscribe = context.subscribe<T>(eventType, wrappedHandler);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, eventType, ...deps]);

  return {
    isConnected: context?.isConnected ?? false,
    connectionStatus: context?.connectionStatus ?? 'disconnected',
  };
}

// ============================================================================
// Exports for testing
// ============================================================================

export const SSE_CONSTANTS = {
  INITIAL_RECONNECT_DELAY,
  MAX_RECONNECT_DELAY,
  RECONNECT_BACKOFF_MULTIPLIER,
  MAX_RECONNECT_ATTEMPTS,
  CIRCUIT_BREAKER_THRESHOLD,
  CIRCUIT_BREAKER_RESET_TIME,
};
