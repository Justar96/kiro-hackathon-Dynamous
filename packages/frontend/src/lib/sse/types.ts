/**
 * SSE Types
 * 
 * Type definitions for Server-Sent Events handling.
 */

import type { ReactNode } from 'react';

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
