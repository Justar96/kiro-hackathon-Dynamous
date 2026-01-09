import { describe, it, expect } from 'vitest';
import type { User, Debate, StanceValue } from './types';

describe('Types', () => {
  it('should allow creating a valid User object', () => {
    const user: User = {
      id: 'user-1',
      username: 'testuser',
      email: 'test@example.com',
      reputationScore: 100,
      predictionAccuracy: 50,
      debatesParticipated: 0,
      sandboxCompleted: false,
      createdAt: new Date(),
    };
    expect(user.reputationScore).toBe(100);
    expect(user.sandboxCompleted).toBe(false);
  });

  it('should allow creating a valid Debate object', () => {
    const debate: Debate = {
      id: 'debate-1',
      resolution: 'Test resolution',
      status: 'active',
      currentRound: 1,
      currentTurn: 'support',
      supportDebaterId: 'user-1',
      opposeDebaterId: null,
      createdAt: new Date(),
      concludedAt: null,
    };
    expect(debate.status).toBe('active');
    expect(debate.currentRound).toBe(1);
  });

  it('should allow creating a valid StanceValue', () => {
    const stance: StanceValue = {
      supportValue: 75,
      confidence: 4,
    };
    expect(stance.supportValue).toBe(75);
    expect(stance.confidence).toBe(4);
  });
});
