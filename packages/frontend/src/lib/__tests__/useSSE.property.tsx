import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { type ReactNode } from 'react';
import { SSEProvider, useSSEContext, calculateBackoffDelay, SSE_CONSTANTS } from '../sse';
import * as fc from 'fast-check';

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  static autoConnect = true;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState: number = 0;
  private eventListeners: Map<string, ((event: MessageEvent) => void)[]> = new Map();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    // Auto-connect after a microtask if enabled
    if (MockEventSource.autoConnect) {
      queueMicrotask(() => {
        this.simulateOpen();
      });
    }
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  dispatchEvent() { return true; }

  close() {
    this.readyState = 2;
  }

  simulateOpen() {
    this.readyState = 1;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  simulateMessage(data: string) {
    const event = new MessageEvent('message', { data });
    if (this.onmessage) {
      this.onmessage(event);
    }
  }

  simulateTypedEvent(type: string, data: string) {
    const event = new MessageEvent(type, { data });
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
  }

  simulateError() {
    this.readyState = 2;
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }

  static reset() {
    MockEventSource.instances = [];
    MockEventSource.autoConnect = true;
  }

  static getLastInstance() {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
  }
}

const originalEventSource = global.EventSource;

describe('SSEProvider', () => {
  let queryClient: QueryClient;

  const createWrapper = (debateId?: string) => {
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <SSEProvider debateId={debateId}>{children}</SSEProvider>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    MockEventSource.reset();
    (global as unknown as { EventSource: typeof MockEventSource }).EventSource = MockEventSource;
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
  });

  afterEach(() => {
    (global as unknown as { EventSource: typeof EventSource }).EventSource = originalEventSource;
    queryClient.clear();
  });

  it('should provide SSE context to children', () => {
    const { result } = renderHook(() => useSSEContext(), { wrapper: createWrapper() });
    expect(result.current).toBeDefined();
  });

  it('should connect to SSE endpoint when debateId is provided', async () => {
    renderHook(() => useSSEContext(), { wrapper: createWrapper('test-debate-123') });

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBeGreaterThan(0);
    });
    expect(MockEventSource.getLastInstance()?.url).toContain('test-debate-123');
  });

  it('should update connection state on open', async () => {
    const { result } = renderHook(() => useSSEContext(), { wrapper: createWrapper('test-debate-123') });

    await waitFor(() => {
      expect(result.current?.isConnected).toBe(true);
    });
    expect(result.current?.connectionStatus).toBe('connected');
  });

  it('should handle connection errors', async () => {
    const { result } = renderHook(() => useSSEContext(), { wrapper: createWrapper('test-debate-123') });

    await waitFor(() => {
      expect(result.current?.isConnected).toBe(true);
    });

    const instance = MockEventSource.getLastInstance();
    act(() => {
      instance?.simulateError();
    });

    await waitFor(() => {
      expect(result.current?.isConnected).toBe(false);
    });
  });

  it('should close connection on unmount', async () => {
    const { result, unmount } = renderHook(() => useSSEContext(), { wrapper: createWrapper('test-debate-123') });

    await waitFor(() => {
      expect(result.current?.isConnected).toBe(true);
    });

    const instance = MockEventSource.getLastInstance();
    const closeSpy = vi.spyOn(instance!, 'close');

    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });

  it('should allow subscribing to events', async () => {
    const handler = vi.fn();
    const { result } = renderHook(() => {
      const context = useSSEContext();
      React.useEffect(() => {
        if (context) {
          return context.subscribe('market', handler);
        }
      }, [context]);
      return context;
    }, { wrapper: createWrapper('test-debate-123') });

    await waitFor(() => {
      expect(result.current?.isConnected).toBe(true);
    });

    const instance = MockEventSource.getLastInstance();
    act(() => {
      instance?.simulateTypedEvent('market', JSON.stringify({ price: 0.65 }));
    });

    await waitFor(() => {
      expect(handler).toHaveBeenCalledWith({ price: 0.65 });
    });
  });
});

