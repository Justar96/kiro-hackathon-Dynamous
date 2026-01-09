import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

export type SSEConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface SSEContextValue {
  isConnected: boolean;
  connectionStatus: SSEConnectionStatus;
  subscribe: <T>(event: string, handler: (data: T) => void) => () => void;
  debateId: string | null;
}

export interface SSEProviderProps {
  children: ReactNode;
  debateId?: string;
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

// ============================================================================
// Context
// ============================================================================

const SSEContext = createContext<SSEContextValue | null>(null);

// ============================================================================
// SSEProvider Component
// ============================================================================

export function SSEProvider({ children, debateId }: SSEProviderProps) {
  const [connectionStatus, setConnectionStatus] = useState<SSEConnectionStatus>('disconnected');
  const eventSourceRef = useRef<EventSource | null>(null);
  const subscribersRef = useRef<Map<string, Set<(data: unknown) => void>>>(new Map());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectAttemptsRef = useRef(0);
  const isUnmountedRef = useRef(false);

  // Clean up function for EventSource
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Connect to SSE endpoint
  const connect = useCallback(() => {
    if (!debateId || isUnmountedRef.current) return;

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
    };

    eventSource.onerror = () => {
      if (isUnmountedRef.current) return;
      
      eventSource.close();
      eventSourceRef.current = null;
      setConnectionStatus('error');

      // Schedule reconnection with exponential backoff
      const delay = Math.min(reconnectDelayRef.current, MAX_RECONNECT_DELAY);
      reconnectAttemptsRef.current += 1;
      
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

  const contextValue: SSEContextValue = {
    isConnected: connectionStatus === 'connected',
    connectionStatus,
    subscribe,
    debateId: debateId || null,
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
};
