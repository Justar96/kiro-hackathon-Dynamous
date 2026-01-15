/**
 * SSE Provider Component
 * 
 * Provider component that manages SSE connection lifecycle.
 * Handles connection, reconnection with exponential backoff, and circuit breaker.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { SSEContext } from './context';
import {
  INITIAL_RECONNECT_DELAY,
  MAX_RECONNECT_DELAY,
  RECONNECT_BACKOFF_MULTIPLIER,
  MAX_RECONNECT_ATTEMPTS,
  CIRCUIT_BREAKER_THRESHOLD,
  CIRCUIT_BREAKER_RESET_TIME,
  calculateBackoffDelay,
} from './constants';
import type { SSEConnectionStatus, SSEProviderProps, SSEContextValue } from './types';

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
  
  // Fix: Use ref to track circuit breaker state to avoid dependency loop
  const isCircuitBreakerActiveRef = useRef(false);
  // Track circuit breaker reset count for extended backoff
  const circuitBreakerResetCountRef = useRef(0);

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

    // Fix: Check ref instead of state to avoid dependency loop (Requirement 12.3)
    if (isCircuitBreakerActiveRef.current) {
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
      // Reset circuit breaker count on successful connection
      circuitBreakerResetCountRef.current = 0;
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
        // Fix: Set ref to track circuit breaker state
        isCircuitBreakerActiveRef.current = true;
        circuitBreakerResetCountRef.current += 1;
        setConnectionStatus('circuit-breaker');
        
        // Calculate extended wait time based on reset count (progressive backoff)
        const extendedResetTime = Math.min(
          CIRCUIT_BREAKER_RESET_TIME * Math.pow(2, circuitBreakerResetCountRef.current - 1),
          5 * 60 * 1000 // Cap at 5 minutes
        );
        
        // Schedule circuit breaker reset
        circuitBreakerTimeoutRef.current = setTimeout(() => {
          if (!isUnmountedRef.current) {
            // Fix: Clear circuit breaker ref
            isCircuitBreakerActiveRef.current = false;
            consecutiveErrorsRef.current = 0;
            reconnectAttemptsRef.current = 0;
            reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
            setConnectionStatus('disconnected');
            
            // Apply initial backoff delay before reconnecting
            const initialDelay = calculateBackoffDelay(1);
            setTimeout(() => {
              if (!isUnmountedRef.current) {
                connect();
              }
            }, initialDelay);
          }
        }, extendedResetTime);
        
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

    // Event type handlers
    const eventTypes = ['market', 'comment', 'round', 'argument', 'reaction', 'steelman', 'debate-join'];
    
    eventTypes.forEach((eventType) => {
      eventSource.addEventListener(eventType, (event) => {
        if (isUnmountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          const handlers = subscribersRef.current.get(eventType);
          if (handlers) {
            handlers.forEach((handler) => handler(data));
          }
        } catch (e) {
          console.error(`Failed to parse ${eventType} event:`, e);
        }
      });
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
  }, [debateId, cleanup, onReconnect]);

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
    // Fix: Reset circuit breaker ref
    isCircuitBreakerActiveRef.current = false;
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
