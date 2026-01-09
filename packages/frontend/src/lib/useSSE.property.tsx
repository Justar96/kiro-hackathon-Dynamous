import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, act, cleanup } from '@testing-library/react';
import React from 'react';
import { SSEProvider, useSSE, useSSEContext, SSE_CONSTANTS } from './useSSE';

/**
 * Feature: uiux-improvements
 * Property 26: SSE Reconnection
 * 
 * For any SSE connection drop, the system SHALL attempt to reconnect within 5 seconds,
 * with exponential backoff on repeated failures.
 * 
 * Validates: Requirements 9.5
 */

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  
  url: string;
  readyState: number = 0; // CONNECTING
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  private eventListeners: Map<string, Set<(event: MessageEvent) => void>> = new Map();
  
  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
  
  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(listener);
  }
  
  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.eventListeners.get(type)?.delete(listener);
  }
  
  dispatchEvent(event: MessageEvent): boolean {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
    return true;
  }
  
  close() {
    this.readyState = 2; // CLOSED
  }
  
  // Test helpers
  simulateOpen() {
    this.readyState = 1; // OPEN
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }
  
  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
  
  simulateMessage(type: string, data: unknown) {
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    this.dispatchEvent(event);
  }
  
  static reset() {
    MockEventSource.instances = [];
  }
  
  static getLatest(): MockEventSource | undefined {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
  }
}

// Wrapper component for testing
function createWrapper(debateId?: string) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <SSEProvider debateId={debateId}>
        {children}
      </SSEProvider>
    );
  };
}

