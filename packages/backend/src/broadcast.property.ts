/**
 * Feature: realtime-data-handling, Property 2: Event Schema Compliance
 * Validates: Requirements 1.5, 2.6, 3.2, 4.2, 5.2, 6.4, 10.3, 11.2
 * 
 * For any broadcast event of a given type, the serialized payload SHALL conform
 * to the defined schema for that event type, containing all required fields.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  SSE_EVENT_REQUIRED_FIELDS,
  validateEventPayload,
  type SSEEventType,
} from '@debate-platform/shared';
import { 
  broadcastDebateEvent, 
  broadcastMarketUpdate,
  broadcastCommentUpdate,
  broadcastRoundUpdate,
  addConnection, 
  removeConnection, 
  type BroadcastPayload 
} from './broadcast';

// ============================================================================
// Arbitraries for generating random event payloads
// ============================================================================

const sideArbitrary = fc.constantFrom('support' as const, 'oppose' as const);
const roundNumberArbitrary = fc.constantFrom(1 as const, 2 as const, 3 as const);
const steelmanRoundArbitrary = fc.constantFrom(2 as const, 3 as const);
const steelmanStatusArbitrary = fc.constantFrom('pending' as const, 'approved' as const, 'rejected' as const);
const reactionTypeArbitrary = fc.constantFrom('agree' as const, 'strong_reasoning' as const);

// Market event payload arbitrary
const marketPayloadArbitrary = fc.record({
  supportPrice: fc.integer({ min: 0, max: 100 }),
  opposePrice: fc.integer({ min: 0, max: 100 }),
  totalVotes: fc.integer({ min: 0, max: 10000 }),
  mindChangeCount: fc.integer({ min: 0, max: 1000 }),
});

// Comment event payload arbitrary
const commentPayloadArbitrary = fc.record({
  action: fc.constant('add' as const),
  comment: fc.record({
    id: fc.uuid(),
    debateId: fc.uuid(),
    userId: fc.uuid(),
    parentId: fc.option(fc.uuid(), { nil: null }),
    content: fc.string({ minLength: 1, maxLength: 500 }),
    createdAt: fc.date(),
  }),
  parentId: fc.option(fc.uuid(), { nil: null }),
});

// Argument event payload arbitrary
const argumentPayloadArbitrary = fc.record({
  argumentId: fc.uuid(),
  roundNumber: roundNumberArbitrary,
  side: sideArbitrary,
  content: fc.string({ minLength: 1, maxLength: 2000 }),
  debaterId: fc.uuid(),
  createdAt: fc.date(),
});

// Reaction event payload arbitrary
const reactionPayloadArbitrary = fc.record({
  argumentId: fc.uuid(),
  reactionType: reactionTypeArbitrary,
  counts: fc.record({
    agree: fc.integer({ min: 0, max: 1000 }),
    strongReasoning: fc.integer({ min: 0, max: 1000 }),
  }),
});

// Round event payload arbitrary
const roundPayloadArbitrary = fc.record({
  debateId: fc.uuid(),
  newRoundNumber: roundNumberArbitrary,
  currentTurn: sideArbitrary,
  previousRoundCompleted: fc.boolean(),
  status: fc.option(fc.constantFrom('active' as const, 'concluded' as const), { nil: undefined }),
});

// Steelman event payload arbitrary
const steelmanPayloadArbitrary = fc.record({
  steelmanId: fc.uuid(),
  debateId: fc.uuid(),
  roundNumber: steelmanRoundArbitrary,
  status: steelmanStatusArbitrary,
  rejectionReason: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  authorId: fc.uuid(),
});

// Debate-join event payload arbitrary
const debateJoinPayloadArbitrary = fc.record({
  debateId: fc.uuid(),
  opposeDebaterId: fc.uuid(),
  opposeDebaterUsername: fc.string({ minLength: 3, maxLength: 30 }),
});

// ============================================================================
// Property Tests
// ============================================================================

describe('Broadcast Property Tests', () => {
  /**
   * Property 2: Event Schema Compliance
   * For any broadcast event of a given type, the serialized payload SHALL conform
   * to the defined schema for that event type, containing all required fields.
   * 
   * Feature: realtime-data-handling, Property 2: Event Schema Compliance
   * Validates: Requirements 1.5, 2.6, 3.2, 4.2, 5.2, 6.4, 10.3, 11.2
   */
  describe('Property 2: Event Schema Compliance', () => {
    it('Market event payloads contain all required fields', () => {
      fc.assert(
        fc.property(marketPayloadArbitrary, (payload) => {
          // Verify payload has all required fields
          const isValid = validateEventPayload('market', payload);
          expect(isValid).toBe(true);
          
          // Verify specific required fields exist
          expect(payload).toHaveProperty('supportPrice');
          expect(payload).toHaveProperty('opposePrice');
          expect(payload).toHaveProperty('totalVotes');
          expect(payload).toHaveProperty('mindChangeCount');
          
          // Verify types
          expect(typeof payload.supportPrice).toBe('number');
          expect(typeof payload.opposePrice).toBe('number');
          expect(typeof payload.totalVotes).toBe('number');
          expect(typeof payload.mindChangeCount).toBe('number');
        }),
        { numRuns: 100 }
      );
    });

    it('Comment event payloads contain all required fields', () => {
      fc.assert(
        fc.property(commentPayloadArbitrary, (payload) => {
          const isValid = validateEventPayload('comment', payload);
          expect(isValid).toBe(true);
          
          expect(payload).toHaveProperty('action');
          expect(payload).toHaveProperty('comment');
          expect(payload).toHaveProperty('parentId');
          
          expect(payload.action).toBe('add');
          expect(typeof payload.comment).toBe('object');
        }),
        { numRuns: 100 }
      );
    });

    it('Argument event payloads contain all required fields', () => {
      fc.assert(
        fc.property(argumentPayloadArbitrary, (payload) => {
          const isValid = validateEventPayload('argument', payload);
          expect(isValid).toBe(true);
          
          expect(payload).toHaveProperty('argumentId');
          expect(payload).toHaveProperty('roundNumber');
          expect(payload).toHaveProperty('side');
          expect(payload).toHaveProperty('content');
          expect(payload).toHaveProperty('debaterId');
          expect(payload).toHaveProperty('createdAt');
          
          expect([1, 2, 3]).toContain(payload.roundNumber);
          expect(['support', 'oppose']).toContain(payload.side);
        }),
        { numRuns: 100 }
      );
    });

    it('Reaction event payloads contain all required fields', () => {
      fc.assert(
        fc.property(reactionPayloadArbitrary, (payload) => {
          const isValid = validateEventPayload('reaction', payload);
          expect(isValid).toBe(true);
          
          expect(payload).toHaveProperty('argumentId');
          expect(payload).toHaveProperty('reactionType');
          expect(payload).toHaveProperty('counts');
          
          expect(['agree', 'strong_reasoning']).toContain(payload.reactionType);
          expect(payload.counts).toHaveProperty('agree');
          expect(payload.counts).toHaveProperty('strongReasoning');
        }),
        { numRuns: 100 }
      );
    });

    it('Round event payloads contain all required fields', () => {
      fc.assert(
        fc.property(roundPayloadArbitrary, (payload) => {
          const isValid = validateEventPayload('round', payload);
          expect(isValid).toBe(true);
          
          expect(payload).toHaveProperty('newRoundNumber');
          expect(payload).toHaveProperty('currentTurn');
          expect(payload).toHaveProperty('previousRoundCompleted');
          
          expect([1, 2, 3]).toContain(payload.newRoundNumber);
          expect(['support', 'oppose']).toContain(payload.currentTurn);
          expect(typeof payload.previousRoundCompleted).toBe('boolean');
        }),
        { numRuns: 100 }
      );
    });

    it('Steelman event payloads contain all required fields', () => {
      fc.assert(
        fc.property(steelmanPayloadArbitrary, (payload) => {
          const isValid = validateEventPayload('steelman', payload);
          expect(isValid).toBe(true);
          
          expect(payload).toHaveProperty('steelmanId');
          expect(payload).toHaveProperty('roundNumber');
          expect(payload).toHaveProperty('status');
          expect(payload).toHaveProperty('authorId');
          
          expect([2, 3]).toContain(payload.roundNumber);
          expect(['pending', 'approved', 'rejected']).toContain(payload.status);
        }),
        { numRuns: 100 }
      );
    });

    it('Debate-join event payloads contain all required fields', () => {
      fc.assert(
        fc.property(debateJoinPayloadArbitrary, (payload) => {
          const isValid = validateEventPayload('debate-join', payload);
          expect(isValid).toBe(true);
          
          expect(payload).toHaveProperty('opposeDebaterId');
          expect(payload).toHaveProperty('opposeDebaterUsername');
          
          expect(typeof payload.opposeDebaterId).toBe('string');
          expect(typeof payload.opposeDebaterUsername).toBe('string');
        }),
        { numRuns: 100 }
      );
    });

    it('Serialized broadcast messages contain event type, data, timestamp, and debateId', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          marketPayloadArbitrary,
          (debateId, payload) => {
            let capturedMessage: string | null = null;
            
            // Add a mock connection to capture the broadcast
            const mockSend = (data: string) => {
              capturedMessage = data;
            };
            
            addConnection(debateId, mockSend);
            
            try {
              broadcastDebateEvent(debateId, 'market', payload);
              
              expect(capturedMessage).not.toBeNull();
              
              const parsed = JSON.parse(capturedMessage!);
              
              // Verify message structure per Requirement 1.5
              expect(parsed).toHaveProperty('event');
              expect(parsed).toHaveProperty('data');
              expect(parsed).toHaveProperty('timestamp');
              expect(parsed).toHaveProperty('debateId');
              
              expect(parsed.event).toBe('market');
              expect(parsed.debateId).toBe(debateId);
              expect(typeof parsed.timestamp).toBe('string');
              
              // Verify data contains all required fields
              expect(parsed.data).toHaveProperty('supportPrice');
              expect(parsed.data).toHaveProperty('opposePrice');
              expect(parsed.data).toHaveProperty('totalVotes');
              expect(parsed.data).toHaveProperty('mindChangeCount');
            } finally {
              removeConnection(debateId, mockSend);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: validateEventPayload correctly rejects invalid payloads
   */
  describe('validateEventPayload rejects invalid payloads', () => {
    it('rejects null payloads', () => {
      const eventTypes: SSEEventType[] = ['market', 'comment', 'argument', 'reaction', 'round', 'steelman', 'debate-join'];
      
      for (const eventType of eventTypes) {
        expect(validateEventPayload(eventType, null)).toBe(false);
      }
    });

    it('rejects empty object payloads', () => {
      const eventTypes: SSEEventType[] = ['market', 'comment', 'argument', 'reaction', 'round', 'steelman', 'debate-join'];
      
      for (const eventType of eventTypes) {
        expect(validateEventPayload(eventType, {})).toBe(false);
      }
    });

    it('rejects payloads missing required fields', () => {
      // Market missing mindChangeCount
      expect(validateEventPayload('market', {
        supportPrice: 50,
        opposePrice: 50,
        totalVotes: 10,
      })).toBe(false);

      // Argument missing side
      expect(validateEventPayload('argument', {
        argumentId: 'test',
        roundNumber: 1,
        content: 'test',
        debaterId: 'test',
        createdAt: new Date().toISOString(),
      })).toBe(false);
    });
  });
});

/**
 * Feature: realtime-data-handling, Property 3: Broadcast Trigger Consistency
 * Validates: Requirements 2.1, 2.2, 3.1, 4.1, 5.1, 6.1, 10.1, 10.2, 11.1
 * 
 * For any mutation that modifies shared state (stance, argument, reaction, comment, 
 * round, steelman, debate-join), the backend SHALL trigger a corresponding broadcast event.
 */
describe('Property 3: Broadcast Trigger Consistency', () => {
  /**
   * Test that broadcast functions correctly send events to connected clients.
   * This verifies the broadcast infrastructure works correctly for all event types.
   */
  
  it('broadcastMarketUpdate triggers market event for connected clients', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.record({
          supportPrice: fc.integer({ min: 0, max: 100 }),
          opposePrice: fc.integer({ min: 0, max: 100 }),
          totalVotes: fc.integer({ min: 0, max: 10000 }),
          mindChangeCount: fc.integer({ min: 0, max: 1000 }),
        }),
        (debateId, marketPrice) => {
          let capturedMessage: string | null = null;
          const mockSend = (data: string) => { capturedMessage = data; };
          
          addConnection(debateId, mockSend);
          
          try {
            broadcastMarketUpdate(debateId, marketPrice);
            
            expect(capturedMessage).not.toBeNull();
            const parsed = JSON.parse(capturedMessage!);
            
            expect(parsed.event).toBe('market');
            expect(parsed.debateId).toBe(debateId);
            expect(parsed.data.supportPrice).toBe(marketPrice.supportPrice);
            expect(parsed.data.opposePrice).toBe(marketPrice.opposePrice);
          } finally {
            removeConnection(debateId, mockSend);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('broadcastCommentUpdate triggers comment event for connected clients', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.record({
          id: fc.uuid(),
          debateId: fc.uuid(),
          userId: fc.uuid(),
          parentId: fc.option(fc.uuid(), { nil: null }),
          content: fc.string({ minLength: 1, maxLength: 500 }),
          createdAt: fc.date(),
        }),
        fc.option(fc.uuid(), { nil: null }),
        (debateId, comment, parentId) => {
          let capturedMessage: string | null = null;
          const mockSend = (data: string) => { capturedMessage = data; };
          
          addConnection(debateId, mockSend);
          
          try {
            broadcastCommentUpdate(debateId, comment, parentId);
            
            expect(capturedMessage).not.toBeNull();
            const parsed = JSON.parse(capturedMessage!);
            
            expect(parsed.event).toBe('comment');
            expect(parsed.debateId).toBe(debateId);
            expect(parsed.data.action).toBe('add');
            expect(parsed.data.comment.id).toBe(comment.id);
            expect(parsed.data.parentId).toBe(parentId);
          } finally {
            removeConnection(debateId, mockSend);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('broadcastRoundUpdate triggers round event for connected clients', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.constantFrom(1 as const, 2 as const, 3 as const),
        fc.constantFrom('support' as const, 'oppose' as const),
        fc.boolean(),
        fc.option(fc.constantFrom('active' as const, 'concluded' as const), { nil: undefined }),
        (debateId, newRoundNumber, currentTurn, previousRoundCompleted, status) => {
          let capturedMessage: string | null = null;
          const mockSend = (data: string) => { capturedMessage = data; };
          
          addConnection(debateId, mockSend);
          
          try {
            broadcastRoundUpdate(debateId, newRoundNumber, currentTurn, previousRoundCompleted, status);
            
            expect(capturedMessage).not.toBeNull();
            const parsed = JSON.parse(capturedMessage!);
            
            expect(parsed.event).toBe('round');
            expect(parsed.debateId).toBe(debateId);
            expect(parsed.data.newRoundNumber).toBe(newRoundNumber);
            expect(parsed.data.currentTurn).toBe(currentTurn);
            expect(parsed.data.previousRoundCompleted).toBe(previousRoundCompleted);
            if (status !== undefined) {
              expect(parsed.data.status).toBe(status);
            }
          } finally {
            removeConnection(debateId, mockSend);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('broadcastDebateEvent with argument type triggers argument event', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.record({
          argumentId: fc.uuid(),
          roundNumber: fc.constantFrom(1 as const, 2 as const, 3 as const),
          side: fc.constantFrom('support' as const, 'oppose' as const),
          content: fc.string({ minLength: 1, maxLength: 2000 }),
          debaterId: fc.uuid(),
          createdAt: fc.date(),
        }),
        (debateId, argumentPayload) => {
          let capturedMessage: string | null = null;
          const mockSend = (data: string) => { capturedMessage = data; };
          
          addConnection(debateId, mockSend);
          
          try {
            broadcastDebateEvent(debateId, 'argument', argumentPayload);
            
            expect(capturedMessage).not.toBeNull();
            const parsed = JSON.parse(capturedMessage!);
            
            expect(parsed.event).toBe('argument');
            expect(parsed.debateId).toBe(debateId);
            expect(parsed.data.argumentId).toBe(argumentPayload.argumentId);
            expect(parsed.data.roundNumber).toBe(argumentPayload.roundNumber);
            expect(parsed.data.side).toBe(argumentPayload.side);
            expect(parsed.data.content).toBe(argumentPayload.content);
            expect(parsed.data.debaterId).toBe(argumentPayload.debaterId);
          } finally {
            removeConnection(debateId, mockSend);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('broadcastDebateEvent with reaction type triggers reaction event', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.record({
          argumentId: fc.uuid(),
          reactionType: fc.constantFrom('agree' as const, 'strong_reasoning' as const),
          counts: fc.record({
            agree: fc.integer({ min: 0, max: 1000 }),
            strongReasoning: fc.integer({ min: 0, max: 1000 }),
          }),
        }),
        (debateId, reactionPayload) => {
          let capturedMessage: string | null = null;
          const mockSend = (data: string) => { capturedMessage = data; };
          
          addConnection(debateId, mockSend);
          
          try {
            broadcastDebateEvent(debateId, 'reaction', reactionPayload);
            
            expect(capturedMessage).not.toBeNull();
            const parsed = JSON.parse(capturedMessage!);
            
            expect(parsed.event).toBe('reaction');
            expect(parsed.debateId).toBe(debateId);
            expect(parsed.data.argumentId).toBe(reactionPayload.argumentId);
            expect(parsed.data.reactionType).toBe(reactionPayload.reactionType);
            expect(parsed.data.counts.agree).toBe(reactionPayload.counts.agree);
            expect(parsed.data.counts.strongReasoning).toBe(reactionPayload.counts.strongReasoning);
          } finally {
            removeConnection(debateId, mockSend);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('broadcastDebateEvent with steelman type triggers steelman event', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.record({
          steelmanId: fc.uuid(),
          debateId: fc.uuid(),
          roundNumber: fc.constantFrom(2 as const, 3 as const),
          status: fc.constantFrom('pending' as const, 'approved' as const, 'rejected' as const),
          rejectionReason: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
          authorId: fc.uuid(),
        }),
        (debateId, steelmanPayload) => {
          let capturedMessage: string | null = null;
          const mockSend = (data: string) => { capturedMessage = data; };
          
          addConnection(debateId, mockSend);
          
          try {
            broadcastDebateEvent(debateId, 'steelman', steelmanPayload);
            
            expect(capturedMessage).not.toBeNull();
            const parsed = JSON.parse(capturedMessage!);
            
            expect(parsed.event).toBe('steelman');
            expect(parsed.debateId).toBe(debateId);
            expect(parsed.data.steelmanId).toBe(steelmanPayload.steelmanId);
            expect(parsed.data.status).toBe(steelmanPayload.status);
            expect(parsed.data.authorId).toBe(steelmanPayload.authorId);
          } finally {
            removeConnection(debateId, mockSend);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('broadcastDebateEvent with debate-join type triggers debate-join event', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.record({
          debateId: fc.uuid(),
          opposeDebaterId: fc.uuid(),
          opposeDebaterUsername: fc.string({ minLength: 3, maxLength: 30 }),
        }),
        (debateId, debateJoinPayload) => {
          let capturedMessage: string | null = null;
          const mockSend = (data: string) => { capturedMessage = data; };
          
          addConnection(debateId, mockSend);
          
          try {
            broadcastDebateEvent(debateId, 'debate-join', debateJoinPayload);
            
            expect(capturedMessage).not.toBeNull();
            const parsed = JSON.parse(capturedMessage!);
            
            expect(parsed.event).toBe('debate-join');
            expect(parsed.debateId).toBe(debateId);
            expect(parsed.data.opposeDebaterId).toBe(debateJoinPayload.opposeDebaterId);
            expect(parsed.data.opposeDebaterUsername).toBe(debateJoinPayload.opposeDebaterUsername);
          } finally {
            removeConnection(debateId, mockSend);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no broadcast is sent when no clients are connected', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.record({
          supportPrice: fc.integer({ min: 0, max: 100 }),
          opposePrice: fc.integer({ min: 0, max: 100 }),
          totalVotes: fc.integer({ min: 0, max: 10000 }),
          mindChangeCount: fc.integer({ min: 0, max: 1000 }),
        }),
        (debateId, marketPrice) => {
          // No connection added - should not throw
          expect(() => {
            broadcastMarketUpdate(debateId, marketPrice);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('broadcast is sent to all connected clients for a debate', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.integer({ min: 2, max: 5 }),
        fc.record({
          supportPrice: fc.integer({ min: 0, max: 100 }),
          opposePrice: fc.integer({ min: 0, max: 100 }),
          totalVotes: fc.integer({ min: 0, max: 10000 }),
          mindChangeCount: fc.integer({ min: 0, max: 1000 }),
        }),
        (debateId, clientCount, marketPrice) => {
          const capturedMessages: string[] = [];
          const mockSends: Array<(data: string) => void> = [];
          
          // Add multiple connections
          for (let i = 0; i < clientCount; i++) {
            const mockSend = (data: string) => { capturedMessages.push(data); };
            mockSends.push(mockSend);
            addConnection(debateId, mockSend);
          }
          
          try {
            broadcastMarketUpdate(debateId, marketPrice);
            
            // All clients should receive the message
            expect(capturedMessages.length).toBe(clientCount);
            
            // All messages should be identical
            const firstMessage = capturedMessages[0];
            for (const msg of capturedMessages) {
              expect(msg).toBe(firstMessage);
            }
          } finally {
            for (const mockSend of mockSends) {
              removeConnection(debateId, mockSend);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
