import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: enhanced-comments-matching
 * Property Tests for Matching Service
 * 
 * Properties covered:
 * - Property 6: Queue Membership Invariant
 * - Property 7: Queue FIFO Ordering
 * - Property 8: Self-Exclusion from Matches
 * - Property 9: Reputation-Based Match Prioritization
 * 
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 5.2, 5.3, 5.5
 */

// Arbitrary for generating IDs (nanoid-like)
const idArbitrary = fc.string({ minLength: 10, maxLength: 21 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

// Arbitrary for generating resolution text
const resolutionArbitrary = fc.string({ minLength: 10, maxLength: 200 });

// Arbitrary for generating reputation scores (0-200 range)
const reputationArbitrary = fc.float({ min: 0, max: 200, noNaN: true });

// Arbitrary for generating timestamps
const timestampArbitrary = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') });

/**
 * Simulates a debate in the system
 */
interface SimulatedDebate {
  id: string;
  resolution: string;
  status: 'active' | 'concluded';
  supportDebaterId: string;
  opposeDebaterId: string | null;
  createdAt: Date;
}

/**
 * Simulates a user in the system
 */
interface SimulatedUser {
  id: string;
  username: string;
  reputationScore: number;
}

/**
 * Simulates the matching state
 */
interface MatchingState {
  debates: Map<string, SimulatedDebate>;
  users: Map<string, SimulatedUser>;
}

/**
 * Create initial empty state
 */
function createInitialState(): MatchingState {
  return {
    debates: new Map(),
    users: new Map(),
  };
}

/**
 * Add a user to the state
 */
function addUser(state: MatchingState, user: SimulatedUser): MatchingState {
  const newUsers = new Map(state.users);
  newUsers.set(user.id, user);
  return { ...state, users: newUsers };
}

/**
 * Add a debate to the state
 */
function addDebate(state: MatchingState, debate: SimulatedDebate): MatchingState {
  const newDebates = new Map(state.debates);
  newDebates.set(debate.id, debate);
  return { ...state, debates: newDebates };
}

/**
 * Check if a debate is in the opponent queue
 * Queue membership invariant: active AND no opponent
 */
function isInQueue(debate: SimulatedDebate): boolean {
  return debate.status === 'active' && debate.opposeDebaterId === null;
}

/**
 * Get the opponent queue - debates seeking opponents
 * Returns debates ordered by creation time (oldest first - FIFO)
 */
function getOpponentQueue(state: MatchingState): SimulatedDebate[] {
  const queuedDebates = Array.from(state.debates.values())
    .filter(d => isInQueue(d))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  
  return queuedDebates;
}

/**
 * Find matches for a user
 * - Excludes user's own debates
 * - Prioritizes reputation similarity (within 20 points first)
 * - Returns oldest first within priority groups (FIFO)
 */
function findMatches(
  state: MatchingState, 
  userId: string, 
  limit: number = 10
): { debate: SimulatedDebate; reputationDiff: number }[] {
  const user = state.users.get(userId);
  if (!user) return [];

  const userReputation = user.reputationScore;

  // Get all debates in queue, excluding user's own debates
  const queuedDebates = Array.from(state.debates.values())
    .filter(d => isInQueue(d) && d.supportDebaterId !== userId);

  // Calculate reputation difference
  const withRepDiff = queuedDebates.map(debate => {
    const creator = state.users.get(debate.supportDebaterId);
    const creatorRep = creator?.reputationScore ?? 100;
    return {
      debate,
      reputationDiff: Math.abs(creatorRep - userReputation),
    };
  });

  // Sort by reputation priority (within 20 points first), then by creation time (FIFO)
  const sorted = withRepDiff.sort((a, b) => {
    const aInRange = a.reputationDiff <= 20;
    const bInRange = b.reputationDiff <= 20;
    
    // Priority group: within 20 points comes first
    if (aInRange && !bInRange) return -1;
    if (!aInRange && bInRange) return 1;
    
    // Within same priority group, sort by creation time (oldest first - FIFO)
    return a.debate.createdAt.getTime() - b.debate.createdAt.getTime();
  });

  return sorted.slice(0, limit);
}

/**
 * Simulate opponent joining a debate
 */
function joinDebate(state: MatchingState, debateId: string, opponentId: string): MatchingState {
  const debate = state.debates.get(debateId);
  if (!debate) return state;
  
  const updatedDebate = { ...debate, opposeDebaterId: opponentId };
  const newDebates = new Map(state.debates);
  newDebates.set(debateId, updatedDebate);
  
  return { ...state, debates: newDebates };
}

/**
 * Simulate concluding a debate
 */
function concludeDebate(state: MatchingState, debateId: string): MatchingState {
  const debate = state.debates.get(debateId);
  if (!debate) return state;
  
  const updatedDebate = { ...debate, status: 'concluded' as const };
  const newDebates = new Map(state.debates);
  newDebates.set(debateId, updatedDebate);
  
  return { ...state, debates: newDebates };
}

describe('MatchingService Property Tests', () => {
  /**
   * Property 6: Queue Membership Invariant
   * For any debate, it SHALL be in the opponent queue if and only if:
   * (a) it has no opponent assigned, AND (b) its status is 'active'.
   * 
   * Validates: Requirements 4.1, 4.2, 4.4
   */
  describe('Property 6: Queue Membership Invariant', () => {
    it('debate without opponent and active status should be in queue', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // creatorId
          resolutionArbitrary, // resolution
          timestampArbitrary, // createdAt
          (debateId, creatorId, resolution, createdAt) => {
            let state = createInitialState();
            
            // Add creator user
            state = addUser(state, {
              id: creatorId,
              username: `user_${creatorId}`,
              reputationScore: 100,
            });
            
            // Add active debate without opponent
            const debate: SimulatedDebate = {
              id: debateId,
              resolution,
              status: 'active',
              supportDebaterId: creatorId,
              opposeDebaterId: null,
              createdAt,
            };
            state = addDebate(state, debate);
            
            // Should be in queue
            expect(isInQueue(debate)).toBe(true);
            
            const queue = getOpponentQueue(state);
            expect(queue.some(d => d.id === debateId)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('debate with opponent should NOT be in queue', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // creatorId
          idArbitrary, // opponentId
          resolutionArbitrary, // resolution
          timestampArbitrary, // createdAt
          (debateId, creatorId, opponentId, resolution, createdAt) => {
            // Skip if creator and opponent are the same
            fc.pre(creatorId !== opponentId);
            
            let state = createInitialState();
            
            // Add users
            state = addUser(state, {
              id: creatorId,
              username: `user_${creatorId}`,
              reputationScore: 100,
            });
            state = addUser(state, {
              id: opponentId,
              username: `user_${opponentId}`,
              reputationScore: 100,
            });
            
            // Add debate with opponent
            const debate: SimulatedDebate = {
              id: debateId,
              resolution,
              status: 'active',
              supportDebaterId: creatorId,
              opposeDebaterId: opponentId,
              createdAt,
            };
            state = addDebate(state, debate);
            
            // Should NOT be in queue
            expect(isInQueue(debate)).toBe(false);
            
            const queue = getOpponentQueue(state);
            expect(queue.some(d => d.id === debateId)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('concluded debate should NOT be in queue', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // creatorId
          resolutionArbitrary, // resolution
          timestampArbitrary, // createdAt
          (debateId, creatorId, resolution, createdAt) => {
            let state = createInitialState();
            
            // Add creator user
            state = addUser(state, {
              id: creatorId,
              username: `user_${creatorId}`,
              reputationScore: 100,
            });
            
            // Add concluded debate
            const debate: SimulatedDebate = {
              id: debateId,
              resolution,
              status: 'concluded',
              supportDebaterId: creatorId,
              opposeDebaterId: null,
              createdAt,
            };
            state = addDebate(state, debate);
            
            // Should NOT be in queue
            expect(isInQueue(debate)).toBe(false);
            
            const queue = getOpponentQueue(state);
            expect(queue.some(d => d.id === debateId)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('joining a debate should remove it from queue', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // creatorId
          idArbitrary, // opponentId
          resolutionArbitrary, // resolution
          timestampArbitrary, // createdAt
          (debateId, creatorId, opponentId, resolution, createdAt) => {
            // Skip if creator and opponent are the same
            fc.pre(creatorId !== opponentId);
            
            let state = createInitialState();
            
            // Add users
            state = addUser(state, {
              id: creatorId,
              username: `user_${creatorId}`,
              reputationScore: 100,
            });
            state = addUser(state, {
              id: opponentId,
              username: `user_${opponentId}`,
              reputationScore: 100,
            });
            
            // Add active debate without opponent
            const debate: SimulatedDebate = {
              id: debateId,
              resolution,
              status: 'active',
              supportDebaterId: creatorId,
              opposeDebaterId: null,
              createdAt,
            };
            state = addDebate(state, debate);
            
            // Should be in queue initially
            let queue = getOpponentQueue(state);
            expect(queue.some(d => d.id === debateId)).toBe(true);
            
            // Join the debate
            state = joinDebate(state, debateId, opponentId);
            
            // Should NOT be in queue after joining
            queue = getOpponentQueue(state);
            expect(queue.some(d => d.id === debateId)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('concluding a debate should remove it from queue', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debateId
          idArbitrary, // creatorId
          resolutionArbitrary, // resolution
          timestampArbitrary, // createdAt
          (debateId, creatorId, resolution, createdAt) => {
            let state = createInitialState();
            
            // Add creator user
            state = addUser(state, {
              id: creatorId,
              username: `user_${creatorId}`,
              reputationScore: 100,
            });
            
            // Add active debate without opponent
            const debate: SimulatedDebate = {
              id: debateId,
              resolution,
              status: 'active',
              supportDebaterId: creatorId,
              opposeDebaterId: null,
              createdAt,
            };
            state = addDebate(state, debate);
            
            // Should be in queue initially
            let queue = getOpponentQueue(state);
            expect(queue.some(d => d.id === debateId)).toBe(true);
            
            // Conclude the debate
            state = concludeDebate(state, debateId);
            
            // Should NOT be in queue after concluding
            queue = getOpponentQueue(state);
            expect(queue.some(d => d.id === debateId)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Property 7: Queue FIFO Ordering
   * For any two debates D1 and D2 in the opponent queue where D1 was created before D2,
   * D1 SHALL appear before D2 in the queue listing and in match results.
   * 
   * Validates: Requirements 4.3, 5.5
   */
  describe('Property 7: Queue FIFO Ordering', () => {
    it('queue should be ordered by creation time (oldest first)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: idArbitrary,
              creatorId: idArbitrary,
              resolution: resolutionArbitrary,
              createdAt: timestampArbitrary,
            }),
            { minLength: 2, maxLength: 10 }
          ),
          (debateInputs) => {
            // Skip if any IDs collide
            const debateIds = new Set(debateInputs.map(d => d.id));
            const creatorIds = new Set(debateInputs.map(d => d.creatorId));
            fc.pre(debateIds.size === debateInputs.length);
            
            let state = createInitialState();
            
            // Add all creators
            for (const input of debateInputs) {
              state = addUser(state, {
                id: input.creatorId,
                username: `user_${input.creatorId}`,
                reputationScore: 100,
              });
            }
            
            // Add all debates (active, no opponent)
            for (const input of debateInputs) {
              const debate: SimulatedDebate = {
                id: input.id,
                resolution: input.resolution,
                status: 'active',
                supportDebaterId: input.creatorId,
                opposeDebaterId: null,
                createdAt: input.createdAt,
              };
              state = addDebate(state, debate);
            }
            
            // Get queue
            const queue = getOpponentQueue(state);
            
            // Verify FIFO ordering
            for (let i = 1; i < queue.length; i++) {
              expect(queue[i - 1].createdAt.getTime()).toBeLessThanOrEqual(queue[i].createdAt.getTime());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('earlier debate should appear before later debate in queue', () => {
      fc.assert(
        fc.property(
          idArbitrary, // debate1Id
          idArbitrary, // debate2Id
          idArbitrary, // creator1Id
          idArbitrary, // creator2Id
          resolutionArbitrary, // resolution1
          resolutionArbitrary, // resolution2
          (debate1Id, debate2Id, creator1Id, creator2Id, resolution1, resolution2) => {
            // Skip if IDs collide
            fc.pre(debate1Id !== debate2Id);
            
            let state = createInitialState();
            
            // Add creators
            state = addUser(state, {
              id: creator1Id,
              username: `user_${creator1Id}`,
              reputationScore: 100,
            });
            state = addUser(state, {
              id: creator2Id,
              username: `user_${creator2Id}`,
              reputationScore: 100,
            });
            
            const earlierTime = new Date('2024-01-01T10:00:00Z');
            const laterTime = new Date('2024-01-01T11:00:00Z');
            
            // Add debate1 (earlier)
            state = addDebate(state, {
              id: debate1Id,
              resolution: resolution1,
              status: 'active',
              supportDebaterId: creator1Id,
              opposeDebaterId: null,
              createdAt: earlierTime,
            });
            
            // Add debate2 (later)
            state = addDebate(state, {
              id: debate2Id,
              resolution: resolution2,
              status: 'active',
              supportDebaterId: creator2Id,
              opposeDebaterId: null,
              createdAt: laterTime,
            });
            
            const queue = getOpponentQueue(state);
            const debate1Index = queue.findIndex(d => d.id === debate1Id);
            const debate2Index = queue.findIndex(d => d.id === debate2Id);
            
            // Earlier debate should appear first
            expect(debate1Index).toBeLessThan(debate2Index);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 8: Self-Exclusion from Matches
   * For any user U requesting auto-matching, no debate created by U SHALL appear in the match results.
   * 
   * Validates: Requirements 5.3
   */
  describe('Property 8: Self-Exclusion from Matches', () => {
    it('user should not see their own debates in match results', () => {
      fc.assert(
        fc.property(
          idArbitrary, // userId
          idArbitrary, // otherUserId
          fc.array(idArbitrary, { minLength: 1, maxLength: 5 }), // user's debate IDs
          fc.array(idArbitrary, { minLength: 1, maxLength: 5 }), // other user's debate IDs
          fc.array(resolutionArbitrary, { minLength: 5, maxLength: 5 }), // resolutions
          (userId, otherUserId, userDebateIds, otherDebateIds, resolutions) => {
            // Skip if users are the same or IDs collide
            fc.pre(userId !== otherUserId);
            const allDebateIds = [...userDebateIds, ...otherDebateIds];
            fc.pre(new Set(allDebateIds).size === allDebateIds.length);
            
            let state = createInitialState();
            
            // Add users
            state = addUser(state, {
              id: userId,
              username: `user_${userId}`,
              reputationScore: 100,
            });
            state = addUser(state, {
              id: otherUserId,
              username: `user_${otherUserId}`,
              reputationScore: 100,
            });
            
            const baseTime = new Date('2024-01-01T10:00:00Z');
            
            // Add user's debates
            for (let i = 0; i < userDebateIds.length; i++) {
              state = addDebate(state, {
                id: userDebateIds[i],
                resolution: resolutions[i] || 'Test resolution',
                status: 'active',
                supportDebaterId: userId,
                opposeDebaterId: null,
                createdAt: new Date(baseTime.getTime() + i * 1000),
              });
            }
            
            // Add other user's debates
            for (let i = 0; i < otherDebateIds.length; i++) {
              state = addDebate(state, {
                id: otherDebateIds[i],
                resolution: resolutions[userDebateIds.length + i] || 'Test resolution',
                status: 'active',
                supportDebaterId: otherUserId,
                opposeDebaterId: null,
                createdAt: new Date(baseTime.getTime() + (userDebateIds.length + i) * 1000),
              });
            }
            
            // Find matches for user
            const matches = findMatches(state, userId);
            
            // User's own debates should NOT appear in matches
            for (const match of matches) {
              expect(match.debate.supportDebaterId).not.toBe(userId);
            }
            
            // All matches should be from other users
            for (const match of matches) {
              expect(userDebateIds).not.toContain(match.debate.id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('user with only their own debates should get empty matches', () => {
      fc.assert(
        fc.property(
          idArbitrary, // userId
          fc.array(idArbitrary, { minLength: 1, maxLength: 5 }), // debate IDs
          fc.array(resolutionArbitrary, { minLength: 5, maxLength: 5 }), // resolutions
          (userId, debateIds, resolutions) => {
            // Skip if IDs collide
            fc.pre(new Set(debateIds).size === debateIds.length);
            
            let state = createInitialState();
            
            // Add user
            state = addUser(state, {
              id: userId,
              username: `user_${userId}`,
              reputationScore: 100,
            });
            
            const baseTime = new Date('2024-01-01T10:00:00Z');
            
            // Add only user's debates
            for (let i = 0; i < debateIds.length; i++) {
              state = addDebate(state, {
                id: debateIds[i],
                resolution: resolutions[i] || 'Test resolution',
                status: 'active',
                supportDebaterId: userId,
                opposeDebaterId: null,
                createdAt: new Date(baseTime.getTime() + i * 1000),
              });
            }
            
            // Find matches for user
            const matches = findMatches(state, userId);
            
            // Should be empty since all debates are user's own
            expect(matches.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 9: Reputation-Based Match Prioritization
   * For any user U with reputation R requesting matches, debates whose creators have
   * reputation within [R-20, R+20] SHALL appear before debates outside that range.
   * 
   * Validates: Requirements 5.2
   */
  describe('Property 9: Reputation-Based Match Prioritization', () => {
    it('debates within 20 reputation points should appear before those outside', () => {
      fc.assert(
        fc.property(
          idArbitrary, // userId
          reputationArbitrary, // userReputation
          fc.array(
            fc.record({
              id: idArbitrary,
              creatorId: idArbitrary,
              creatorReputation: reputationArbitrary,
              resolution: resolutionArbitrary,
            }),
            { minLength: 2, maxLength: 10 }
          ),
          (userId, userReputation, debateInputs) => {
            // Skip if any IDs collide with userId
            fc.pre(!debateInputs.some(d => d.creatorId === userId));
            
            // Skip if debate IDs collide
            const debateIds = new Set(debateInputs.map(d => d.id));
            fc.pre(debateIds.size === debateInputs.length);
            
            let state = createInitialState();
            
            // Add requesting user
            state = addUser(state, {
              id: userId,
              username: `user_${userId}`,
              reputationScore: userReputation,
            });
            
            const baseTime = new Date('2024-01-01T10:00:00Z');
            
            // Add all creators and debates
            for (let i = 0; i < debateInputs.length; i++) {
              const input = debateInputs[i];
              
              state = addUser(state, {
                id: input.creatorId,
                username: `user_${input.creatorId}`,
                reputationScore: input.creatorReputation,
              });
              
              state = addDebate(state, {
                id: input.id,
                resolution: input.resolution,
                status: 'active',
                supportDebaterId: input.creatorId,
                opposeDebaterId: null,
                createdAt: new Date(baseTime.getTime() + i * 1000),
              });
            }
            
            // Find matches
            const matches = findMatches(state, userId);
            
            // Verify prioritization: all "in range" debates should come before "out of range"
            let seenOutOfRange = false;
            for (const match of matches) {
              const inRange = match.reputationDiff <= 20;
              
              if (!inRange) {
                seenOutOfRange = true;
              }
              
              // Once we've seen an out-of-range debate, all subsequent should also be out-of-range
              if (seenOutOfRange && inRange) {
                // This would be a violation - in-range debate after out-of-range
                expect(inRange).toBe(false);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('within same priority group, FIFO ordering should be maintained', () => {
      fc.assert(
        fc.property(
          idArbitrary, // userId
          idArbitrary, // creator1Id
          idArbitrary, // creator2Id
          idArbitrary, // debate1Id
          idArbitrary, // debate2Id
          resolutionArbitrary, // resolution1
          resolutionArbitrary, // resolution2
          (userId, creator1Id, creator2Id, debate1Id, debate2Id, resolution1, resolution2) => {
            // Skip if IDs collide
            fc.pre(userId !== creator1Id && userId !== creator2Id);
            fc.pre(creator1Id !== creator2Id);
            fc.pre(debate1Id !== debate2Id);
            
            let state = createInitialState();
            
            // Add requesting user with reputation 100
            state = addUser(state, {
              id: userId,
              username: `user_${userId}`,
              reputationScore: 100,
            });
            
            // Add two creators with same reputation (both within 20 points of user)
            state = addUser(state, {
              id: creator1Id,
              username: `user_${creator1Id}`,
              reputationScore: 105, // Within 20 points
            });
            state = addUser(state, {
              id: creator2Id,
              username: `user_${creator2Id}`,
              reputationScore: 110, // Within 20 points
            });
            
            const earlierTime = new Date('2024-01-01T10:00:00Z');
            const laterTime = new Date('2024-01-01T11:00:00Z');
            
            // Add debate1 (earlier)
            state = addDebate(state, {
              id: debate1Id,
              resolution: resolution1,
              status: 'active',
              supportDebaterId: creator1Id,
              opposeDebaterId: null,
              createdAt: earlierTime,
            });
            
            // Add debate2 (later)
            state = addDebate(state, {
              id: debate2Id,
              resolution: resolution2,
              status: 'active',
              supportDebaterId: creator2Id,
              opposeDebaterId: null,
              createdAt: laterTime,
            });
            
            const matches = findMatches(state, userId);
            
            // Both should be in same priority group (within 20 points)
            // Earlier debate should appear first (FIFO)
            const debate1Index = matches.findIndex(m => m.debate.id === debate1Id);
            const debate2Index = matches.findIndex(m => m.debate.id === debate2Id);
            
            expect(debate1Index).toBeLessThan(debate2Index);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('reputation difference should be calculated correctly', () => {
      fc.assert(
        fc.property(
          idArbitrary, // userId
          idArbitrary, // creatorId
          idArbitrary, // debateId
          reputationArbitrary, // userReputation
          reputationArbitrary, // creatorReputation
          resolutionArbitrary, // resolution
          (userId, creatorId, debateId, userReputation, creatorReputation, resolution) => {
            // Skip if IDs collide
            fc.pre(userId !== creatorId);
            
            let state = createInitialState();
            
            // Add users
            state = addUser(state, {
              id: userId,
              username: `user_${userId}`,
              reputationScore: userReputation,
            });
            state = addUser(state, {
              id: creatorId,
              username: `user_${creatorId}`,
              reputationScore: creatorReputation,
            });
            
            // Add debate
            state = addDebate(state, {
              id: debateId,
              resolution,
              status: 'active',
              supportDebaterId: creatorId,
              opposeDebaterId: null,
              createdAt: new Date(),
            });
            
            const matches = findMatches(state, userId);
            
            // Should have exactly one match
            expect(matches.length).toBe(1);
            
            // Reputation diff should be absolute difference
            const expectedDiff = Math.abs(creatorReputation - userReputation);
            expect(matches[0].reputationDiff).toBeCloseTo(expectedDiff, 5);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