describe('calculateBackoffDelay', () => {
  it('should return initial delay for first attempt', () => {
    expect(calculateBackoffDelay(1)).toBe(SSE_CONSTANTS.INITIAL_RECONNECT_DELAY);
  });

  it('should double delay for each subsequent attempt', () => {
    expect(calculateBackoffDelay(2)).toBe(2000);
    expect(calculateBackoffDelay(3)).toBe(4000);
    expect(calculateBackoffDelay(4)).toBe(8000);
  });

  it('should cap at max delay', () => {
    expect(calculateBackoffDelay(10)).toBe(SSE_CONSTANTS.MAX_RECONNECT_DELAY);
    expect(calculateBackoffDelay(20)).toBe(SSE_CONSTANTS.MAX_RECONNECT_DELAY);
  });

  describe('Property-based tests', () => {
    it('Property 7: Exponential Backoff Reconnection - delay should follow exponential formula', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          (attemptNumber) => {
            const delay = calculateBackoffDelay(attemptNumber);
            const expectedDelay = Math.min(
              Math.pow(2, attemptNumber - 1) * SSE_CONSTANTS.INITIAL_RECONNECT_DELAY,
              SSE_CONSTANTS.MAX_RECONNECT_DELAY
            );
            return delay === expectedDelay;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property 7: delay should always be positive', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10, max: 100 }),
          (attemptNumber) => {
            const delay = calculateBackoffDelay(attemptNumber);
            return delay > 0;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property 7: delay should never exceed max', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          (attemptNumber) => {
            const delay = calculateBackoffDelay(attemptNumber);
            return delay <= SSE_CONSTANTS.MAX_RECONNECT_DELAY;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property 7: delay should be monotonically increasing until max', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (attemptNumber) => {
            const delay1 = calculateBackoffDelay(attemptNumber);
            const delay2 = calculateBackoffDelay(attemptNumber + 1);
            // Either delay2 >= delay1, or both are at max
            return delay2 >= delay1 || (delay1 === SSE_CONSTANTS.MAX_RECONNECT_DELAY && delay2 === SSE_CONSTANTS.MAX_RECONNECT_DELAY);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

describe('Circuit Breaker Constants', () => {
  it('Property 9: Circuit breaker threshold should be positive', () => {
    expect(SSE_CONSTANTS.CIRCUIT_BREAKER_THRESHOLD).toBeGreaterThan(0);
  });

  it('Property 9: Circuit breaker reset time should be reasonable', () => {
    expect(SSE_CONSTANTS.CIRCUIT_BREAKER_RESET_TIME).toBeGreaterThanOrEqual(30000);
    expect(SSE_CONSTANTS.CIRCUIT_BREAKER_RESET_TIME).toBeLessThanOrEqual(120000);
  });

  it('Property 9: Max reconnect attempts should be reasonable', () => {
    expect(SSE_CONSTANTS.MAX_RECONNECT_ATTEMPTS).toBeGreaterThan(SSE_CONSTANTS.CIRCUIT_BREAKER_THRESHOLD);
  });
});

describe('SSE Event Handling', () => {
  let queryClient: QueryClient;

  const createWrapper = (debateId?: string) => {
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <SSEProvider debateId={debateId}>{children}</SSEProvider>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    MockEventSource.reset();
    (global as unknown as { EventSource: typeof MockEventSource }).EventSource = MockEventSource;
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
  });

  afterEach(() => {
    (global as unknown as { EventSource: typeof EventSource }).EventSource = originalEventSource;
    queryClient.clear();
  });

  describe('Property-based tests', () => {
    it('should handle any valid JSON message through subscription', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            price: fc.float({ min: 0, max: 1, noNaN: true }),
            timestamp: fc.date().map(d => d.toISOString()),
          }),
          async (messageData) => {
            const handler = vi.fn();
            const { result, unmount } = renderHook(() => {
              const context = useSSEContext();
              React.useEffect(() => {
                if (context) {
                  return context.subscribe('market', handler);
                }
              }, [context]);
              return context;
            }, { wrapper: createWrapper('test-debate') });

            await waitFor(() => {
              expect(result.current?.isConnected).toBe(true);
            }, { timeout: 1000 });

            const instance = MockEventSource.getLastInstance();
            act(() => {
              instance?.simulateTypedEvent('market', JSON.stringify(messageData));
            });

            await waitFor(() => {
              expect(handler).toHaveBeenCalledWith(messageData);
            }, { timeout: 1000 });

            unmount();
            MockEventSource.reset();
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should handle multiple event types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('market', 'comment', 'round', 'argument', 'reaction', 'steelman', 'debate-join'),
          async (eventType) => {
            const handler = vi.fn();
            const { result, unmount } = renderHook(() => {
              const context = useSSEContext();
              React.useEffect(() => {
                if (context) {
                  return context.subscribe(eventType, handler);
                }
              }, [context]);
              return context;
            }, { wrapper: createWrapper('test-debate') });

            await waitFor(() => {
              expect(result.current?.isConnected).toBe(true);
            }, { timeout: 1000 });

            const instance = MockEventSource.getLastInstance();
            const testData = { type: eventType, id: 'test-123' };
            
            act(() => {
              instance?.simulateTypedEvent(eventType, JSON.stringify(testData));
            });

            await waitFor(() => {
              expect(handler).toHaveBeenCalledWith(testData);
            }, { timeout: 1000 });

            unmount();
            MockEventSource.reset();
          }
        ),
        { numRuns: 7 }
      );
    });
  });
});
