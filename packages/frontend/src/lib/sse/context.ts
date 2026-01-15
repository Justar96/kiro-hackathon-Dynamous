/**
 * SSE Context
 * 
 * React context for SSE connection state.
 */

import { createContext, useContext } from 'react';
import type { SSEContextValue } from './types';

export const SSEContext = createContext<SSEContextValue | null>(null);

/**
 * Hook to access SSE context
 */
export function useSSEContext(): SSEContextValue | null {
  return useContext(SSEContext);
}
