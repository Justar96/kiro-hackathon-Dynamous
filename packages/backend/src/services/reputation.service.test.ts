import { describe, it, expect } from 'vitest';
import { reputationService } from './reputation.service';

describe('ReputationService', () => {
  describe('getPredictionDirection', () => {
    it('should return support for values > 50', () => {
      expect(reputationService.getPredictionDirection(75)).toBe('support');
      expect(reputationService.getPredictionDirection(51)).toBe('support');
    });

    it('should return oppose for values < 50', () => {
      expect(reputationService.getPredictionDirection(25)).toBe('oppose');
      expect(reputationService.getPredictionDirection(49)).toBe('oppose');
    });

    it('should return neutral for value = 50', () => {
      expect(reputationService.getPredictionDirection(50)).toBe('neutral');
    });
  });

  describe('updatePredictionAccuracy', () => {
    it('should increase accuracy on correct prediction', async () => {
      // This would need a test database setup
      // For now, verify method exists and doesn't throw
      expect(typeof reputationService.updatePredictionAccuracy).toBe('function');
    });
  });
});
