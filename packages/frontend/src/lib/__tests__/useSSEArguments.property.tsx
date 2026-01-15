import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { useSSEArguments } from './useSSEArguments';
import { SSEProvider } from './useSSE';
import * as fc from 'fast-check';

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState: number = 0;
  private eventListeners: Map<string, ((event: MessageEvent) => void)[]> = new Map();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    // Auto-connect after a microtask
    queueMicrotask(() => {
      this.simulateOpen();
    });
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
  }

  static getLastInstance() {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
  }
}

const originalEventSource = global.EventSource;

describe('useSSEArguments', () => {
  let queryClient: QueryClient;
  const debateId = 'test-debate-123';

  const createWrapper = () => {
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

  it('should connect to SSE and return connection status', async () => {
    const { result } = renderHook(
      () => useSSEArguments(debateId),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
    expect(result.current.connectionStatus).toBe('connected');
  });

  it('should track new argument ID for highlight animation', async () => {
    const { result } = renderHook(
      () => useSSEArguments(debateId),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const instance = MockEventSource.getLastInstance();
    const argumentData = {
      argumentId: 'arg-new',
      content: 'New argument',
      debaterId: 'debater-1',
      side: 'support',
      roundNumber: 1,
      createdAt: new Date().toISOString(),
    };

    act(() => {
      instance?.simulateTypedEvent('argument', JSON.stringify(argumentData));
    });

    await waitFor(() => {
      expect(result.current.newArgumentId).toBe('arg-new');
    });
  });

  it('should handle connection errors gracefully', async () => {
    const { result } = renderHook(
      () => useSSEArguments(debateId),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const instance = MockEventSource.getLastInstance();
    act(() => {
      instance?.simulateError();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('Property-based tests', () => {
    it('Property 5: should handle any valid argument data and track argument ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            argumentId: fc.uuid(),
            content: fc.string({ minLength: 1, maxLength: 100 }),
            debaterId: fc.uuid(),
            side: fc.constantFrom('support' as const, 'oppose' as const),
            roundNumber: fc.constantFrom(1 as const, 2 as const, 3 as const),
          }),
          async (argumentData) => {
            const testDebateId = 'test-debate';

            const testWrapper = ({ children }: { children: ReactNode }) => (
              <QueryClientProvider client={queryClient}>
                <SSEProvider debateId={testDebateId}>{children}</SSEProvider>
              </QueryClientProvider>
            );

            const { result, unmount } = renderHook(
              () => useSSEArguments(testDebateId),
              { wrapper: testWrapper }
            );

            await waitFor(() => {
              expect(result.current.isConnected).toBe(true);
            }, { timeout: 1000 });

            const instance = MockEventSource.getLastInstance();
            const message = {
              ...argumentData,
              createdAt: new Date().toISOString(),
            };

            act(() => {
              instance?.simulateTypedEvent('argument', JSON.stringify(message));
            });

            await waitFor(() => {
              expect(result.current.newArgumentId).toBe(argumentData.argumentId);
            }, { timeout: 1000 });

            unmount();
            MockEventSource.reset();
            queryClient.clear();
          }
        ),
        { numRuns: 5 }
      );
    });

    it('Property 5: should handle multiple argument events in sequence', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              argumentId: fc.uuid(),
              content: fc.string({ minLength: 1, maxLength: 50 }),
              debaterId: fc.uuid(),
              side: fc.constantFrom('support' as const, 'oppose' as const),
              roundNumber: fc.constantFrom(1 as const, 2 as const, 3 as const),
            }),
            { minLength: 1, maxLength: 3 }
          ),
          async (events) => {
            const testDebateId = 'test-debate';

            const testWrapper = ({ children }: { children: ReactNode }) => (
              <QueryClientProvider client={queryClient}>
                <SSEProvider debateId={testDebateId}>{children}</SSEProvider>
              </QueryClientProvider>
            );

            const { result, unmount } = renderHook(
              () => useSSEArguments(testDebateId),
              { wrapper: testWrapper }
            );

            await waitFor(() => {
              expect(result.current.isConnected).toBe(true);
            }, { timeout: 1000 });

            const instance = MockEventSource.getLastInstance();

            for (const event of events) {
              act(() => {
                instance?.simulateTypedEvent('argument', JSON.stringify({
                  ...event,
                  createdAt: new Date().toISOString(),
                }));
              });
            }

            // Last event's argument ID should be tracked
            const lastEvent = events[events.length - 1];
            await waitFor(() => {
              expect(result.current.newArgumentId).toBe(lastEvent.argumentId);
            }, { timeout: 1000 });

            unmount();
            MockEventSource.reset();
            queryClient.clear();
          }
        ),
        { numRuns: 5 }
      );
    });

    it('Property 5: argument IDs should always be strings', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (argumentId) => {
            const testDebateId = 'test-debate';

            const testWrapper = ({ children }: { children: ReactNode }) => (
              <QueryClientProvider client={queryClient}>
                <SSEProvider debateId={testDebateId}>{children}</SSEProvider>
              </QueryClientProvider>
            );

            const { result, unmount } = renderHook(
              () => useSSEArguments(testDebateId),
              { wrapper: testWrapper }
            );

            await waitFor(() => {
              expect(result.current.isConnected).toBe(true);
            }, { timeout: 1000 });

            const instance = MockEventSource.getLastInstance();
            act(() => {
              instance?.simulateTypedEvent('argument', JSON.stringify({
                argumentId,
                content: 'Test content',
                debaterId: 'debater-1',
                side: 'support',
                roundNumber: 1,
                createdAt: new Date().toISOString(),
              }));
            });

            await waitFor(() => {
              expect(typeof result.current.newArgumentId).toBe('string');
              expect(result.current.newArgumentId).toBe(argumentId);
            }, { timeout: 1000 });

            unmount();
            MockEventSource.reset();
            queryClient.clear();
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});
