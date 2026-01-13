/**
 * Property-based tests for RoundSection utilities and components.
 * 
 * Feature: unified-round-section, Property 2: Round State Derivation Correctness
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { render, fireEvent } from '@testing-library/react';
import {
  deriveRoundStates,
  canNavigateToRound,
  generateExcerpt,
  getRoundLabel,
  getProgressText,
} from './RoundSection.utils';
import { RoundHistory } from './RoundHistory';
import { ActiveRoundView } from './ActiveRoundView';
import { ArgumentSubmissionForm } from './ArgumentSubmissionForm';
import { RoundSection } from './RoundSection';
import type { Debate, Round, Argument, User } from '@debate-platform/shared';
import { ARGUMENT_CHAR_LIMITS } from '@debate-platform/shared';

// Arbitraries for generating test data
const roundNumberArb = fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>;
const debateStatusArb = fc.constantFrom('active', 'concluded') as fc.Arbitrary<'active' | 'concluded'>;
const sideArb = fc.constantFrom('support', 'oppose') as fc.Arbitrary<'support' | 'oppose'>;
const roundTypeArb = fc.constantFrom('opening', 'rebuttal', 'closing') as fc.Arbitrary<'opening' | 'rebuttal' | 'closing'>;

// Generate a valid round
const roundArb = (roundNumber: 1 | 2 | 3): fc.Arbitrary<Round> => {
  const roundTypes: Record<1 | 2 | 3, 'opening' | 'rebuttal' | 'closing'> = {
    1: 'opening',
    2: 'rebuttal',
    3: 'closing',
  };
  
  return fc.record({
    id: fc.uuid(),
    debateId: fc.uuid(),
    roundNumber: fc.constant(roundNumber),
    roundType: fc.constant(roundTypes[roundNumber]),
    supportArgumentId: fc.option(fc.uuid(), { nil: null }),
    opposeArgumentId: fc.option(fc.uuid(), { nil: null }),
    completedAt: fc.option(fc.date(), { nil: null }),
  });
};

// Generate a consistent set of 3 rounds
const roundsArb: fc.Arbitrary<Round[]> = fc.tuple(
  roundArb(1),
  roundArb(2),
  roundArb(3)
).map(([r1, r2, r3]) => [r1, r2, r3]);

// Generate a debate with consistent state
const debateArb: fc.Arbitrary<Debate> = fc.record({
  id: fc.uuid(),
  resolution: fc.string({ minLength: 1, maxLength: 200 }),
  status: debateStatusArb,
  currentRound: roundNumberArb,
  currentTurn: sideArb,
  supportDebaterId: fc.uuid(),
  opposeDebaterId: fc.option(fc.uuid(), { nil: null }),
  createdAt: fc.date(),
  concludedAt: fc.option(fc.date(), { nil: null }),
});

describe('RoundSection Property Tests - Round State Derivation', () => {
  /**
   * Property 2: Round State Derivation Correctness
   * For any combination of debate state, rounds data, and viewedRound,
   * the deriveRoundStates function SHALL produce correct states.
   * 
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
   */
  describe('deriveRoundStates', () => {
    it('Property 2.1: Completed rounds (completedAt !== null) should have state "completed" or "viewing-history"', () => {
      fc.assert(
        fc.property(debateArb, roundsArb, roundNumberArb, (debate, rounds, viewedRound) => {
          const states = deriveRoundStates(debate, rounds, viewedRound);
          
          for (let i = 0; i < rounds.length; i++) {
            const round = rounds[i];
            const state = states[i];
            
            if (round.completedAt !== null) {
              // Completed rounds should be either 'completed' or 'viewing-history'
              expect(['completed', 'viewing-history']).toContain(state.state);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('Property 2.2: Active round (currentRound === roundNumber && status === "active") should have state "active"', () => {
      fc.assert(
        fc.property(debateArb, roundsArb, roundNumberArb, (debate, rounds, viewedRound) => {
          // Force debate to be active for this test
          const activeDebate = { ...debate, status: 'active' as const };
          const states = deriveRoundStates(activeDebate, rounds, viewedRound);
          
          for (let i = 0; i < rounds.length; i++) {
            const roundNumber = (i + 1) as 1 | 2 | 3;
            const round = rounds[i];
            const state = states[i];
            
            // If this is the active round and it's not completed
            if (roundNumber === activeDebate.currentRound && round.completedAt === null) {
              expect(state.state).toBe('active');
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('Property 2.3: Viewing non-active completed round should have state "viewing-history"', () => {
      fc.assert(
        fc.property(debateArb, roundsArb, (debate, rounds) => {
          // Find a completed round that isn't the current round
          const completedRoundIndex = rounds.findIndex(
            (r, i) => r.completedAt !== null && (i + 1) !== debate.currentRound
          );
          
          if (completedRoundIndex === -1) return; // Skip if no such round exists
          
          const viewedRound = (completedRoundIndex + 1) as 1 | 2 | 3;
          const states = deriveRoundStates(debate, rounds, viewedRound);
          
          // The viewed completed round should be 'viewing-history'
          expect(states[completedRoundIndex].state).toBe('viewing-history');
        }),
        { numRuns: 100 }
      );
    });

    it('Property 2.4: Future rounds with no content should have state "pending"', () => {
      fc.assert(
        fc.property(debateArb, roundsArb, roundNumberArb, (debate, rounds, viewedRound) => {
          const states = deriveRoundStates(debate, rounds, viewedRound);
          
          for (let i = 0; i < rounds.length; i++) {
            const roundNumber = (i + 1) as 1 | 2 | 3;
            const round = rounds[i];
            const state = states[i];
            
            // Future round: not completed, not active
            const isNotCompleted = round.completedAt === null;
            const isNotActive = !(roundNumber === debate.currentRound && debate.status === 'active');
            
            if (isNotCompleted && isNotActive) {
              expect(state.state).toBe('pending');
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('Property 2.5: deriveRoundStates always returns exactly 3 round steps', () => {
      fc.assert(
        fc.property(debateArb, roundsArb, roundNumberArb, (debate, rounds, viewedRound) => {
          const states = deriveRoundStates(debate, rounds, viewedRound);
          expect(states).toHaveLength(3);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 2.6: Round labels are correctly assigned', () => {
      fc.assert(
        fc.property(debateArb, roundsArb, roundNumberArb, (debate, rounds, viewedRound) => {
          const states = deriveRoundStates(debate, rounds, viewedRound);
          
          expect(states[0].label).toBe('Opening');
          expect(states[1].label).toBe('Rebuttal');
          expect(states[2].label).toBe('Closing');
        }),
        { numRuns: 100 }
      );
    });

    it('Property 2.7: hasArguments is true iff supportArgumentId or opposeArgumentId is not null', () => {
      fc.assert(
        fc.property(debateArb, roundsArb, roundNumberArb, (debate, rounds, viewedRound) => {
          const states = deriveRoundStates(debate, rounds, viewedRound);
          
          for (let i = 0; i < rounds.length; i++) {
            const round = rounds[i];
            const state = states[i];
            
            const expectedHasArguments = round.supportArgumentId !== null || round.opposeArgumentId !== null;
            expect(state.hasArguments).toBe(expectedHasArguments);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: Navigation State Transitions (partial - canNavigateToRound)
   * Validates: Requirements 3.5
   */
  describe('canNavigateToRound', () => {
    it('Property 3.1: Can always navigate to completed rounds', () => {
      fc.assert(
        fc.property(roundsArb, roundNumberArb, (rounds, currentRound) => {
          for (let i = 0; i < rounds.length; i++) {
            const targetRound = (i + 1) as 1 | 2 | 3;
            const round = rounds[i];
            
            if (round.completedAt !== null) {
              expect(canNavigateToRound(targetRound, rounds, currentRound)).toBe(true);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('Property 3.2: Can always navigate to the active round', () => {
      fc.assert(
        fc.property(roundsArb, roundNumberArb, (rounds, currentRound) => {
          expect(canNavigateToRound(currentRound, rounds, currentRound)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 3.3: Cannot navigate to future rounds with no arguments', () => {
      fc.assert(
        fc.property(roundsArb, roundNumberArb, (rounds, currentRound) => {
          for (let i = 0; i < rounds.length; i++) {
            const targetRound = (i + 1) as 1 | 2 | 3;
            const round = rounds[i];
            
            // Future round with no arguments
            const isFuture = targetRound > currentRound;
            const hasNoArguments = round.supportArgumentId === null && round.opposeArgumentId === null;
            const isNotCompleted = round.completedAt === null;
            
            if (isFuture && hasNoArguments && isNotCompleted) {
              expect(canNavigateToRound(targetRound, rounds, currentRound)).toBe(false);
            }
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: History Visibility Rules (partial - generateExcerpt)
   * Validates: Requirements 4.3
   */
  describe('generateExcerpt', () => {
    it('Property 4.1: Excerpt length is always <= maxLength + 3 (for "...")', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 500 }),
          fc.integer({ min: 10, max: 200 }),
          (content, maxLength) => {
            const excerpt = generateExcerpt(content, maxLength);
            // If truncated, adds "..." (3 chars), so max is maxLength + 3
            // But actually the implementation trims and adds "...", so it should be <= maxLength + 3
            expect(excerpt.length).toBeLessThanOrEqual(maxLength + 3);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 4.2: Short content is returned unchanged', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 50 }),
          (content) => {
            const excerpt = generateExcerpt(content, 100);
            expect(excerpt).toBe(content);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 4.3: Long content ends with "..."', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 101, maxLength: 500 }),
          (content) => {
            const excerpt = generateExcerpt(content, 100);
            expect(excerpt.endsWith('...')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 4.4: Empty content returns empty string', () => {
      expect(generateExcerpt('')).toBe('');
      expect(generateExcerpt('', 50)).toBe('');
    });
  });

  /**
   * getRoundLabel tests
   */
  describe('getRoundLabel', () => {
    it('Property: getRoundLabel returns correct labels for all round types', () => {
      fc.assert(
        fc.property(roundTypeArb, (roundType) => {
          const label = getRoundLabel(roundType);
          
          const expectedLabels: Record<typeof roundType, string> = {
            opening: 'Opening',
            rebuttal: 'Rebuttal',
            closing: 'Closing',
          };
          
          expect(label).toBe(expectedLabels[roundType]);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * getProgressText tests
   * Validates: Requirements 2.1, 2.2
   */
  describe('getProgressText', () => {
    it('Property: Progress text includes "Round X of 3"', () => {
      fc.assert(
        fc.property(roundNumberArb, sideArb, debateStatusArb, fc.boolean(), (currentRound, currentTurn, status, isViewingHistory) => {
          const text = getProgressText(currentRound, currentTurn, status, isViewingHistory);
          expect(text).toContain(`Round ${currentRound} of 3`);
        }),
        { numRuns: 100 }
      );
    });

    it('Property: Concluded debates show "Concluded"', () => {
      fc.assert(
        fc.property(roundNumberArb, sideArb, fc.boolean(), (currentRound, currentTurn, isViewingHistory) => {
          const text = getProgressText(currentRound, currentTurn, 'concluded', isViewingHistory);
          expect(text).toContain('Concluded');
        }),
        { numRuns: 100 }
      );
    });

    it('Property: Viewing history shows "Viewing history"', () => {
      fc.assert(
        fc.property(roundNumberArb, sideArb, (currentRound, currentTurn) => {
          const text = getProgressText(currentRound, currentTurn, 'active', true);
          expect(text).toContain('Viewing history');
        }),
        { numRuns: 100 }
      );
    });

    it('Property: Active debates show turn indicator', () => {
      fc.assert(
        fc.property(roundNumberArb, sideArb, (currentRound, currentTurn) => {
          const text = getProgressText(currentRound, currentTurn, 'active', false);
          const expectedTurn = currentTurn === 'support' ? "Support's turn" : "Oppose's turn";
          expect(text).toContain(expectedTurn);
        }),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * Property-based tests for RoundHistory component.
 * 
 * Feature: unified-round-section, Property 4: History Visibility Rules
 * Validates: Requirements 4.1, 4.3, 4.5
 */
describe('RoundHistory Property Tests - History Visibility Rules', () => {
  // Generate user for debater info
  const userArb = fc.record({
    id: fc.uuid(),
    authUserId: fc.option(fc.uuid(), { nil: null }),
    username: fc.string({ minLength: 1, maxLength: 50 }),
    email: fc.emailAddress(),
    reputationScore: fc.integer({ min: 0, max: 1000 }),
    predictionAccuracy: fc.float({ min: 0, max: 1 }),
    debatesParticipated: fc.integer({ min: 0, max: 100 }),
    sandboxCompleted: fc.boolean(),
    createdAt: fc.date(),
  });

  // Generate completed rounds (with completedAt set)
  const completedRoundArb = (roundNumber: 1 | 2 | 3): fc.Arbitrary<Round> => {
    const roundTypes: Record<1 | 2 | 3, 'opening' | 'rebuttal' | 'closing'> = {
      1: 'opening',
      2: 'rebuttal',
      3: 'closing',
    };
    
    return fc.record({
      id: fc.uuid(),
      debateId: fc.uuid(),
      roundNumber: fc.constant(roundNumber),
      roundType: fc.constant(roundTypes[roundNumber]),
      supportArgumentId: fc.uuid(), // Completed rounds have arguments
      opposeArgumentId: fc.uuid(),
      completedAt: fc.date(), // Always has completedAt
    });
  };

  // Generate a set of completed rounds (1-3 rounds)
  const completedRoundsArb = fc.integer({ min: 1, max: 3 }).chain(count => {
    const roundArbs: fc.Arbitrary<Round>[] = [];
    for (let i = 1; i <= count; i++) {
      roundArbs.push(completedRoundArb(i as 1 | 2 | 3));
    }
    return fc.tuple(...roundArbs as [fc.Arbitrary<Round>, ...fc.Arbitrary<Round>[]]);
  });

  /**
   * Property 4: History Visibility Rules
   * For any debate state and viewedRound combination:
   * - Round history is visible when there are completed rounds
   * - Round history is NOT visible when no history exists
   * - Each history summary contains required information
   * 
   * Validates: Requirements 4.1, 4.3, 4.5
   */
  describe('RoundHistory visibility and content', () => {
    it('Property 4.1: RoundHistory is NOT rendered when completedRounds is empty (Requirement 4.5)', () => {
      fc.assert(
        fc.property(fc.boolean(), (expanded) => {
          const onToggle = () => {};
          const onRoundClick = () => {};
          
          const { container } = render(
            <RoundHistory
              completedRounds={[]}
              expanded={expanded}
              onToggle={onToggle}
              onRoundClick={onRoundClick}
            />
          );
          
          // Should render nothing when no completed rounds
          expect(container.firstChild).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4.2: RoundHistory IS rendered when completedRounds has items (Requirement 4.1)', () => {
      fc.assert(
        fc.property(completedRoundsArb, fc.boolean(), (completedRounds, expanded) => {
          const onToggle = () => {};
          const onRoundClick = () => {};
          
          const { container } = render(
            <RoundHistory
              completedRounds={completedRounds}
              expanded={expanded}
              onToggle={onToggle}
              onRoundClick={onRoundClick}
            />
          );
          
          // Should render something when there are completed rounds
          expect(container.firstChild).not.toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4.3: RoundHistory shows correct count of completed rounds', () => {
      fc.assert(
        fc.property(completedRoundsArb, fc.boolean(), (completedRounds, expanded) => {
          const onToggle = () => {};
          const onRoundClick = () => {};
          
          const { container } = render(
            <RoundHistory
              completedRounds={completedRounds}
              expanded={expanded}
              onToggle={onToggle}
              onRoundClick={onRoundClick}
            />
          );
          
          // Should show "Previous Rounds (X)" where X is the count
          expect(container.textContent).toContain(`Previous Rounds (${completedRounds.length})`);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4.4: Expanded RoundHistory shows all completed round summaries', () => {
      fc.assert(
        fc.property(completedRoundsArb, (completedRounds) => {
          const onToggle = () => {};
          const onRoundClick = () => {};
          
          const { container } = render(
            <RoundHistory
              completedRounds={completedRounds}
              expanded={true}
              onToggle={onToggle}
              onRoundClick={onRoundClick}
            />
          );
          
          // Each completed round should have its label shown
          for (const round of completedRounds) {
            const label = getRoundLabel(round.roundType);
            expect(container.textContent).toContain(label);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4.5: Collapsed RoundHistory does NOT show round summaries', () => {
      fc.assert(
        fc.property(completedRoundsArb, (completedRounds) => {
          const onToggle = () => {};
          const onRoundClick = () => {};
          
          const { container } = render(
            <RoundHistory
              completedRounds={completedRounds}
              expanded={false}
              onToggle={onToggle}
              onRoundClick={onRoundClick}
            />
          );
          
          // Should not have the expanded content section
          const expandedContent = container.querySelector('#round-history-content');
          expect(expandedContent).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4.6: Toggle button has correct aria-expanded attribute', () => {
      fc.assert(
        fc.property(completedRoundsArb, fc.boolean(), (completedRounds, expanded) => {
          const onToggle = () => {};
          const onRoundClick = () => {};
          
          const { container } = render(
            <RoundHistory
              completedRounds={completedRounds}
              expanded={expanded}
              onToggle={onToggle}
              onRoundClick={onRoundClick}
            />
          );
          
          const toggleButton = container.querySelector('[aria-expanded]');
          expect(toggleButton).not.toBeNull();
          expect(toggleButton?.getAttribute('aria-expanded')).toBe(expanded ? 'true' : 'false');
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4.7: Clicking toggle button calls onToggle', () => {
      fc.assert(
        fc.property(completedRoundsArb, fc.boolean(), (completedRounds, expanded) => {
          let toggleCalled = false;
          const onToggle = () => { toggleCalled = true; };
          const onRoundClick = () => {};
          
          const { container } = render(
            <RoundHistory
              completedRounds={completedRounds}
              expanded={expanded}
              onToggle={onToggle}
              onRoundClick={onRoundClick}
            />
          );
          
          const toggleButton = container.querySelector('[aria-expanded]');
          if (toggleButton) {
            fireEvent.click(toggleButton);
            expect(toggleCalled).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('Property 4.8: Clicking a round summary calls onRoundClick with correct round number', () => {
      fc.assert(
        fc.property(completedRoundsArb, (completedRounds) => {
          const clickedRounds: number[] = [];
          const onToggle = () => {};
          const onRoundClick = (roundNumber: 1 | 2 | 3) => { clickedRounds.push(roundNumber); };
          
          const { container } = render(
            <RoundHistory
              completedRounds={completedRounds}
              expanded={true}
              onToggle={onToggle}
              onRoundClick={onRoundClick}
            />
          );
          
          // Find all round summary buttons (excluding the toggle button)
          const buttons = container.querySelectorAll('button');
          // First button is toggle, rest are round summaries
          const summaryButtons = Array.from(buttons).slice(1);
          
          // Click each summary button
          summaryButtons.forEach((button) => {
            fireEvent.click(button);
          });
          
          // Should have called onRoundClick for each completed round
          expect(clickedRounds.length).toBe(completedRounds.length);
          
          // Each click should correspond to the correct round number
          for (let i = 0; i < completedRounds.length; i++) {
            expect(clickedRounds[i]).toBe(completedRounds[i].roundNumber);
          }
        }),
        { numRuns: 100 }
      );

    });

    it('Property 4.9: Each round summary shows "Completed" status (Requirement 4.3)', () => {
      fc.assert(
        fc.property(completedRoundsArb, (completedRounds) => {
          const onToggle = () => {};
          const onRoundClick = () => {};
          
          const { container } = render(
            <RoundHistory
              completedRounds={completedRounds}
              expanded={true}
              onToggle={onToggle}
              onRoundClick={onRoundClick}
            />
          );
          
          // Count occurrences of "Completed" text
          const completedMatches = (container.textContent?.match(/Completed/g) || []).length;
          
          // Should have "Completed" for each round summary
          expect(completedMatches).toBe(completedRounds.length);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4 (continued): Excerpt generation in history summaries
   * Validates: Requirements 4.3
   */
  describe('RoundHistory excerpt display', () => {
    // Generator for content that starts with a non-whitespace character
    const contentStringArb = (minLength: number, maxLength: number) =>
      fc.tuple(
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'),
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?'), { minLength: minLength - 1, maxLength: maxLength - 1 })
      ).map(([first, rest]) => first + rest);

    it('Property 4.10: Excerpts are truncated to <= 100 characters + "..."', () => {
      fc.assert(
        fc.property(
          completedRoundsArb,
          contentStringArb(150, 500),
          contentStringArb(150, 500),
          (completedRounds, supportContent, opposeContent) => {
            const onToggle = () => {};
            const onRoundClick = () => {};
            
            // Create arguments with long content
            const args: { [key: number]: { support?: any; oppose?: any } } = {};
            for (const round of completedRounds) {
              args[round.roundNumber] = {
                support: { content: supportContent },
                oppose: { content: opposeContent },
              };
            }
            
            const { container } = render(
              <RoundHistory
                completedRounds={completedRounds}
                arguments={args}
                expanded={true}
                onToggle={onToggle}
                onRoundClick={onRoundClick}
              />
            );
            
            // The full content should NOT appear (it's truncated)
            expect(container.textContent).not.toContain(supportContent);
            expect(container.textContent).not.toContain(opposeContent);
            
            // The excerpts should be present (checking for the start of the excerpt)
            expect(container.textContent).toContain(supportContent.substring(0, 50));
            expect(container.textContent).toContain(opposeContent.substring(0, 50));
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property 4.11: Short content is displayed without truncation', () => {
      fc.assert(
        fc.property(
          completedRoundsArb,
          contentStringArb(1, 50),
          contentStringArb(1, 50),
          (completedRounds, supportContent, opposeContent) => {
            const onToggle = () => {};
            const onRoundClick = () => {};
            
            // Create arguments with short content
            const args: { [key: number]: { support?: any; oppose?: any } } = {};
            for (const round of completedRounds) {
              args[round.roundNumber] = {
                support: { content: supportContent },
                oppose: { content: opposeContent },
              };
            }
            
            const { container } = render(
              <RoundHistory
                completedRounds={completedRounds}
                arguments={args}
                expanded={true}
                onToggle={onToggle}
                onRoundClick={onRoundClick}
              />
            );
            
            // Short content should appear in full (once per completed round)
            expect(container.textContent).toContain(supportContent);
            expect(container.textContent).toContain(opposeContent);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property 4.12: Debater names are shown when provided', () => {
      fc.assert(
        fc.property(completedRoundsArb, userArb, userArb, (completedRounds, supportDebater, opposeDebater) => {
          const onToggle = () => {};
          const onRoundClick = () => {};
          
          // Create arguments for rounds
          const args: { [key: number]: { support?: any; oppose?: any } } = {};
          for (const round of completedRounds) {
            args[round.roundNumber] = {
              support: { content: 'Support argument' },
              oppose: { content: 'Oppose argument' },
            };
          }
          
          const { container } = render(
            <RoundHistory
              completedRounds={completedRounds}
              supportDebater={supportDebater}
              opposeDebater={opposeDebater}
              arguments={args}
              expanded={true}
              onToggle={onToggle}
              onRoundClick={onRoundClick}
            />
          );
          
          // Debater usernames should appear
          expect(container.textContent).toContain(supportDebater.username);
          expect(container.textContent).toContain(opposeDebater.username);
        }),
        { numRuns: 50 }
      );
    });
  });
});


/**
 * Property-based tests for ActiveRoundView component - Form Visibility.
 * 
 * Feature: unified-round-section, Property 6: Argument Form Visibility
 * Validates: Requirements 7.1, 7.4
 */
describe('ActiveRoundView Property Tests - Form Visibility', () => {
  // Generate argument for testing
  const argumentArb: fc.Arbitrary<Argument> = fc.record({
    id: fc.uuid(),
    roundId: fc.uuid(),
    debaterId: fc.uuid(),
    side: sideArb,
    content: fc.string({ minLength: 1, maxLength: 500 }),
    impactScore: fc.integer({ min: 0, max: 100 }),
    createdAt: fc.date(),
  });

  // Generate user for debater info
  const formUserArb: fc.Arbitrary<User> = fc.record({
    id: fc.uuid(),
    authUserId: fc.option(fc.uuid(), { nil: null }),
    username: fc.string({ minLength: 1, maxLength: 50 }),
    email: fc.emailAddress(),
    reputationScore: fc.integer({ min: 0, max: 1000 }),
    predictionAccuracy: fc.float({ min: 0, max: 1 }),
    debatesParticipated: fc.integer({ min: 0, max: 100 }),
    sandboxCompleted: fc.boolean(),
    createdAt: fc.date(),
  });

  /**
   * Property 6: Argument Form Visibility
   * For any user viewing a debate:
   * - Submission form is visible IFF: user is a debater AND it is their turn AND viewing the active round
   * - Submission form is NOT visible for spectators (non-debaters)
   * - Submission form is NOT visible when viewing historical rounds
   * 
   * Validates: Requirements 7.1, 7.4
   */
  describe('ArgumentSubmissionForm visibility', () => {
    it('Property 6.1: Form is NOT visible when canSubmitArgument is false (spectators)', () => {
      fc.assert(
        fc.property(
          roundArb(1),
          roundNumberArb,
          sideArb,
          fc.boolean(),
          (round, roundNumber, currentTurn, isActiveRound) => {
            const { container } = render(
              <ActiveRoundView
                round={round}
                roundNumber={roundNumber}
                isActiveRound={isActiveRound}
                currentTurn={currentTurn}
                canSubmitArgument={false}
              />
            );
            
            // Form should NOT be present when canSubmitArgument is false
            const form = container.querySelector('form');
            expect(form).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 6.2: Form is NOT visible when viewing historical round (isActiveRound=false)', () => {
      fc.assert(
        fc.property(
          roundArb(1),
          roundNumberArb,
          sideArb,
          sideArb,
          (round, roundNumber, currentTurn, userSide) => {
            const { container } = render(
              <ActiveRoundView
                round={round}
                roundNumber={roundNumber}
                isActiveRound={false}
                currentTurn={currentTurn}
                canSubmitArgument={true}
                userSide={userSide}
              />
            );
            
            // Form should NOT be present when viewing historical round
            const form = container.querySelector('form');
            expect(form).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 6.3: Form is NOT visible when it is NOT the user\'s turn', () => {
      fc.assert(
        fc.property(
          roundArb(1),
          roundNumberArb,
          (round, roundNumber) => {
            // User is support, but it's oppose's turn
            const { container } = render(
              <ActiveRoundView
                round={round}
                roundNumber={roundNumber}
                isActiveRound={true}
                currentTurn="oppose"
                canSubmitArgument={true}
                userSide="support"
              />
            );
            
            // Form should NOT be present when it's not user's turn
            const form = container.querySelector('form');
            expect(form).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 6.4: Form IS visible when all conditions are met (debater, their turn, active round, no existing argument)', () => {
      fc.assert(
        fc.property(
          roundArb(1),
          roundNumberArb,
          sideArb,
          (round, roundNumber, side) => {
            // Clear any existing arguments for the user's side
            const roundWithoutArg = {
              ...round,
              supportArgumentId: side === 'support' ? null : round.supportArgumentId,
              opposeArgumentId: side === 'oppose' ? null : round.opposeArgumentId,
            };
            
            // For rounds 2-3, steelman gate requires approved status
            const steelmanData = roundNumber > 1 
              ? { status: 'approved' as const } 
              : undefined;
            
            const { container } = render(
              <ActiveRoundView
                round={roundWithoutArg}
                roundNumber={roundNumber}
                isActiveRound={true}
                currentTurn={side}
                canSubmitArgument={true}
                userSide={side}
                onArgumentSubmit={() => {}}
                steelmanData={steelmanData}
              />
            );
            
            // Form SHOULD be present when all conditions are met
            const form = container.querySelector('form');
            expect(form).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 6.5: Form is NOT visible when user has already submitted argument', () => {
      fc.assert(
        fc.property(
          roundArb(1),
          roundNumberArb,
          argumentArb,
          formUserArb,
          (round, roundNumber, argument, author) => {
            // User is support and has already submitted
            const supportArgument = { ...argument, side: 'support' as const };
            
            const { container } = render(
              <ActiveRoundView
                round={round}
                roundNumber={roundNumber}
                supportArgument={supportArgument}
                supportAuthor={author}
                isActiveRound={true}
                currentTurn="support"
                canSubmitArgument={true}
                userSide="support"
              />
            );
            
            // Form should NOT be present when argument already exists
            const form = container.querySelector('form');
            expect(form).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 6.6: ArgumentBlock is rendered when argument exists', () => {
      fc.assert(
        fc.property(
          roundArb(1),
          roundNumberArb,
          argumentArb,
          formUserArb,
          fc.boolean(),
          (round, roundNumber, argument, author, isActiveRound) => {
            const supportArgument = { ...argument, side: 'support' as const };
            
            const { container } = render(
              <ActiveRoundView
                round={round}
                roundNumber={roundNumber}
                supportArgument={supportArgument}
                supportAuthor={author}
                isActiveRound={isActiveRound}
                currentTurn="support"
                canSubmitArgument={false}
              />
            );
            
            // Should show the argument content
            expect(container.textContent).toContain(supportArgument.content);
            // Should show the author username
            expect(container.textContent).toContain(author.username);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * Property-based tests for ArgumentSubmissionForm component - Character Limits.
 * 
 * Feature: unified-round-section, Property 7: Character Limit Display
 * Validates: Requirements 7.2
 */
describe('ArgumentSubmissionForm Property Tests - Character Limits', () => {
  /**
   * Property 7: Character Limit Display
   * For any round type, the argument submission form SHALL display the correct character limit:
   * - Opening rounds: 2000 characters
   * - Rebuttal rounds: 1500 characters
   * - Closing rounds: 1000 characters
   * 
   * Validates: Requirements 7.2
   */
  describe('Character limit display', () => {
    it('Property 7.1: Opening round shows 2000 character limit', () => {
      fc.assert(
        fc.property(sideArb, (side) => {
          const { container } = render(
            <ArgumentSubmissionForm
              roundType="opening"
              side={side}
              onSubmit={() => {}}
              isSubmitting={false}
            />
          );
          
          // Should show "2,000" in the character counter
          expect(container.textContent).toContain('2,000');
        }),
        { numRuns: 100 }
      );
    });

    it('Property 7.2: Rebuttal round shows 1500 character limit', () => {
      fc.assert(
        fc.property(sideArb, (side) => {
          const { container } = render(
            <ArgumentSubmissionForm
              roundType="rebuttal"
              side={side}
              onSubmit={() => {}}
              isSubmitting={false}
            />
          );
          
          // Should show "1,500" in the character counter
          expect(container.textContent).toContain('1,500');
        }),
        { numRuns: 100 }
      );
    });

    it('Property 7.3: Closing round shows 1000 character limit', () => {
      fc.assert(
        fc.property(sideArb, (side) => {
          const { container } = render(
            <ArgumentSubmissionForm
              roundType="closing"
              side={side}
              onSubmit={() => {}}
              isSubmitting={false}
            />
          );
          
          // Should show "1,000" in the character counter
          expect(container.textContent).toContain('1,000');
        }),
        { numRuns: 100 }
      );
    });

    it('Property 7.4: Character limit matches ARGUMENT_CHAR_LIMITS constant for all round types', () => {
      fc.assert(
        fc.property(roundTypeArb, sideArb, (roundType, side) => {
          const { container } = render(
            <ArgumentSubmissionForm
              roundType={roundType}
              side={side}
              onSubmit={() => {}}
              isSubmitting={false}
            />
          );
          
          const expectedLimit = ARGUMENT_CHAR_LIMITS[roundType];
          // Should show the formatted limit (with comma separator)
          expect(container.textContent).toContain(expectedLimit.toLocaleString());
        }),
        { numRuns: 100 }
      );
    });

    it('Property 7.5: Character counter updates as user types', () => {
      fc.assert(
        fc.property(
          roundTypeArb,
          sideArb,
          fc.string({ minLength: 1, maxLength: 100 }),
          (roundType, side, inputText) => {
            const { container } = render(
              <ArgumentSubmissionForm
                roundType={roundType}
                side={side}
                onSubmit={() => {}}
                isSubmitting={false}
              />
            );
            
            const textarea = container.querySelector('textarea');
            expect(textarea).not.toBeNull();
            
            // Type some text
            fireEvent.change(textarea!, { target: { value: inputText } });
            
            // Should show the current character count
            expect(container.textContent).toContain(inputText.length.toLocaleString());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 7.6: Submit button is disabled when content exceeds limit', () => {
      fc.assert(
        fc.property(roundTypeArb, sideArb, (roundType, side) => {
          const { container } = render(
            <ArgumentSubmissionForm
              roundType={roundType}
              side={side}
              onSubmit={() => {}}
              isSubmitting={false}
            />
          );
          
          const textarea = container.querySelector('textarea');
          const limit = ARGUMENT_CHAR_LIMITS[roundType];
          
          // Type content that exceeds the limit
          const overLimitContent = 'a'.repeat(limit + 1);
          fireEvent.change(textarea!, { target: { value: overLimitContent } });
          
          // Submit button should be disabled
          const submitButton = container.querySelector('button[type="submit"]');
          expect(submitButton).not.toBeNull();
          expect(submitButton?.hasAttribute('disabled')).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 7.7: Submit button is disabled when content is empty', () => {
      fc.assert(
        fc.property(roundTypeArb, sideArb, (roundType, side) => {
          const { container } = render(
            <ArgumentSubmissionForm
              roundType={roundType}
              side={side}
              onSubmit={() => {}}
              isSubmitting={false}
            />
          );
          
          // Submit button should be disabled when empty
          const submitButton = container.querySelector('button[type="submit"]');
          expect(submitButton).not.toBeNull();
          expect(submitButton?.hasAttribute('disabled')).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 7.8: Submit button is enabled when content is valid (non-empty and within limit)', () => {
      fc.assert(
        fc.property(roundTypeArb, sideArb, (roundType, side) => {
          const { container } = render(
            <ArgumentSubmissionForm
              roundType={roundType}
              side={side}
              onSubmit={() => {}}
              isSubmitting={false}
            />
          );
          
          const textarea = container.querySelector('textarea');
          const limit = ARGUMENT_CHAR_LIMITS[roundType];
          
          // Type valid content (within limit)
          const validContent = 'a'.repeat(Math.min(100, limit));
          fireEvent.change(textarea!, { target: { value: validContent } });
          
          // Submit button should be enabled
          const submitButton = container.querySelector('button[type="submit"]');
          expect(submitButton).not.toBeNull();
          expect(submitButton?.hasAttribute('disabled')).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 7.9: Form shows correct side label (For/Against)', () => {
      fc.assert(
        fc.property(roundTypeArb, sideArb, (roundType, side) => {
          const { container } = render(
            <ArgumentSubmissionForm
              roundType={roundType}
              side={side}
              onSubmit={() => {}}
              isSubmitting={false}
            />
          );
          
          const expectedLabel = side === 'support' ? 'For' : 'Against';
          expect(container.textContent).toContain(expectedLabel);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 7.10: Submit button is disabled when isSubmitting is true', () => {
      fc.assert(
        fc.property(roundTypeArb, sideArb, (roundType, side) => {
          const { container } = render(
            <ArgumentSubmissionForm
              roundType={roundType}
              side={side}
              onSubmit={() => {}}
              isSubmitting={true}
            />
          );
          
          const textarea = container.querySelector('textarea');
          fireEvent.change(textarea!, { target: { value: 'Valid content' } });
          
          // Submit button should be disabled when submitting
          const submitButton = container.querySelector('button[type="submit"]');
          expect(submitButton).not.toBeNull();
          expect(submitButton?.hasAttribute('disabled')).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * Property-based tests for RoundSection container component.
 * 
 * Feature: unified-round-section, Property 1: Round Display Matches Debate State
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 */
describe('RoundSection Property Tests - Round Display Matches Debate State', () => {
  // Generate user for debater info
  const userArb: fc.Arbitrary<User> = fc.record({
    id: fc.uuid(),
    authUserId: fc.option(fc.uuid(), { nil: null }),
    username: fc.string({ minLength: 1, maxLength: 50 }),
    email: fc.emailAddress(),
    reputationScore: fc.integer({ min: 0, max: 1000 }),
    predictionAccuracy: fc.float({ min: 0, max: 1 }),
    debatesParticipated: fc.integer({ min: 0, max: 100 }),
    sandboxCompleted: fc.boolean(),
    createdAt: fc.date(),
  });

  // Generate consistent rounds with proper round types
  const consistentRoundsArb = (currentRound: 1 | 2 | 3, status: 'active' | 'concluded'): fc.Arbitrary<Round[]> => {
    return fc.tuple(
      fc.record({
        id: fc.uuid(),
        debateId: fc.uuid(),
        roundNumber: fc.constant(1 as 1),
        roundType: fc.constant('opening' as const),
        supportArgumentId: fc.option(fc.uuid(), { nil: null }),
        opposeArgumentId: fc.option(fc.uuid(), { nil: null }),
        // Round 1 is completed if currentRound > 1 or debate is concluded
        completedAt: currentRound > 1 || status === 'concluded' ? fc.date() : fc.constant(null),
      }),
      fc.record({
        id: fc.uuid(),
        debateId: fc.uuid(),
        roundNumber: fc.constant(2 as 2),
        roundType: fc.constant('rebuttal' as const),
        supportArgumentId: fc.option(fc.uuid(), { nil: null }),
        opposeArgumentId: fc.option(fc.uuid(), { nil: null }),
        // Round 2 is completed if currentRound > 2 or debate is concluded
        completedAt: currentRound > 2 || status === 'concluded' ? fc.date() : fc.constant(null),
      }),
      fc.record({
        id: fc.uuid(),
        debateId: fc.uuid(),
        roundNumber: fc.constant(3 as 3),
        roundType: fc.constant('closing' as const),
        supportArgumentId: fc.option(fc.uuid(), { nil: null }),
        opposeArgumentId: fc.option(fc.uuid(), { nil: null }),
        // Round 3 is completed only if debate is concluded
        completedAt: status === 'concluded' ? fc.date() : fc.constant(null),
      })
    ).map(([r1, r2, r3]) => [r1, r2, r3]);
  };

  /**
   * Property 1: Round Display Matches Debate State
   * For any debate with a given currentRound and status, the Unified_Round_Section SHALL display
   * the round corresponding to that state.
   * 
   * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
   */
  describe('Round display matches debate state', () => {
    it('Property 1.1: Only one round content is visible at a time (Requirement 1.1)', () => {
      fc.assert(
        fc.property(
          roundNumberArb,
          sideArb,
          debateStatusArb,
          (currentRound, currentTurn, status) => {
            return fc.assert(
              fc.property(
                consistentRoundsArb(currentRound, status),
                (rounds) => {
                  const debate: Debate = {
                    id: 'test-debate',
                    resolution: 'Test resolution',
                    status,
                    currentRound,
                    currentTurn,
                    supportDebaterId: 'support-id',
                    opposeDebaterId: 'oppose-id',
                    createdAt: new Date(),
                    concludedAt: status === 'concluded' ? new Date() : null,
                  };

                  const { container } = render(
                    <RoundSection
                      debate={debate}
                      rounds={rounds}
                    />
                  );

                  // Count the number of round sections (ActiveRoundView renders with data-round attribute)
                  const roundSections = container.querySelectorAll('[data-round]');
                  expect(roundSections.length).toBe(1);
                }
              ),
              { numRuns: 10 }
            );
          }
        ),
        { numRuns: 10 }
      );
    });

    it('Property 1.2: Active debate in Round 1 displays Opening round (Requirement 1.2)', () => {
      fc.assert(
        fc.property(
          sideArb,
          consistentRoundsArb(1, 'active'),
          (currentTurn, rounds) => {
            const debate: Debate = {
              id: 'test-debate',
              resolution: 'Test resolution',
              status: 'active',
              currentRound: 1,
              currentTurn,
              supportDebaterId: 'support-id',
              opposeDebaterId: 'oppose-id',
              createdAt: new Date(),
              concludedAt: null,
            };

            const { container } = render(
              <RoundSection
                debate={debate}
                rounds={rounds}
              />
            );

            // Should display Round 1 (Opening)
            const roundSection = container.querySelector('[data-round="1"]');
            expect(roundSection).not.toBeNull();
            expect(container.textContent).toContain('Opening');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 1.3: Active debate in Round 2 displays Rebuttal round (Requirement 1.3)', () => {
      fc.assert(
        fc.property(
          sideArb,
          consistentRoundsArb(2, 'active'),
          (currentTurn, rounds) => {
            const debate: Debate = {
              id: 'test-debate',
              resolution: 'Test resolution',
              status: 'active',
              currentRound: 2,
              currentTurn,
              supportDebaterId: 'support-id',
              opposeDebaterId: 'oppose-id',
              createdAt: new Date(),
              concludedAt: null,
            };

            const { container } = render(
              <RoundSection
                debate={debate}
                rounds={rounds}
              />
            );

            // Should display Round 2 (Rebuttal)
            const roundSection = container.querySelector('[data-round="2"]');
            expect(roundSection).not.toBeNull();
            expect(container.textContent).toContain('Rebuttal');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 1.4: Active debate in Round 3 displays Closing round (Requirement 1.4)', () => {
      fc.assert(
        fc.property(
          sideArb,
          consistentRoundsArb(3, 'active'),
          (currentTurn, rounds) => {
            const debate: Debate = {
              id: 'test-debate',
              resolution: 'Test resolution',
              status: 'active',
              currentRound: 3,
              currentTurn,
              supportDebaterId: 'support-id',
              opposeDebaterId: 'oppose-id',
              createdAt: new Date(),
              concludedAt: null,
            };

            const { container } = render(
              <RoundSection
                debate={debate}
                rounds={rounds}
              />
            );

            // Should display Round 3 (Closing)
            const roundSection = container.querySelector('[data-round="3"]');
            expect(roundSection).not.toBeNull();
            expect(container.textContent).toContain('Closing');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 1.5: Concluded debate displays Closing round by default (Requirement 1.5)', () => {
      fc.assert(
        fc.property(
          roundNumberArb,
          sideArb,
          consistentRoundsArb(3, 'concluded'),
          (currentRound, currentTurn, rounds) => {
            const debate: Debate = {
              id: 'test-debate',
              resolution: 'Test resolution',
              status: 'concluded',
              currentRound,
              currentTurn,
              supportDebaterId: 'support-id',
              opposeDebaterId: 'oppose-id',
              createdAt: new Date(),
              concludedAt: new Date(),
            };

            const { container } = render(
              <RoundSection
                debate={debate}
                rounds={rounds}
              />
            );

            // Should display Round 3 (Closing) by default for concluded debates
            const roundSection = container.querySelector('[data-round="3"]');
            expect(roundSection).not.toBeNull();
            expect(container.textContent).toContain('Closing');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 1.6: Component renders all sub-components', () => {
      fc.assert(
        fc.property(
          roundNumberArb,
          sideArb,
          debateStatusArb,
          (currentRound, currentTurn, status) => {
            return fc.assert(
              fc.property(
                consistentRoundsArb(currentRound, status),
                (rounds) => {
                  const debate: Debate = {
                    id: 'test-debate',
                    resolution: 'Test resolution',
                    status,
                    currentRound,
                    currentTurn,
                    supportDebaterId: 'support-id',
                    opposeDebaterId: 'oppose-id',
                    createdAt: new Date(),
                    concludedAt: status === 'concluded' ? new Date() : null,
                  };

                  const { container } = render(
                    <RoundSection
                      debate={debate}
                      rounds={rounds}
                    />
                  );

                  // Should have compact progress bar with progress text
                  const progressBar = container.querySelector('[data-testid="compact-progress-bar"]');
                  expect(progressBar).not.toBeNull();

                  // Should have round dots for navigation (3 dots)
                  const roundDots = container.querySelectorAll('[data-testid^="round-dot-"]');
                  expect(roundDots.length).toBe(3);

                  // Should have active round view
                  const roundSection = container.querySelector('[data-round]');
                  expect(roundSection).not.toBeNull();
                }
              ),
              { numRuns: 10 }
            );
          }
        ),
        { numRuns: 10 }
      );
    });

    it('Property 1.7: Navigation changes displayed round', () => {
      fc.assert(
        fc.property(
          sideArb,
          consistentRoundsArb(2, 'active'),
          (currentTurn, rounds) => {
            const debate: Debate = {
              id: 'test-debate',
              resolution: 'Test resolution',
              status: 'active',
              currentRound: 2,
              currentTurn,
              supportDebaterId: 'support-id',
              opposeDebaterId: 'oppose-id',
              createdAt: new Date(),
              concludedAt: null,
            };

            const { container } = render(
              <RoundSection
                debate={debate}
                rounds={rounds}
              />
            );

            // Initially should show Round 2
            expect(container.querySelector('[data-round="2"]')).not.toBeNull();

            // Click on Round 1 dot (Opening - which is completed)
            const roundDot1 = container.querySelector('[data-testid="round-dot-1"]');
            expect(roundDot1).not.toBeNull();
            fireEvent.click(roundDot1!);

            // Should now show Round 1
            expect(container.querySelector('[data-round="1"]')).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 1.8: History is shown when viewing active round with completed rounds', () => {
      fc.assert(
        fc.property(
          sideArb,
          consistentRoundsArb(2, 'active'),
          (currentTurn, rounds) => {
            const debate: Debate = {
              id: 'test-debate',
              resolution: 'Test resolution',
              status: 'active',
              currentRound: 2,
              currentTurn,
              supportDebaterId: 'support-id',
              opposeDebaterId: 'oppose-id',
              createdAt: new Date(),
              concludedAt: null,
            };

            const { container } = render(
              <RoundSection
                debate={debate}
                rounds={rounds}
              />
            );

            // Should show history section (Round 1 is completed)
            expect(container.textContent).toContain('Previous Rounds');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 1.9: History is NOT shown when in Round 1 (no history exists)', () => {
      fc.assert(
        fc.property(
          sideArb,
          consistentRoundsArb(1, 'active'),
          (currentTurn, rounds) => {
            const debate: Debate = {
              id: 'test-debate',
              resolution: 'Test resolution',
              status: 'active',
              currentRound: 1,
              currentTurn,
              supportDebaterId: 'support-id',
              opposeDebaterId: 'oppose-id',
              createdAt: new Date(),
              concludedAt: null,
            };

            const { container } = render(
              <RoundSection
                debate={debate}
                rounds={rounds}
              />
            );

            // Should NOT show history section (no completed rounds)
            expect(container.textContent).not.toContain('Previous Rounds');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 1.10: Debater can see submission form on their turn', () => {
      fc.assert(
        fc.property(
          sideArb,
          userArb,
          userArb,
          consistentRoundsArb(1, 'active'),
          (currentTurn, supportDebater, opposeDebater, rounds) => {
            // Clear arguments so form can be shown
            const roundsWithoutArgs = rounds.map(r => ({
              ...r,
              supportArgumentId: null,
              opposeArgumentId: null,
            }));

            const debate: Debate = {
              id: 'test-debate',
              resolution: 'Test resolution',
              status: 'active',
              currentRound: 1,
              currentTurn,
              supportDebaterId: supportDebater.id,
              opposeDebaterId: opposeDebater.id,
              createdAt: new Date(),
              concludedAt: null,
            };

            // Current user is the one whose turn it is
            const currentUserId = currentTurn === 'support' ? supportDebater.id : opposeDebater.id;

            const { container } = render(
              <RoundSection
                debate={debate}
                rounds={roundsWithoutArgs}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
                currentUserId={currentUserId}
                onArgumentSubmit={() => {}}
              />
            );

            // Should show submission form
            const form = container.querySelector('form');
            expect(form).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 1.11: Spectator cannot see submission form', () => {
      fc.assert(
        fc.property(
          sideArb,
          userArb,
          userArb,
          consistentRoundsArb(1, 'active'),
          (currentTurn, supportDebater, opposeDebater, rounds) => {
            const debate: Debate = {
              id: 'test-debate',
              resolution: 'Test resolution',
              status: 'active',
              currentRound: 1,
              currentTurn,
              supportDebaterId: supportDebater.id,
              opposeDebaterId: opposeDebater.id,
              createdAt: new Date(),
              concludedAt: null,
            };

            // Current user is a spectator (different ID)
            const spectatorId = 'spectator-id';

            const { container } = render(
              <RoundSection
                debate={debate}
                rounds={rounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
                currentUserId={spectatorId}
                onArgumentSubmit={() => {}}
              />
            );

            // Should NOT show submission form
            const form = container.querySelector('form');
            expect(form).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * Property-based tests for state preservation during updates.
 * 
 * Feature: unified-round-section, Property 5: State Preservation During Updates
 * Validates: Requirements 3.6, 5.4, 5.5
 */
describe('RoundSection Property Tests - State Preservation During Updates', () => {
  // Generate user for debater info
  const userArb: fc.Arbitrary<User> = fc.record({
    id: fc.uuid(),
    authUserId: fc.option(fc.uuid(), { nil: null }),
    username: fc.string({ minLength: 1, maxLength: 50 }),
    email: fc.emailAddress(),
    reputationScore: fc.integer({ min: 0, max: 1000 }),
    predictionAccuracy: fc.float({ min: 0, max: 1 }),
    debatesParticipated: fc.integer({ min: 0, max: 100 }),
    sandboxCompleted: fc.boolean(),
    createdAt: fc.date(),
  });

  // Generate consistent rounds with proper round types
  const consistentRoundsArb = (currentRound: 1 | 2 | 3, status: 'active' | 'concluded'): fc.Arbitrary<Round[]> => {
    return fc.tuple(
      fc.record({
        id: fc.uuid(),
        debateId: fc.uuid(),
        roundNumber: fc.constant(1 as 1),
        roundType: fc.constant('opening' as const),
        supportArgumentId: fc.option(fc.uuid(), { nil: null }),
        opposeArgumentId: fc.option(fc.uuid(), { nil: null }),
        // Round 1 is completed if currentRound > 1 or debate is concluded
        completedAt: currentRound > 1 || status === 'concluded' ? fc.date() : fc.constant(null),
      }),
      fc.record({
        id: fc.uuid(),
        debateId: fc.uuid(),
        roundNumber: fc.constant(2 as 2),
        roundType: fc.constant('rebuttal' as const),
        supportArgumentId: fc.option(fc.uuid(), { nil: null }),
        opposeArgumentId: fc.option(fc.uuid(), { nil: null }),
        // Round 2 is completed if currentRound > 2 or debate is concluded
        completedAt: currentRound > 2 || status === 'concluded' ? fc.date() : fc.constant(null),
      }),
      fc.record({
        id: fc.uuid(),
        debateId: fc.uuid(),
        roundNumber: fc.constant(3 as 3),
        roundType: fc.constant('closing' as const),
        supportArgumentId: fc.option(fc.uuid(), { nil: null }),
        opposeArgumentId: fc.option(fc.uuid(), { nil: null }),
        // Round 3 is completed only if debate is concluded
        completedAt: status === 'concluded' ? fc.date() : fc.constant(null),
      })
    ).map(([r1, r2, r3]) => [r1, r2, r3]);
  };

  // Generate argument for testing
  const argumentArb: fc.Arbitrary<Argument> = fc.record({
    id: fc.uuid(),
    roundId: fc.uuid(),
    debaterId: fc.uuid(),
    side: fc.constantFrom('support', 'oppose') as fc.Arbitrary<'support' | 'oppose'>,
    content: fc.string({ minLength: 1, maxLength: 500 }),
    impactScore: fc.integer({ min: 0, max: 100 }),
    createdAt: fc.date(),
  });

  /**
   * Property 5: State Preservation During Updates
   * For any external update (new argument, round completion, SSE event):
   * - viewedRound remains unchanged when user is viewing a historical round
   * - "This changed my mind" button attribution state persists across round transitions
   * - User's viewing context is preserved when new arguments arrive
   * 
   * Validates: Requirements 3.6, 5.4, 5.5
   */
  describe('State preservation during updates', () => {
    it('Property 5.1: viewedRound is preserved when user is viewing history and new argument arrives (Requirement 3.6)', () => {
      fc.assert(
        fc.property(
          sideArb,
          userArb,
          userArb,
          consistentRoundsArb(2, 'active'),
          argumentArb,
          (currentTurn, supportDebater, opposeDebater, rounds, newArgument) => {
            const debate: Debate = {
              id: 'test-debate',
              resolution: 'Test resolution',
              status: 'active',
              currentRound: 2,
              currentTurn,
              supportDebaterId: supportDebater.id,
              opposeDebaterId: opposeDebater.id,
              createdAt: new Date(),
              concludedAt: null,
            };

            const { container, rerender } = render(
              <RoundSection
                debate={debate}
                rounds={rounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
              />
            );

            // Navigate to Round 1 (history) using round dot
            const roundDot1 = container.querySelector('[data-testid="round-dot-1"]');
            expect(roundDot1).not.toBeNull();
            fireEvent.click(roundDot1!);

            // Verify we're viewing Round 1
            expect(container.querySelector('[data-round="1"]')).not.toBeNull();

            // Simulate new argument arriving (SSE event) - rerender with updated arguments
            const updatedArgs = {
              2: {
                support: { ...newArgument, side: 'support' as const },
              },
            };

            rerender(
              <RoundSection
                debate={debate}
                rounds={rounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
                arguments={updatedArgs}
              />
            );

            // viewedRound should still be Round 1 (preserved)
            expect(container.querySelector('[data-round="1"]')).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 5.2: viewedRound follows to new round when user was viewing the active round (Requirement 5.4)', () => {
      fc.assert(
        fc.property(
          sideArb,
          userArb,
          userArb,
          (currentTurn, supportDebater, opposeDebater) => {
            // Start with Round 1 active
            const initialRounds: Round[] = [
              {
                id: 'round-1',
                debateId: 'test-debate',
                roundNumber: 1,
                roundType: 'opening',
                supportArgumentId: 'arg-1',
                opposeArgumentId: 'arg-2',
                completedAt: null, // Not completed yet
              },
              {
                id: 'round-2',
                debateId: 'test-debate',
                roundNumber: 2,
                roundType: 'rebuttal',
                supportArgumentId: null,
                opposeArgumentId: null,
                completedAt: null,
              },
              {
                id: 'round-3',
                debateId: 'test-debate',
                roundNumber: 3,
                roundType: 'closing',
                supportArgumentId: null,
                opposeArgumentId: null,
                completedAt: null,
              },
            ];

            const initialDebate: Debate = {
              id: 'test-debate',
              resolution: 'Test resolution',
              status: 'active',
              currentRound: 1,
              currentTurn,
              supportDebaterId: supportDebater.id,
              opposeDebaterId: opposeDebater.id,
              createdAt: new Date(),
              concludedAt: null,
            };

            const { container, rerender } = render(
              <RoundSection
                debate={initialDebate}
                rounds={initialRounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
              />
            );

            // Verify we're viewing Round 1
            expect(container.querySelector('[data-round="1"]')).not.toBeNull();

            // Simulate round completion and debate advancing to Round 2
            const updatedRounds: Round[] = [
              {
                ...initialRounds[0],
                completedAt: new Date(), // Now completed
              },
              initialRounds[1],
              initialRounds[2],
            ];

            const updatedDebate: Debate = {
              ...initialDebate,
              currentRound: 2, // Advanced to Round 2
            };

            rerender(
              <RoundSection
                debate={updatedDebate}
                rounds={updatedRounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
              />
            );

            // viewedRound should follow to Round 2 (user was viewing active round)
            expect(container.querySelector('[data-round="2"]')).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 5.3: "This changed my mind" attribution state persists across round transitions (Requirement 5.5)', () => {
      fc.assert(
        fc.property(
          sideArb,
          userArb,
          userArb,
          argumentArb,
          argumentArb,
          (currentTurn, supportDebater, opposeDebater, supportArg, opposeArg) => {
            // Start with Round 2 active, Round 1 completed
            const rounds: Round[] = [
              {
                id: 'round-1',
                debateId: 'test-debate',
                roundNumber: 1,
                roundType: 'opening',
                supportArgumentId: supportArg.id,
                opposeArgumentId: opposeArg.id,
                completedAt: new Date(),
              },
              {
                id: 'round-2',
                debateId: 'test-debate',
                roundNumber: 2,
                roundType: 'rebuttal',
                supportArgumentId: null,
                opposeArgumentId: null,
                completedAt: null,
              },
              {
                id: 'round-3',
                debateId: 'test-debate',
                roundNumber: 3,
                roundType: 'closing',
                supportArgumentId: null,
                opposeArgumentId: null,
                completedAt: null,
              },
            ];

            const debate: Debate = {
              id: 'test-debate',
              resolution: 'Test resolution',
              status: 'active',
              currentRound: 2,
              currentTurn,
              supportDebaterId: supportDebater.id,
              opposeDebaterId: opposeDebater.id,
              createdAt: new Date(),
              concludedAt: null,
            };

            const roundArgs = {
              1: {
                support: { ...supportArg, side: 'support' as const },
                oppose: { ...opposeArg, side: 'oppose' as const },
              },
            };

            let mindChangedCalled = false;
            const onMindChanged = () => { mindChangedCalled = true; };

            const { container } = render(
              <RoundSection
                debate={debate}
                rounds={rounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
                arguments={roundArgs}
                onMindChanged={onMindChanged}
              />
            );

            // Navigate to Round 1 (history) using CompactProgressBar round dots
            const roundDot1 = container.querySelector('[data-testid="round-dot-1"]');
            const roundDot2 = container.querySelector('[data-testid="round-dot-2"]');
            if (roundDot1) fireEvent.click(roundDot1);

            // Find and click "This changed my mind" button
            const mindChangedButton = container.querySelector('button[title="Attribute your mind-change to this argument"]');
            if (mindChangedButton) {
              fireEvent.click(mindChangedButton);
              expect(mindChangedCalled).toBe(true);
            }

            // Navigate back to Round 2 using round dot
            if (roundDot2) fireEvent.click(roundDot2);

            // Navigate back to Round 1 using round dot
            if (roundDot1) fireEvent.click(roundDot1);

            // The attribution state should be preserved (button should show attributed state)
            // This is verified by the component maintaining the mindChangedArguments Set
            // The button should now show "Changed my mind" instead of "This changed my mind"
            const attributedText = container.textContent?.includes('Changed my mind');
            // If the button was clicked, the state should be preserved
            if (mindChangedButton) {
              expect(attributedText).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property 5.4: viewedRound is preserved when debate concludes while viewing history (Requirement 3.6)', () => {
      fc.assert(
        fc.property(
          sideArb,
          userArb,
          userArb,
          consistentRoundsArb(3, 'active'),
          (currentTurn, supportDebater, opposeDebater, rounds) => {
            const debate: Debate = {
              id: 'test-debate',
              resolution: 'Test resolution',
              status: 'active',
              currentRound: 3,
              currentTurn,
              supportDebaterId: supportDebater.id,
              opposeDebaterId: opposeDebater.id,
              createdAt: new Date(),
              concludedAt: null,
            };

            const { container, rerender } = render(
              <RoundSection
                debate={debate}
                rounds={rounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
              />
            );

            // Navigate to Round 1 (history) using CompactProgressBar round dots
            const roundDot1 = container.querySelector('[data-testid="round-dot-1"]');
            if (roundDot1) fireEvent.click(roundDot1);

            // Verify we're viewing Round 1
            expect(container.querySelector('[data-round="1"]')).not.toBeNull();

            // Simulate debate concluding
            const concludedDebate: Debate = {
              ...debate,
              status: 'concluded',
              concludedAt: new Date(),
            };

            const concludedRounds = rounds.map((r, _i) => ({
              ...r,
              completedAt: r.completedAt || new Date(),
            }));

            rerender(
              <RoundSection
                debate={concludedDebate}
                rounds={concludedRounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
              />
            );

            // viewedRound should still be Round 1 (preserved even when debate concludes)
            expect(container.querySelector('[data-round="1"]')).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 5.5: onRoundComplete callback is called when a round completes', () => {
      fc.assert(
        fc.property(
          sideArb,
          userArb,
          userArb,
          (currentTurn, supportDebater, opposeDebater) => {
            // Start with Round 1 not completed
            const initialRounds: Round[] = [
              {
                id: 'round-1',
                debateId: 'test-debate',
                roundNumber: 1,
                roundType: 'opening',
                supportArgumentId: 'arg-1',
                opposeArgumentId: 'arg-2',
                completedAt: null, // Not completed yet
              },
              {
                id: 'round-2',
                debateId: 'test-debate',
                roundNumber: 2,
                roundType: 'rebuttal',
                supportArgumentId: null,
                opposeArgumentId: null,
                completedAt: null,
              },
              {
                id: 'round-3',
                debateId: 'test-debate',
                roundNumber: 3,
                roundType: 'closing',
                supportArgumentId: null,
                opposeArgumentId: null,
                completedAt: null,
              },
            ];

            const debate: Debate = {
              id: 'test-debate',
              resolution: 'Test resolution',
              status: 'active',
              currentRound: 1,
              currentTurn,
              supportDebaterId: supportDebater.id,
              opposeDebaterId: opposeDebater.id,
              createdAt: new Date(),
              concludedAt: null,
            };

            let completedRound: number | null = null;
            let nextRound: number | null = null;
            const onRoundComplete = (completed: 1 | 2 | 3, next: 1 | 2 | 3 | null) => {
              completedRound = completed;
              nextRound = next;
            };

            const { rerender } = render(
              <RoundSection
                debate={debate}
                rounds={initialRounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
                onRoundComplete={onRoundComplete}
              />
            );

            // Simulate round 1 completing
            const updatedRounds: Round[] = [
              {
                ...initialRounds[0],
                completedAt: new Date(), // Now completed
              },
              initialRounds[1],
              initialRounds[2],
            ];

            rerender(
              <RoundSection
                debate={debate}
                rounds={updatedRounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
                onRoundComplete={onRoundComplete}
              />
            );

            // onRoundComplete should have been called with round 1 and next round 2
            expect(completedRound).toBe(1);
            expect(nextRound).toBe(2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * Property-based tests for round completion transitions.
 * 
 * Feature: unified-round-section, Property 8: Round Completion Triggers Transition
 * Validates: Requirements 7.3, 7.5
 */
describe('RoundSection Property Tests - Round Completion Triggers Transition', () => {
  // Generate user for debater info
  const userArb: fc.Arbitrary<User> = fc.record({
    id: fc.uuid(),
    authUserId: fc.option(fc.uuid(), { nil: null }),
    username: fc.string({ minLength: 1, maxLength: 50 }),
    email: fc.emailAddress(),
    reputationScore: fc.integer({ min: 0, max: 1000 }),
    predictionAccuracy: fc.float({ min: 0, max: 1 }),
    debatesParticipated: fc.integer({ min: 0, max: 100 }),
    sandboxCompleted: fc.boolean(),
    createdAt: fc.date(),
  });

  // Generate argument for testing
  const argumentArb: fc.Arbitrary<Argument> = fc.record({
    id: fc.uuid(),
    roundId: fc.uuid(),
    debaterId: fc.uuid(),
    side: fc.constantFrom('support', 'oppose') as fc.Arbitrary<'support' | 'oppose'>,
    content: fc.string({ minLength: 1, maxLength: 500 }),
    impactScore: fc.integer({ min: 0, max: 100 }),
    createdAt: fc.date(),
  });

  /**
   * Property 8: Round Completion Triggers Transition
   * For any round where both arguments are submitted (round.completedAt becomes non-null):
   * - The newly submitted argument is immediately displayed
   * - If viewing the completing round, viewedRound advances to the next round (if not final)
   * - If final round completes, viewedRound remains on Closing
   * 
   * Validates: Requirements 7.3, 7.5
   */
  describe('Round completion triggers transition', () => {
    it('Property 8.1: When Round 1 completes while viewing it, viewedRound advances to Round 2 (Requirement 7.5)', () => {
      fc.assert(
        fc.property(
          sideArb,
          userArb,
          userArb,
          argumentArb,
          argumentArb,
          (currentTurn, supportDebater, opposeDebater, supportArg, opposeArg) => {
            // Start with Round 1 active, not completed
            const initialRounds: Round[] = [
              {
                id: 'round-1',
                debateId: 'test-debate',
                roundNumber: 1,
                roundType: 'opening',
                supportArgumentId: supportArg.id,
                opposeArgumentId: opposeArg.id,
                completedAt: null, // Not completed yet
              },
              {
                id: 'round-2',
                debateId: 'test-debate',
                roundNumber: 2,
                roundType: 'rebuttal',
                supportArgumentId: null,
                opposeArgumentId: null,
                completedAt: null,
              },
              {
                id: 'round-3',
                debateId: 'test-debate',
                roundNumber: 3,
                roundType: 'closing',
                supportArgumentId: null,
                opposeArgumentId: null,
                completedAt: null,
              },
            ];

            const debate: Debate = {
              id: 'test-debate',
              resolution: 'Test resolution',
              status: 'active',
              currentRound: 1,
              currentTurn,
              supportDebaterId: supportDebater.id,
              opposeDebaterId: opposeDebater.id,
              createdAt: new Date(),
              concludedAt: null,
            };

            const { container, rerender } = render(
              <RoundSection
                debate={debate}
                rounds={initialRounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
              />
            );

            // Verify we're viewing Round 1
            expect(container.querySelector('[data-round="1"]')).not.toBeNull();

            // Simulate Round 1 completing (both arguments submitted)
            const completedRounds: Round[] = [
              {
                ...initialRounds[0],
                completedAt: new Date(), // Now completed
              },
              initialRounds[1],
              initialRounds[2],
            ];

            rerender(
              <RoundSection
                debate={debate}
                rounds={completedRounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
              />
            );

            // viewedRound should advance to Round 2
            expect(container.querySelector('[data-round="2"]')).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8.2: When Round 2 completes while viewing it, viewedRound advances to Round 3 (Requirement 7.5)', () => {
      fc.assert(
        fc.property(
          sideArb,
          userArb,
          userArb,
          argumentArb,
          argumentArb,
          (currentTurn, supportDebater, opposeDebater, supportArg, opposeArg) => {
            // Start with Round 2 active, Round 1 completed
            const initialRounds: Round[] = [
              {
                id: 'round-1',
                debateId: 'test-debate',
                roundNumber: 1,
                roundType: 'opening',
                supportArgumentId: 'arg-1',
                opposeArgumentId: 'arg-2',
                completedAt: new Date(), // Completed
              },
              {
                id: 'round-2',
                debateId: 'test-debate',
                roundNumber: 2,
                roundType: 'rebuttal',
                supportArgumentId: supportArg.id,
                opposeArgumentId: opposeArg.id,
                completedAt: null, // Not completed yet
              },
              {
                id: 'round-3',
                debateId: 'test-debate',
                roundNumber: 3,
                roundType: 'closing',
                supportArgumentId: null,
                opposeArgumentId: null,
                completedAt: null,
              },
            ];

            const debate: Debate = {
              id: 'test-debate',
              resolution: 'Test resolution',
              status: 'active',
              currentRound: 2,
              currentTurn,
              supportDebaterId: supportDebater.id,
              opposeDebaterId: opposeDebater.id,
              createdAt: new Date(),
              concludedAt: null,
            };

            const { container, rerender } = render(
              <RoundSection
                debate={debate}
                rounds={initialRounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
              />
            );

            // Verify we're viewing Round 2
            expect(container.querySelector('[data-round="2"]')).not.toBeNull();

            // Simulate Round 2 completing (both arguments submitted)
            const completedRounds: Round[] = [
              initialRounds[0],
              {
                ...initialRounds[1],
                completedAt: new Date(), // Now completed
              },
              initialRounds[2],
            ];

            rerender(
              <RoundSection
                debate={debate}
                rounds={completedRounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
              />
            );

            // viewedRound should advance to Round 3
            expect(container.querySelector('[data-round="3"]')).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8.3: When final Round 3 completes, viewedRound remains on Closing (Requirement 7.5)', () => {
      fc.assert(
        fc.property(
          sideArb,
          userArb,
          userArb,
          argumentArb,
          argumentArb,
          (currentTurn, supportDebater, opposeDebater, supportArg, opposeArg) => {
            // Start with Round 3 active, Rounds 1 and 2 completed
            const initialRounds: Round[] = [
              {
                id: 'round-1',
                debateId: 'test-debate',
                roundNumber: 1,
                roundType: 'opening',
                supportArgumentId: 'arg-1',
                opposeArgumentId: 'arg-2',
                completedAt: new Date(), // Completed
              },
              {
                id: 'round-2',
                debateId: 'test-debate',
                roundNumber: 2,
                roundType: 'rebuttal',
                supportArgumentId: 'arg-3',
                opposeArgumentId: 'arg-4',
                completedAt: new Date(), // Completed
              },
              {
                id: 'round-3',
                debateId: 'test-debate',
                roundNumber: 3,
                roundType: 'closing',
                supportArgumentId: supportArg.id,
                opposeArgumentId: opposeArg.id,
                completedAt: null, // Not completed yet
              },
            ];

            const debate: Debate = {
              id: 'test-debate',
              resolution: 'Test resolution',
              status: 'active',
              currentRound: 3,
              currentTurn,
              supportDebaterId: supportDebater.id,
              opposeDebaterId: opposeDebater.id,
              createdAt: new Date(),
              concludedAt: null,
            };

            const { container, rerender } = render(
              <RoundSection
                debate={debate}
                rounds={initialRounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
              />
            );

            // Verify we're viewing Round 3
            expect(container.querySelector('[data-round="3"]')).not.toBeNull();

            // Simulate Round 3 completing (final round)
            const completedRounds: Round[] = [
              initialRounds[0],
              initialRounds[1],
              {
                ...initialRounds[2],
                completedAt: new Date(), // Now completed
              },
            ];

            rerender(
              <RoundSection
                debate={debate}
                rounds={completedRounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
              />
            );

            // viewedRound should remain on Round 3 (Closing) since it's the final round
            expect(container.querySelector('[data-round="3"]')).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8.4: Newly submitted argument is immediately displayed (Requirement 7.3)', () => {
      fc.assert(
        fc.property(
          sideArb,
          userArb,
          userArb,
          argumentArb,
          (_currentTurn, supportDebater, opposeDebater, newArgument) => {
            // Start with Round 1 active, support argument submitted
            const initialRounds: Round[] = [
              {
                id: 'round-1',
                debateId: 'test-debate',
                roundNumber: 1,
                roundType: 'opening',
                supportArgumentId: 'existing-arg',
                opposeArgumentId: null, // Oppose hasn't submitted yet
                completedAt: null,
              },
              {
                id: 'round-2',
                debateId: 'test-debate',
                roundNumber: 2,
                roundType: 'rebuttal',
                supportArgumentId: null,
                opposeArgumentId: null,
                completedAt: null,
              },
              {
                id: 'round-3',
                debateId: 'test-debate',
                roundNumber: 3,
                roundType: 'closing',
                supportArgumentId: null,
                opposeArgumentId: null,
                completedAt: null,
              },
            ];

            const debate: Debate = {
              id: 'test-debate',
              resolution: 'Test resolution',
              status: 'active',
              currentRound: 1,
              currentTurn: 'oppose', // Oppose's turn
              supportDebaterId: supportDebater.id,
              opposeDebaterId: opposeDebater.id,
              createdAt: new Date(),
              concludedAt: null,
            };

            const initialArgs = {
              1: {
                support: {
                  id: 'existing-arg',
                  roundId: 'round-1',
                  debaterId: supportDebater.id,
                  side: 'support' as const,
                  content: 'Support argument content',
                  impactScore: 0,
                  createdAt: new Date(),
                },
              },
            };

            const { container, rerender } = render(
              <RoundSection
                debate={debate}
                rounds={initialRounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
                arguments={initialArgs}
              />
            );

            // Verify support argument is displayed
            expect(container.textContent).toContain('Support argument content');

            // Simulate oppose argument being submitted (completing the round)
            const opposeArgument = {
              ...newArgument,
              id: 'new-oppose-arg',
              side: 'oppose' as const,
              content: 'Oppose argument content that was just submitted',
            };

            const updatedRounds: Round[] = [
              {
                ...initialRounds[0],
                opposeArgumentId: opposeArgument.id,
                completedAt: new Date(), // Round completes
              },
              initialRounds[1],
              initialRounds[2],
            ];

            const updatedArgs = {
              1: {
                support: initialArgs[1].support,
                oppose: opposeArgument,
              },
            };

            rerender(
              <RoundSection
                debate={debate}
                rounds={updatedRounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
                arguments={updatedArgs}
              />
            );

            // The newly submitted argument should be displayed
            // Note: After round completion, we auto-transition to Round 2, so we need to navigate back
            // to Round 1 to see the argument. But the argument data is available.
            // Let's verify by navigating back to Round 1 using CompactProgressBar round dots
            const roundDot1 = container.querySelector('[data-testid="round-dot-1"]');
            if (roundDot1) fireEvent.click(roundDot1);

            expect(container.textContent).toContain('Oppose argument content that was just submitted');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8.5: Round completion does NOT auto-transition when viewing a different round (Requirement 3.6)', () => {
      fc.assert(
        fc.property(
          sideArb,
          userArb,
          userArb,
          argumentArb,
          argumentArb,
          (currentTurn, supportDebater, opposeDebater, supportArg, opposeArg) => {
            // Start with Round 2 active, Round 1 completed
            const initialRounds: Round[] = [
              {
                id: 'round-1',
                debateId: 'test-debate',
                roundNumber: 1,
                roundType: 'opening',
                supportArgumentId: 'arg-1',
                opposeArgumentId: 'arg-2',
                completedAt: new Date(), // Completed
              },
              {
                id: 'round-2',
                debateId: 'test-debate',
                roundNumber: 2,
                roundType: 'rebuttal',
                supportArgumentId: supportArg.id,
                opposeArgumentId: opposeArg.id,
                completedAt: null, // Not completed yet
              },
              {
                id: 'round-3',
                debateId: 'test-debate',
                roundNumber: 3,
                roundType: 'closing',
                supportArgumentId: null,
                opposeArgumentId: null,
                completedAt: null,
              },
            ];

            const debate: Debate = {
              id: 'test-debate',
              resolution: 'Test resolution',
              status: 'active',
              currentRound: 2,
              currentTurn,
              supportDebaterId: supportDebater.id,
              opposeDebaterId: opposeDebater.id,
              createdAt: new Date(),
              concludedAt: null,
            };

            const { container, rerender } = render(
              <RoundSection
                debate={debate}
                rounds={initialRounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
              />
            );

            // Navigate to Round 1 (viewing history) using CompactProgressBar round dots
            const roundDot1 = container.querySelector('[data-testid="round-dot-1"]');
            if (roundDot1) fireEvent.click(roundDot1);

            // Verify we're viewing Round 1
            expect(container.querySelector('[data-round="1"]')).not.toBeNull();

            // Simulate Round 2 completing while user is viewing Round 1
            const completedRounds: Round[] = [
              initialRounds[0],
              {
                ...initialRounds[1],
                completedAt: new Date(), // Now completed
              },
              initialRounds[2],
            ];

            rerender(
              <RoundSection
                debate={debate}
                rounds={completedRounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
              />
            );

            // viewedRound should remain on Round 1 (user's viewing context preserved)
            expect(container.querySelector('[data-round="1"]')).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8.6: onRoundComplete callback receives correct round numbers', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(1, 2) as fc.Arbitrary<1 | 2>,
          sideArb,
          userArb,
          userArb,
          (completingRound, currentTurn, supportDebater, opposeDebater) => {
            // Create rounds where the specified round is about to complete
            const initialRounds: Round[] = [
              {
                id: 'round-1',
                debateId: 'test-debate',
                roundNumber: 1,
                roundType: 'opening',
                supportArgumentId: 'arg-1',
                opposeArgumentId: 'arg-2',
                completedAt: completingRound > 1 ? new Date() : null,
              },
              {
                id: 'round-2',
                debateId: 'test-debate',
                roundNumber: 2,
                roundType: 'rebuttal',
                supportArgumentId: completingRound >= 2 ? 'arg-3' : null,
                opposeArgumentId: completingRound >= 2 ? 'arg-4' : null,
                completedAt: null,
              },
              {
                id: 'round-3',
                debateId: 'test-debate',
                roundNumber: 3,
                roundType: 'closing',
                supportArgumentId: null,
                opposeArgumentId: null,
                completedAt: null,
              },
            ];

            const debate: Debate = {
              id: 'test-debate',
              resolution: 'Test resolution',
              status: 'active',
              currentRound: completingRound,
              currentTurn,
              supportDebaterId: supportDebater.id,
              opposeDebaterId: opposeDebater.id,
              createdAt: new Date(),
              concludedAt: null,
            };

            let receivedCompletedRound: number | null = null;
            let receivedNextRound: number | null = null;
            const onRoundComplete = (completed: 1 | 2 | 3, next: 1 | 2 | 3 | null) => {
              receivedCompletedRound = completed;
              receivedNextRound = next;
            };

            const { rerender } = render(
              <RoundSection
                debate={debate}
                rounds={initialRounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
                onRoundComplete={onRoundComplete}
              />
            );

            // Simulate the round completing
            const completedRounds = initialRounds.map((r, i) => {
              if (i + 1 === completingRound) {
                return { ...r, completedAt: new Date() };
              }
              return r;
            });

            rerender(
              <RoundSection
                debate={debate}
                rounds={completedRounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
                onRoundComplete={onRoundComplete}
              />
            );

            // Verify callback received correct values
            expect(receivedCompletedRound).toBe(completingRound);
            expect(receivedNextRound).toBe(completingRound < 3 ? completingRound + 1 : null);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8.7: Final round completion sets nextRound to null in callback', () => {
      fc.assert(
        fc.property(
          sideArb,
          userArb,
          userArb,
          (currentTurn, supportDebater, opposeDebater) => {
            // Round 3 is about to complete
            const initialRounds: Round[] = [
              {
                id: 'round-1',
                debateId: 'test-debate',
                roundNumber: 1,
                roundType: 'opening',
                supportArgumentId: 'arg-1',
                opposeArgumentId: 'arg-2',
                completedAt: new Date(),
              },
              {
                id: 'round-2',
                debateId: 'test-debate',
                roundNumber: 2,
                roundType: 'rebuttal',
                supportArgumentId: 'arg-3',
                opposeArgumentId: 'arg-4',
                completedAt: new Date(),
              },
              {
                id: 'round-3',
                debateId: 'test-debate',
                roundNumber: 3,
                roundType: 'closing',
                supportArgumentId: 'arg-5',
                opposeArgumentId: 'arg-6',
                completedAt: null, // About to complete
              },
            ];

            const debate: Debate = {
              id: 'test-debate',
              resolution: 'Test resolution',
              status: 'active',
              currentRound: 3,
              currentTurn,
              supportDebaterId: supportDebater.id,
              opposeDebaterId: opposeDebater.id,
              createdAt: new Date(),
              concludedAt: null,
            };

            let receivedNextRound: number | null = 999; // Use sentinel value
            const onRoundComplete = (_completed: 1 | 2 | 3, next: 1 | 2 | 3 | null) => {
              receivedNextRound = next;
            };

            const { rerender } = render(
              <RoundSection
                debate={debate}
                rounds={initialRounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
                onRoundComplete={onRoundComplete}
              />
            );

            // Simulate Round 3 completing
            const completedRounds: Round[] = [
              initialRounds[0],
              initialRounds[1],
              {
                ...initialRounds[2],
                completedAt: new Date(),
              },
            ];

            rerender(
              <RoundSection
                debate={debate}
                rounds={completedRounds}
                supportDebater={supportDebater}
                opposeDebater={opposeDebater}
                onRoundComplete={onRoundComplete}
              />
            );

            // nextRound should be null for final round
            expect(receivedNextRound).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

