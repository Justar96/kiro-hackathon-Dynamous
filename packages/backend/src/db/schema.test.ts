import { describe, it, expect } from 'vitest';
import { 
  users, debates, rounds, arguments_, stances, reactions, comments, 
  marketDataPoints, stanceSpikes, neonAuthUsers, neonAuthSchema,
  debateStatusEnum, turnEnum, roundTypeEnum, sideEnum, stanceTypeEnum, reactionTypeEnum, directionEnum
} from './schema';

describe('Database Schema', () => {
  it('should have users table defined', () => {
    expect(users).toBeDefined();
  });

  it('should have debates table defined', () => {
    expect(debates).toBeDefined();
  });

  it('should have rounds table defined', () => {
    expect(rounds).toBeDefined();
  });

  it('should have arguments table defined', () => {
    expect(arguments_).toBeDefined();
  });

  it('should have stances table defined', () => {
    expect(stances).toBeDefined();
  });

  it('should have reactions table defined', () => {
    expect(reactions).toBeDefined();
  });

  it('should have comments table defined', () => {
    expect(comments).toBeDefined();
  });

  it('should have marketDataPoints table defined', () => {
    expect(marketDataPoints).toBeDefined();
  });

  it('should have stanceSpikes table defined', () => {
    expect(stanceSpikes).toBeDefined();
  });

  // Enum tests
  it('should have all required enums defined', () => {
    expect(debateStatusEnum).toBeDefined();
    expect(turnEnum).toBeDefined();
    expect(roundTypeEnum).toBeDefined();
    expect(sideEnum).toBeDefined();
    expect(stanceTypeEnum).toBeDefined();
    expect(reactionTypeEnum).toBeDefined();
    expect(directionEnum).toBeDefined();
  });

  // Neon Auth integration
  it('should have neon_auth schema reference defined', () => {
    expect(neonAuthSchema).toBeDefined();
    expect(neonAuthUsers).toBeDefined();
  });
});