describe('useSSE Property Tests', () => {
  const originalEventSource = global.EventSource;
  
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
    MockEventSource.reset();
    // @ts-expect-error - Mocking EventSource
    global.EventSource = MockEventSource;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    global.EventSource = originalEventSource;
  });

  /**
   * Property 26: SSE Reconnection
   * Validates: Requirements 9.5
   */
  describe('Property 26: SSE Reconnection', () => {
    // Arbitrary for number of connection failures (1 to 5)
    const failureCountArbitrary = fc.integer({ min: 1, max: 5 });
    
    // Arbitrary for debate IDs
    const debateIdArbitrary = fc.string({ minLength: 1, maxLength: 20 })
      .filter(s => s.trim().length > 0);

    it('Should attempt reconnection within 5 seconds after connection drop', () => {
      fc.assert(
        fc.property(debateIdArbitrary, (debateId) => {
          cleanup();
          vi.useFakeTimers();
          MockEventSource.reset();
          
          const wrapper = createWrapper(debateId);
          const { result } = renderHook(() => useSSEContext(), { wrapper });
          
          // Get the initial EventSource instance
          const initialInstance = MockEventSource.getLatest();
          expect(initialInstance).toBeDefined();
          
          // Simulate successful connection
          act(() => {
            initialInstance!.simulateOpen();
          });
          
          expect(result.current?.connectionStatus).toBe('connected');
          
          // Simulate connection error
          act(() => {
            initialInstance!.simulateError();
          });
          
          expect(result.current?.connectionStatus).toBe('error');
          
          // Advance time by initial reconnect delay (1 second)
          act(() => {
            vi.advanceTimersByTime(SSE_CONSTANTS.INITIAL_RECONNECT_DELAY);
          });
          
          // Should have created a new EventSource instance (reconnection attempt)
          const reconnectInstance = MockEventSource.getLatest();
          expect(reconnectInstance).not.toBe(initialInstance);
          expect(MockEventSource.instances.length).toBe(2);
          
          vi.useRealTimers();
        }),
        { numRuns: 100 }
      );
    });

    it('Should use exponential backoff on repeated failures', () => {
      fc.assert(
        fc.property(
          debateIdArbitrary,
          failureCountArbitrary,
          (debateId, failureCount) => {
            cleanup();
            vi.useFakeTimers();
            MockEventSource.reset();
            
            const wrapper = createWrapper(debateId);
            renderHook(() => useSSEContext(), { wrapper });
            
            let expectedDelay = SSE_CONSTANTS.INITIAL_RECONNECT_DELAY;
            
            for (let i = 0; i < failureCount; i++) {
              const currentInstance = MockEventSource.getLatest();
              expect(currentInstance).toBeDefined();
              
              // Simulate connection error
              act(() => {
                currentInstance!.simulateError();
              });
              
              const instanceCountBefore = MockEventSource.instances.length;
              
              // Advance time by expected delay
              act(() => {
                vi.advanceTimersByTime(expectedDelay);
              });
              
              // Should have created a new instance
              expect(MockEventSource.instances.length).toBe(instanceCountBefore + 1);
              
              // Calculate next expected delay with exponential backoff
              expectedDelay = Math.min(
                expectedDelay * SSE_CONSTANTS.RECONNECT_BACKOFF_MULTIPLIER,
                SSE_CONSTANTS.MAX_RECONNECT_DELAY
              );
            }
            
            vi.useRealTimers();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Should cap reconnection delay at maximum value', () => {
      fc.assert(
        fc.property(debateIdArbitrary, (debateId) => {
          cleanup();
          vi.useFakeTimers();
          MockEventSource.reset();
          
          const wrapper = createWrapper(debateId);
          renderHook(() => useSSEContext(), { wrapper });
          
          // Calculate how many failures needed to reach max delay
          let delay = SSE_CONSTANTS.INITIAL_RECONNECT_DELAY;
          let failuresNeeded = 0;
          while (delay < SSE_CONSTANTS.MAX_RECONNECT_DELAY) {
            delay *= SSE_CONSTANTS.RECONNECT_BACKOFF_MULTIPLIER;
            failuresNeeded++;
          }
          
          // Simulate failures to reach max delay
          for (let i = 0; i <= failuresNeeded; i++) {
            const currentInstance = MockEventSource.getLatest();
            act(() => {
              currentInstance!.simulateError();
            });
            
            // Advance by max delay to ensure reconnection
            act(() => {
              vi.advanceTimersByTime(SSE_CONSTANTS.MAX_RECONNECT_DELAY);
            });
          }
          
          // Now simulate one more failure
          const instanceCountBefore = MockEventSource.instances.length;
          const currentInstance = MockEventSource.getLatest();
          
          act(() => {
            currentInstance!.simulateError();
          });
          
          // Advance by max delay
          act(() => {
            vi.advanceTimersByTime(SSE_CONSTANTS.MAX_RECONNECT_DELAY);
          });
          
          // Should have reconnected (delay should be capped at max)
          expect(MockEventSource.instances.length).toBe(instanceCountBefore + 1);
          
          vi.useRealTimers();
        }),
        { numRuns: 100 }
      );
    });

    it('Should reset reconnection delay after successful connection', () => {
      fc.assert(
        fc.property(debateIdArbitrary, (debateId) => {
          cleanup();
          vi.useFakeTimers();
          MockEventSource.reset();
          
          const wrapper = createWrapper(debateId);
          const { result } = renderHook(() => useSSEContext(), { wrapper });
          
          // Simulate initial connection
          let currentInstance = MockEventSource.getLatest();
          act(() => {
            currentInstance!.simulateOpen();
          });
          
          // Simulate first failure
          act(() => {
            currentInstance!.simulateError();
          });
          
          // Wait for first reconnection (1s)
          act(() => {
            vi.advanceTimersByTime(SSE_CONSTANTS.INITIAL_RECONNECT_DELAY);
          });
          
          // Simulate second failure (should wait 2s)
          currentInstance = MockEventSource.getLatest();
          act(() => {
            currentInstance!.simulateError();
          });
          
          act(() => {
            vi.advanceTimersByTime(SSE_CONSTANTS.INITIAL_RECONNECT_DELAY * 2);
          });
          
          // Now simulate successful connection
          currentInstance = MockEventSource.getLatest();
          act(() => {
            currentInstance!.simulateOpen();
          });
          
          expect(result.current?.connectionStatus).toBe('connected');
          
          // Simulate another failure
          act(() => {
            currentInstance!.simulateError();
          });
          
          const instanceCountBefore = MockEventSource.instances.length;
          
          // Should reconnect after initial delay (1s), not the accumulated delay
          act(() => {
            vi.advanceTimersByTime(SSE_CONSTANTS.INITIAL_RECONNECT_DELAY);
          });
          
          expect(MockEventSource.instances.length).toBe(instanceCountBefore + 1);
          
          vi.useRealTimers();
        }),
        { numRuns: 100 }
      );
    });

    it('Should not attempt reconnection when debateId is not provided', () => {
      fc.assert(
        fc.property(fc.boolean(), () => {
          cleanup();
          vi.useFakeTimers();
          MockEventSource.reset();
          
          // Create provider without debateId
          const wrapper = createWrapper(undefined);
          const { result } = renderHook(() => useSSEContext(), { wrapper });
          
          // Should not create any EventSource instances
          expect(MockEventSource.instances.length).toBe(0);
          expect(result.current?.connectionStatus).toBe('disconnected');
          
          vi.useRealTimers();
        }),
        { numRuns: 100 }
      );
    });

    it('Connection status should transition correctly through states', () => {
      fc.assert(
        fc.property(debateIdArbitrary, (debateId) => {
          cleanup();
          vi.useFakeTimers();
          MockEventSource.reset();
          
          const wrapper = createWrapper(debateId);
          const { result } = renderHook(() => useSSEContext(), { wrapper });
          
          // Initial state should be connecting
          expect(result.current?.connectionStatus).toBe('connecting');
          
          // Simulate successful connection
          const instance = MockEventSource.getLatest();
          act(() => {
            instance!.simulateOpen();
          });
          
          expect(result.current?.connectionStatus).toBe('connected');
          expect(result.current?.isConnected).toBe(true);
          
          // Simulate error
          act(() => {
            instance!.simulateError();
          });
          
          expect(result.current?.connectionStatus).toBe('error');
          expect(result.current?.isConnected).toBe(false);
          
          vi.useRealTimers();
        }),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * Feature: uiux-improvements
 * Property 27: Real-Time Event Propagation
 * 
 * For any server event (stance update, new comment, round advance), 
 * the UI SHALL reflect the change within 5 seconds of the event occurring.
 * 
 * Validates: Requirements 9.1, 9.2, 9.3
 */
describe('Property 27: Real-Time Event Propagation', () => {
  const originalEventSource = global.EventSource;
  
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
    MockEventSource.reset();
    // @ts-expect-error - Mocking EventSource
    global.EventSource = MockEventSource;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    global.EventSource = originalEventSource;
  });

  // Arbitrary for debate IDs
  const debateIdArbitrary = fc.string({ minLength: 1, maxLength: 20 })
    .filter(s => s.trim().length > 0);

  // Arbitrary for market price data
  const marketPriceArbitrary = fc.record({
    supportPrice: fc.integer({ min: 0, max: 100 }),
    opposePrice: fc.integer({ min: 0, max: 100 }),
    totalVotes: fc.integer({ min: 0, max: 1000 }),
  });

  // Arbitrary for comment data
  const commentArbitrary = fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    debateId: fc.string({ minLength: 1, maxLength: 20 }),
    userId: fc.string({ minLength: 1, maxLength: 20 }),
    content: fc.string({ minLength: 1, maxLength: 500 }),
    parentId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
    createdAt: fc.date().map(d => d.toISOString()),
  });

  // Arbitrary for round data
  const roundArbitrary = fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    debateId: fc.string({ minLength: 1, maxLength: 20 }),
    roundNumber: fc.integer({ min: 1, max: 3 }),
    status: fc.constantFrom('pending', 'active', 'complete'),
  });

  it('Market events should be received by subscribers', () => {
    fc.assert(
      fc.property(
        debateIdArbitrary,
        marketPriceArbitrary,
        (debateId, marketData) => {
          cleanup();
          vi.useFakeTimers();
          MockEventSource.reset();
          
          const receivedEvents: unknown[] = [];
          
          const wrapper = createWrapper(debateId);
          renderHook(
            () => useSSE('market', (data: unknown) => {
              receivedEvents.push(data);
            }),
            { wrapper }
          );
          
          // Simulate connection
          const instance = MockEventSource.getLatest();
          act(() => {
            instance!.simulateOpen();
          });
          
          // Simulate market event
          act(() => {
            instance!.simulateMessage('market', marketData);
          });
          
          // Event should be received
          expect(receivedEvents.length).toBe(1);
          expect(receivedEvents[0]).toEqual(marketData);
          
          vi.useRealTimers();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Comment events should be received by subscribers', () => {
    fc.assert(
      fc.property(
        debateIdArbitrary,
        commentArbitrary,
        (debateId, commentData) => {
          cleanup();
          vi.useFakeTimers();
          MockEventSource.reset();
          
          const receivedEvents: unknown[] = [];
          
          const wrapper = createWrapper(debateId);
          renderHook(
            () => useSSE('comment', (data: unknown) => {
              receivedEvents.push(data);
            }),
            { wrapper }
          );
          
          // Simulate connection
          const instance = MockEventSource.getLatest();
          act(() => {
            instance!.simulateOpen();
          });
          
          // Simulate comment event
          act(() => {
            instance!.simulateMessage('comment', { comment: commentData });
          });
          
          // Event should be received
          expect(receivedEvents.length).toBe(1);
          expect(receivedEvents[0]).toEqual({ comment: commentData });
          
          vi.useRealTimers();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Round events should be received by subscribers', () => {
    fc.assert(
      fc.property(
        debateIdArbitrary,
        roundArbitrary,
        (debateId, roundData) => {
          cleanup();
          vi.useFakeTimers();
          MockEventSource.reset();
          
          const receivedEvents: unknown[] = [];
          
          const wrapper = createWrapper(debateId);
          renderHook(
            () => useSSE('round', (data: unknown) => {
              receivedEvents.push(data);
            }),
            { wrapper }
          );
          
          // Simulate connection
          const instance = MockEventSource.getLatest();
          act(() => {
            instance!.simulateOpen();
          });
          
          // Simulate round event
          act(() => {
            instance!.simulateMessage('round', roundData);
          });
          
          // Event should be received
          expect(receivedEvents.length).toBe(1);
          expect(receivedEvents[0]).toEqual(roundData);
          
          vi.useRealTimers();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Multiple subscribers should all receive events', () => {
    fc.assert(
      fc.property(
        debateIdArbitrary,
        marketPriceArbitrary,
        (debateId, marketData) => {
          cleanup();
          vi.useFakeTimers();
          MockEventSource.reset();
          
          const receivedBySubscriber1: unknown[] = [];
          const receivedBySubscriber2: unknown[] = [];
          
          // Create a custom hook that uses multiple useSSE subscriptions
          function useMultipleSubscribers() {
            useSSE('market', (data: unknown) => {
              receivedBySubscriber1.push(data);
            });
            useSSE('market', (data: unknown) => {
              receivedBySubscriber2.push(data);
            });
            return { sub1: receivedBySubscriber1, sub2: receivedBySubscriber2 };
          }
          
          const wrapper = createWrapper(debateId);
          renderHook(() => useMultipleSubscribers(), { wrapper });
          
          // Simulate connection
          const instance = MockEventSource.getLatest();
          act(() => {
            instance!.simulateOpen();
          });
          
          // Simulate market event
          act(() => {
            instance!.simulateMessage('market', marketData);
          });
          
          // Both subscribers should receive the event
          expect(receivedBySubscriber1.length).toBe(1);
          expect(receivedBySubscriber1[0]).toEqual(marketData);
          expect(receivedBySubscriber2.length).toBe(1);
          expect(receivedBySubscriber2[0]).toEqual(marketData);
          
          vi.useRealTimers();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Unsubscribed handlers should not receive events', () => {
    fc.assert(
      fc.property(
        debateIdArbitrary,
        marketPriceArbitrary,
        (debateId, marketData) => {
          cleanup();
          vi.useFakeTimers();
          MockEventSource.reset();
          
          const receivedEvents: unknown[] = [];
          
          const wrapper = createWrapper(debateId);
          const { unmount } = renderHook(
            () => useSSE('market', (data: unknown) => {
              receivedEvents.push(data);
            }),
            { wrapper }
          );
          
          // Simulate connection
          const instance = MockEventSource.getLatest();
          act(() => {
            instance!.simulateOpen();
          });
          
          // Unmount (unsubscribe)
          unmount();
          
          // Simulate market event after unsubscribe
          act(() => {
            instance!.simulateMessage('market', marketData);
          });
          
          // Should NOT receive the event
          expect(receivedEvents.length).toBe(0);
          
          vi.useRealTimers();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Events should only be received by matching event type subscribers', () => {
    fc.assert(
      fc.property(
        debateIdArbitrary,
        marketPriceArbitrary,
        commentArbitrary,
        (debateId, marketData, commentData) => {
          cleanup();
          vi.useFakeTimers();
          MockEventSource.reset();
          
          const marketEvents: unknown[] = [];
          const commentEvents: unknown[] = [];
          
          // Create a custom hook that subscribes to both event types
          function useMultiTypeSubscribers() {
            useSSE('market', (data: unknown) => {
              marketEvents.push(data);
            });
            useSSE('comment', (data: unknown) => {
              commentEvents.push(data);
            });
            return { market: marketEvents, comment: commentEvents };
          }
          
          const wrapper = createWrapper(debateId);
          renderHook(() => useMultiTypeSubscribers(), { wrapper });
          
          // Simulate connection
          const instance = MockEventSource.getLatest();
          act(() => {
            instance!.simulateOpen();
          });
          
          // Simulate market event
          act(() => {
            instance!.simulateMessage('market', marketData);
          });
          
          // Simulate comment event
          act(() => {
            instance!.simulateMessage('comment', { comment: commentData });
          });
          
          // Market subscriber should only receive market events
          expect(marketEvents.length).toBe(1);
          expect(marketEvents[0]).toEqual(marketData);
          
          // Comment subscriber should only receive comment events
          expect(commentEvents.length).toBe(1);
          expect(commentEvents[0]).toEqual({ comment: commentData });
          
          vi.useRealTimers();
        }
      ),
      { numRuns: 100 }
    );
  });
});
