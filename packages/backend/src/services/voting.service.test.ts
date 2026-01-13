import { describe, it, expect } from 'vitest';
import { votingService } from './voting.service';

describe('VotingService', () => {
  describe('calculatePersuasionDelta', () => {
    it('should calculate positive delta for mind change toward support', () => {
      const preStance = { supportValue: 30, confidence: 3 };
      const postStance = { supportValue: 70, confidence: 4 };
      
      const delta = votingService.calculatePersuasionDelta(
        preStance,
        postStance,
        'user-123',
        'debate-123',
        'arg-123'
      );

      expect(delta.delta).toBe(40); // 70 - 30
      expect(delta.userId).toBe('user-123');
      expect(delta.debateId).toBe('debate-123');
    });

    it('should calculate negative delta for mind change toward oppose', () => {
      const preStance = { supportValue: 80, confidence: 3 };
      const postStance = { supportValue: 40, confidence: 4 };
      
      const delta = votingService.calculatePersuasionDelta(
        preStance,
        postStance,
        'user-123',
        'debate-123',
        null
      );

      expect(delta.delta).toBe(-40); // 40 - 80
    });

    it('should calculate zero delta for no mind change', () => {
      const preStance = { supportValue: 60, confidence: 3 };
      const postStance = { supportValue: 60, confidence: 3 };
      
      const delta = votingService.calculatePersuasionDelta(
        preStance,
        postStance,
        'user-123',
        'debate-123',
        null
      );

      expect(delta.delta).toBe(0);
    });
  });

  describe('validateStanceInput', () => {
    it('should accept valid stance values', () => {
      const validInput = {
        debateId: 'test',
        voterId: 'test',
        type: 'pre' as const,
        supportValue: 75,
        confidence: 4
      };

      // Should not throw
      expect(() => {
        // Access private method for testing
        (votingService as any).validateStanceInput(validInput);
      }).not.toThrow();
    });

    it('should reject invalid support values', () => {
      const invalidInput = {
        debateId: 'test',
        voterId: 'test',
        type: 'pre' as const,
        supportValue: 150, // Invalid: > 100
        confidence: 3
      };

      expect(() => {
        (votingService as any).validateStanceInput(invalidInput);
      }).toThrow('Stance must be between 0 and 100');
    });

    it('should reject invalid confidence values', () => {
      const invalidInput = {
        debateId: 'test',
        voterId: 'test',
        type: 'pre' as const,
        supportValue: 50,
        confidence: 6 // Invalid: > 5
      };

      expect(() => {
        (votingService as any).validateStanceInput(invalidInput);
      }).toThrow('Confidence must be between 1 and 5');
    });
  });
});
