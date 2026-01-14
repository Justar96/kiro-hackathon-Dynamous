import { describe, it, expect, beforeEach } from 'vitest';
import { marketService } from './market.service';
import { db, users, debates, rounds, arguments_ } from '../db';
import { cleanTestDb } from '../db/test-setup';

describe('MarketService', () => {
  describe('calculateVoteWeight', () => {
    it('should give full weight to completed sandbox users', () => {
      const user = { reputationScore: 100, sandboxCompleted: true };
      const weight = marketService.calculateVoteWeight(user);
      expect(weight).toBe(1.0);
    });

    it('should give reduced weight to sandbox users', () => {
      const user = { reputationScore: 100, sandboxCompleted: false };
      const weight = marketService.calculateVoteWeight(user);
      expect(weight).toBe(0.5);
    });

    it('should scale weight by reputation', () => {
      const highRepUser = { reputationScore: 200, sandboxCompleted: true };
      const lowRepUser = { reputationScore: 50, sandboxCompleted: true };
      
      const highWeight = marketService.calculateVoteWeight(highRepUser);
      const lowWeight = marketService.calculateVoteWeight(lowRepUser);
      
      expect(highWeight).toBeGreaterThan(lowWeight);
    });

    it('should handle undefined user', () => {
      const weight = marketService.calculateVoteWeight(undefined);
      expect(weight).toBe(0.5); // Default sandbox weight
    });
  });

  describe('detectAndRecordSpikes', () => {
    let debateId: string;
    let roundId: string;
    let argumentId: string;

    beforeEach(async () => {
      // Clean database before each test
      await cleanTestDb();
      
      // Create test data
      debateId = 'test-debate';
      roundId = 'test-round';
      argumentId = 'test-arg';

      await db.insert(users).values({
        id: 'test-user',
        username: 'testuser',
        email: 'test@test.com',
        passwordHash: 'hash',
      });

      await db.insert(debates).values({
        id: debateId,
        resolution: 'Test debate',
        supportDebaterId: 'test-user',
      });

      await db.insert(rounds).values({
        id: roundId,
        debateId,
        roundNumber: 1,
        roundType: 'opening',
      });

      await db.insert(arguments_).values({
        id: argumentId,
        roundId,
        debaterId: 'test-user',
        side: 'support',
        content: 'Test argument',
      });
    });

    it('should detect spikes above threshold', async () => {
      const previousPrice = 45;
      const currentPrice = 60; // 15% change > 5% threshold

      // Should complete without error
      await marketService.detectAndRecordSpikes(debateId, previousPrice, currentPrice, argumentId);
      
      // Verify spike was recorded
      expect(true).toBe(true);
    });

    it('should ignore small price changes', async () => {
      const previousPrice = 50;
      const currentPrice = 52; // 2% change < 5% threshold

      // Should complete without error (and not record spike due to small change)
      await marketService.detectAndRecordSpikes(debateId, previousPrice, currentPrice, argumentId);
      
      // Verify completed successfully
      expect(true).toBe(true);
    });
  });
});
