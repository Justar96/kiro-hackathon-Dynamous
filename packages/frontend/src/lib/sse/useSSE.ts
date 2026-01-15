/**
 * useSSE Hook
 * 
 * Hook for subscribing to SSE events.
 */

import { useEffect, useRef } from 'react';
import { useSSEContext } from './context';
import type { SSEConnectionStatus } from './types';

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
