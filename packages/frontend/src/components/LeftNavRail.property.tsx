/**
 * Property-based tests for LeftNavRail TOC label generation.
 * 
 * Feature: unified-round-section, Property 9: TOC Label Generation
 * Validates: Requirements 8.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateDebateRoundsLabel, createUnifiedTocSections } from './LeftNavRail';

// Arbitrary for valid round numbers
const roundNumberArb = fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>;

describe('LeftNavRail Property Tests - TOC Label Generation', () => {
  /**
   * Property 9: TOC Label Generation
   * For any debate state, the TOC "Debate Rounds" entry SHALL:
   * - Include the current round indicator in format "(X/3)"
   * - Maintain a single entry for all rounds (not three separate entries)
   * 
   * Validates: Requirements 8.3
   */
  describe('generateDebateRoundsLabel', () => {
    it('Property 9.1: Label includes round indicator in format "(X/3)"', () => {
      fc.assert(
        fc.property(roundNumberArb, (currentRound) => {
          const label = generateDebateRoundsLabel(currentRound);
          
          // Should contain the round indicator in the correct format
          expect(label).toContain(`(${currentRound}/3)`);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 9.2: Label starts with "Debate Rounds"', () => {
      fc.assert(
        fc.property(roundNumberArb, (currentRound) => {
          const label = generateDebateRoundsLabel(currentRound);
          
          // Should start with "Debate Rounds"
          expect(label.startsWith('Debate Rounds')).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 9.3: Label format is exactly "Debate Rounds (X/3)"', () => {
      fc.assert(
        fc.property(roundNumberArb, (currentRound) => {
          const label = generateDebateRoundsLabel(currentRound);
          
          // Should match exact format
          expect(label).toBe(`Debate Rounds (${currentRound}/3)`);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('createUnifiedTocSections', () => {
    it('Property 9.4: TOC contains single "Debate Rounds" entry (not three separate round entries)', () => {
      fc.assert(
        fc.property(roundNumberArb, (currentRound) => {
          const sections = createUnifiedTocSections(currentRound);
          
          // Should have exactly one entry containing "Debate Rounds"
          const debateRoundsSections = sections.filter(s => s.label.includes('Debate Rounds'));
          expect(debateRoundsSections).toHaveLength(1);
          
          // Should NOT have separate round entries
          const roundEntries = sections.filter(s => 
            s.label.includes('Round 1') || 
            s.label.includes('Round 2') || 
            s.label.includes('Round 3') ||
            s.label.includes('Openings') ||
            s.label.includes('Rebuttals') ||
            s.label.includes('Closings')
          );
          expect(roundEntries).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 9.5: TOC maintains Resolution, Outcome, and Discussion entries', () => {
      fc.assert(
        fc.property(roundNumberArb, (currentRound) => {
          const sections = createUnifiedTocSections(currentRound);
          
          // Should have Resolution entry
          const resolutionSection = sections.find(s => s.id === 'resolution');
          expect(resolutionSection).toBeDefined();
          expect(resolutionSection?.label).toBe('Resolution');
          
          // Should have Outcome entry
          const outcomeSection = sections.find(s => s.id === 'outcome');
          expect(outcomeSection).toBeDefined();
          expect(outcomeSection?.label).toBe('Outcome');
          
          // Should have Discussion entry
          const discussionSection = sections.find(s => s.id === 'comments');
          expect(discussionSection).toBeDefined();
          expect(discussionSection?.label).toBe('Discussion');
        }),
        { numRuns: 100 }
      );
    });

    it('Property 9.6: TOC has exactly 4 sections', () => {
      fc.assert(
        fc.property(roundNumberArb, (currentRound) => {
          const sections = createUnifiedTocSections(currentRound);
          
          // Should have exactly 4 sections: Resolution, Debate Rounds, Outcome, Discussion
          expect(sections).toHaveLength(4);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 9.7: Debate Rounds entry has correct id for scrolling', () => {
      fc.assert(
        fc.property(roundNumberArb, (currentRound) => {
          const sections = createUnifiedTocSections(currentRound);
          
          const debateRoundsSection = sections.find(s => s.label.includes('Debate Rounds'));
          expect(debateRoundsSection?.id).toBe('debate-rounds');
        }),
        { numRuns: 100 }
      );
    });

    it('Property 9.8: Debate Rounds label includes current round indicator', () => {
      fc.assert(
        fc.property(roundNumberArb, (currentRound) => {
          const sections = createUnifiedTocSections(currentRound);
          
          const debateRoundsSection = sections.find(s => s.id === 'debate-rounds');
          expect(debateRoundsSection?.label).toContain(`(${currentRound}/3)`);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 9.9: Sections are in correct order', () => {
      fc.assert(
        fc.property(roundNumberArb, (currentRound) => {
          const sections = createUnifiedTocSections(currentRound);
          
          // Verify order: Resolution, Debate Rounds, Outcome, Discussion
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
