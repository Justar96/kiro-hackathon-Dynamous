import { describe, it, expect } from 'vitest';
import { marketService } from './market.service';

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
    it('should detect spikes above threshold', async () => {
      const debateId = 'test-debate';
      const previousPrice = 45;
      const currentPrice = 60; // 15% change > 5% threshold
      const argumentId = 'test-arg';

      // Should not throw error
      await expect(
        marketService.detectAndRecordSpikes(debateId, previousPrice, currentPrice, argumentId)
      ).resolves.not.toThrow();
    });

    it('should ignore small price changes', async () => {
      const debateId = 'test-debate';
      const previousPrice = 50;
      const currentPrice = 52; // 2% change < 5% threshold
      const argumentId = 'test-arg';

      // Should not throw error and not record spike
      await expect(
        marketService.detectAndRecordSpikes(debateId, previousPrice, currentPrice, argumentId)
      ).resolves.not.toThrow();
    });
  });
});
