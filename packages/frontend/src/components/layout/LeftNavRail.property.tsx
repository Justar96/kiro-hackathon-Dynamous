/**
 * Property-based tests for LeftNavRail TOC label generation.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateDebateRoundsLabel, createUnifiedTocSections } from './LeftNavRail';

// Arbitrary for valid round numbers
const roundNumberArb = fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>;

describe('LeftNavRail Property Tests - TOC Label Generation', () => {
  describe('generateDebateRoundsLabel', () => {
    it('should return "Rounds" label', () => {
      const label = generateDebateRoundsLabel();
      expect(label).toBe('Rounds');
    });
  });

  describe('createUnifiedTocSections', () => {
    it('Property: TOC contains single "Rounds" entry with badge', () => {
      fc.assert(
        fc.property(roundNumberArb, (currentRound) => {
          const sections = createUnifiedTocSections(currentRound);
          
          // Should have exactly one entry for rounds
          const roundsSections = sections.filter(s => s.id === 'debate-rounds');
          expect(roundsSections).toHaveLength(1);
          
          // Should have badge showing current round progress
          expect(roundsSections[0].badge).toBe(`${currentRound}/3`);
        }),
        { numRuns: 100 }
      );
    });

    it('Property: TOC maintains Resolution, Outcome, and Discussion entries', () => {
      fc.assert(
        fc.property(roundNumberArb, (currentRound) => {
          const sections = createUnifiedTocSections(currentRound);
          
          const resolutionSection = sections.find(s => s.id === 'resolution');
          expect(resolutionSection).toBeDefined();
          expect(resolutionSection?.label).toBe('Resolution');
          
          const outcomeSection = sections.find(s => s.id === 'outcome');
          expect(outcomeSection).toBeDefined();
          expect(outcomeSection?.label).toBe('Outcome');
          
          const discussionSection = sections.find(s => s.id === 'comments');
          expect(discussionSection).toBeDefined();
          expect(discussionSection?.label).toBe('Discussion');
        }),
        { numRuns: 100 }
      );
    });

    it('Property: TOC has exactly 4 sections', () => {
      fc.assert(
        fc.property(roundNumberArb, (currentRound) => {
          const sections = createUnifiedTocSections(currentRound);
          expect(sections).toHaveLength(4);
        }),
        { numRuns: 100 }
      );
    });

    it('Property: Sections are in correct order', () => {
      fc.assert(
        fc.property(roundNumberArb, (currentRound) => {
          const sections = createUnifiedTocSections(currentRound);
          
          expect(sections[0].id).toBe('resolution');
          expect(sections[1].id).toBe('debate-rounds');
          expect(sections[2].id).toBe('outcome');
          expect(sections[3].id).toBe('comments');
        }),
        { numRuns: 100 }
      );
    });
  });
});
