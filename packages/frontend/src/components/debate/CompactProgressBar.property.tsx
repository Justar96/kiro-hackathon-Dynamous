/**
 * Property-based tests for CompactProgressBar component.
 * Validates: Requirements 1.2, 1.3, 2.3, 2.5, 4.1, 4.2
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, fireEvent, cleanup } from '@testing-library/react';
import {
  CompactProgressBar,
  deriveRoundDotState,
  isRoundNavigable,
  getCompactProgressText,
} from './CompactProgressBar';
import type { Round, RoundNumber, Side } from '@thesis/shared';

const roundNumberArb = fc.constantFrom(1, 2, 3) as fc.Arbitrary<RoundNumber>;
const debateStatusArb = fc.constantFrom('seeking_opponent', 'active', 'concluded') as fc.Arbitrary<'seeking_opponent' | 'active' | 'concluded'>;
const sideArb = fc.constantFrom('support', 'oppose') as fc.Arbitrary<Side>;

const roundArb = (roundNumber: RoundNumber): fc.Arbitrary<Round> => {
  const roundTypes: Record<RoundNumber, 'opening' | 'rebuttal' | 'closing'> = { 1: 'opening', 2: 'rebuttal', 3: 'closing' };
  return fc.record({
    id: fc.uuid(), debateId: fc.uuid(), roundNumber: fc.constant(roundNumber),
    roundType: fc.constant(roundTypes[roundNumber]),
    supportArgumentId: fc.option(fc.uuid(), { nil: null }),
    opposeArgumentId: fc.option(fc.uuid(), { nil: null }),
    completedAt: fc.option(fc.date(), { nil: null }),
  });
};

const roundsArb: fc.Arbitrary<Round[]> = fc.tuple(roundArb(1), roundArb(2), roundArb(3)).map(([r1, r2, r3]) => [r1, r2, r3]);

const roundsWithCompletedArb: fc.Arbitrary<Round[]> = fc.tuple(roundArb(1), roundArb(2), roundArb(3)).chain(([r1, r2, r3]) => {
  return fc.integer({ min: 0, max: 2 }).map(completedIndex => {
    const rounds = [r1, r2, r3];
    rounds[completedIndex] = { ...rounds[completedIndex], completedAt: new Date() };
    return rounds;
  });
});

describe('CompactProgressBar Property Tests', () => {
  describe('Property 1: Round Navigation Logic', () => {
    it('current round is always navigable', () => {
      fc.assert(fc.property(roundsArb, roundNumberArb, (rounds, currentRound) => {
        expect(isRoundNavigable(currentRound, rounds, currentRound)).toBe(true);
      }), { numRuns: 100 });
    });

    it('completed rounds are always navigable', () => {
      fc.assert(fc.property(roundsWithCompletedArb, roundNumberArb, (rounds, currentRound) => {
        for (let i = 0; i < 3; i++) {
          const roundNumber = (i + 1) as RoundNumber;
          if (rounds[i].completedAt !== null) {
            expect(isRoundNavigable(roundNumber, rounds, currentRound)).toBe(true);
          }
        }
      }), { numRuns: 100 });
    });
  });

  describe('Property 2: Disabled Dots Logic', () => {
    it('empty future rounds are not navigable', () => {
      fc.assert(fc.property(roundNumberArb, (currentRound) => {
        const rounds: Round[] = [1, 2, 3].map(num => ({
          id: 'round-' + num,
          debateId: 'debate-1',
          roundNumber: num as RoundNumber,
          roundType: (['opening', 'rebuttal', 'closing'] as const)[num - 1],
          supportArgumentId: null,
          opposeArgumentId: null,
          completedAt: null,
        }));
        for (let i = 0; i < 3; i++) {
          const roundNumber = (i + 1) as RoundNumber;
          if (roundNumber !== currentRound) {
            expect(isRoundNavigable(roundNumber, rounds, currentRound)).toBe(false);
          }
        }
      }), { numRuns: 100 });
    });
  });

  describe('Property 3: Completed Round Visual State', () => {
    it('completed rounds have completed or viewing state', () => {
      fc.assert(fc.property(roundsWithCompletedArb, roundNumberArb, roundNumberArb, (rounds, currentRound, viewedRound) => {
        for (let i = 0; i < 3; i++) {
          const roundNumber = (i + 1) as RoundNumber;
          if (rounds[i].completedAt !== null) {
            const state = deriveRoundDotState(roundNumber, rounds[i], currentRound, viewedRound, 'active');
            expect(['completed', 'viewing']).toContain(state);
          }
        }
      }), { numRuns: 100 });
    });
  });

  describe('Property 4: Progress Text Generation', () => {
    it('mobile text is shorter than desktop text', () => {
      fc.assert(fc.property(roundNumberArb, sideArb, debateStatusArb, (currentRound, currentTurn, debateStatus) => {
        const mobileText = getCompactProgressText(currentRound, currentTurn, debateStatus, true);
        const desktopText = getCompactProgressText(currentRound, currentTurn, debateStatus, false);
        expect(mobileText.length).toBeLessThanOrEqual(desktopText.length);
      }), { numRuns: 100 });
    });
  });
});

describe('deriveRoundDotState', () => {
  it('returns active for the current round', () => {
    const round: Round = { id: 'r1', debateId: 'd1', roundNumber: 1, roundType: 'opening', supportArgumentId: null, opposeArgumentId: null, completedAt: null };
    expect(deriveRoundDotState(1, round, 1, 1, 'active')).toBe('active');
  });

  it('returns pending for future rounds', () => {
    const round: Round = { id: 'r3', debateId: 'd1', roundNumber: 3, roundType: 'closing', supportArgumentId: null, opposeArgumentId: null, completedAt: null };
    expect(deriveRoundDotState(3, round, 1, 1, 'active')).toBe('pending');
  });
});

describe('isRoundNavigable', () => {
  it('returns true for the current round', () => {
    const rounds: Round[] = [1, 2, 3].map(num => ({
      id: 'r' + num,
      debateId: 'd1',
      roundNumber: num as RoundNumber,
      roundType: (['opening', 'rebuttal', 'closing'] as const)[num - 1],
      supportArgumentId: null,
      opposeArgumentId: null,
      completedAt: null
    }));
    expect(isRoundNavigable(1, rounds, 1)).toBe(true);
  });
});

describe('getCompactProgressText', () => {
  it('returns abbreviated text on mobile', () => {
    expect(getCompactProgressText(1, 'support', 'active', true)).toBe('R1 · Support');
  });

  it('returns full text on desktop', () => {
    expect(getCompactProgressText(1, 'support', 'active', false)).toBe("Round 1 · Support's turn");
  });
});

/**
 * Property 7: Mobile Abbreviated Text
 * For any debate state when rendered in a mobile viewport, the progress text should use
 * abbreviated format (e.g., "R1 · Support" instead of "Round 1 · Support's turn").
 * **Validates: Requirements 5.1**
 */
describe('Property 7: Mobile Abbreviated Text', () => {
  it('mobile text uses abbreviated format R{n} · {Side}', () => {
    fc.assert(fc.property(roundNumberArb, sideArb, (currentRound, currentTurn) => {
      const mobileText = getCompactProgressText(currentRound, currentTurn, 'active', true);
      const turnLabel = currentTurn === 'support' ? 'Support' : 'Oppose';
      const expectedFormat = `R${currentRound} · ${turnLabel}`;
      
      expect(mobileText).toBe(expectedFormat);
    }), { numRuns: 100 });
  });

  it('desktop text uses full format Round {n} · {Side}\'s turn', () => {
    fc.assert(fc.property(roundNumberArb, sideArb, (currentRound, currentTurn) => {
      const desktopText = getCompactProgressText(currentRound, currentTurn, 'active', false);
      const turnLabel = currentTurn === 'support' ? 'Support' : 'Oppose';
      const expectedFormat = `Round ${currentRound} · ${turnLabel}'s turn`;
      
      expect(desktopText).toBe(expectedFormat);
    }), { numRuns: 100 });
  });

  it('mobile text is always shorter than desktop text for active debates', () => {
    fc.assert(fc.property(roundNumberArb, sideArb, (currentRound, currentTurn) => {
      const mobileText = getCompactProgressText(currentRound, currentTurn, 'active', true);
      const desktopText = getCompactProgressText(currentRound, currentTurn, 'active', false);
      
      expect(mobileText.length).toBeLessThan(desktopText.length);
    }), { numRuns: 100 });
  });

  it('concluded debates show abbreviated text on mobile', () => {
    fc.assert(fc.property(roundNumberArb, sideArb, (currentRound, currentTurn) => {
      const mobileText = getCompactProgressText(currentRound, currentTurn, 'concluded', true);
      const desktopText = getCompactProgressText(currentRound, currentTurn, 'concluded', false);
      
      expect(mobileText).toBe('Concluded');
      expect(desktopText).toBe('Debate Concluded');
    }), { numRuns: 100 });
  });

  it('seeking opponent shows abbreviated text on mobile', () => {
    fc.assert(fc.property(roundNumberArb, sideArb, (currentRound, currentTurn) => {
      const mobileText = getCompactProgressText(currentRound, currentTurn, 'seeking_opponent', true);
      const desktopText = getCompactProgressText(currentRound, currentTurn, 'seeking_opponent', false);
      
      expect(mobileText).toBe('Seeking...');
      expect(desktopText).toBe('Seeking Opponent');
    }), { numRuns: 100 });
  });
});

/**
 * Property 5: Swipe Gesture Navigation
 * For any mobile viewport and any horizontal swipe gesture exceeding the threshold,
 * the system should navigate to the adjacent round if that round is navigable.
 * **Validates: Requirements 1.4, 5.4**
 */
describe('Property 5: Swipe Gesture Navigation', () => {
  afterEach(() => { cleanup(); });

  // Helper to create touch events
  const createTouchEvent = (type: string, clientX: number, clientY: number) => {
    return {
      touches: type === 'touchstart' ? [{ clientX, clientY }] : [],
      changedTouches: [{ clientX, clientY }],
    };
  };

  it('swipe left navigates to next navigable round', () => {
    fc.assert(fc.property(roundNumberArb, sideArb, (currentRound, currentTurn) => {
      cleanup();
      
      // Create rounds where current and next are navigable
      const rounds: Round[] = [1, 2, 3].map(num => ({
        id: 'r' + num,
        debateId: 'd1',
        roundNumber: num as RoundNumber,
        roundType: (['opening', 'rebuttal', 'closing'] as const)[num - 1],
        supportArgumentId: num <= currentRound ? 'a' + num : null,
        opposeArgumentId: num <= currentRound ? 'b' + num : null,
        completedAt: num < currentRound ? new Date() : null,
      }));
      
      const onRoundSelect = vi.fn();
      const { getByTestId } = render(
        <CompactProgressBar
          currentRound={currentRound}
          currentTurn={currentTurn}
          debateStatus="active"
          viewedRound={currentRound}
          rounds={rounds}
          onRoundSelect={onRoundSelect}
        />
      );

      const container = getByTestId('compact-progress-bar');
      
      // Simulate swipe left (negative deltaX > threshold)
      fireEvent.touchStart(container, createTouchEvent('touchstart', 200, 100));
      fireEvent.touchEnd(container, createTouchEvent('touchend', 100, 100)); // -100 deltaX
      
      // Should navigate to next round if navigable
      const nextRound = Math.min(currentRound + 1, 3) as RoundNumber;
      if (isRoundNavigable(nextRound, rounds, currentRound) && nextRound !== currentRound) {
        expect(onRoundSelect).toHaveBeenCalledWith(nextRound);
      }
      
      return true;
    }), { numRuns: 100 });
  });

  it('swipe right navigates to previous navigable round', () => {
    fc.assert(fc.property(roundNumberArb, sideArb, (currentRound, currentTurn) => {
      cleanup();
      
      // Create rounds where previous rounds are completed (navigable)
      const rounds: Round[] = [1, 2, 3].map(num => ({
        id: 'r' + num,
        debateId: 'd1',
        roundNumber: num as RoundNumber,
        roundType: (['opening', 'rebuttal', 'closing'] as const)[num - 1],
        supportArgumentId: num <= currentRound ? 'a' + num : null,
        opposeArgumentId: num <= currentRound ? 'b' + num : null,
        completedAt: num < currentRound ? new Date() : null,
      }));
      
      const onRoundSelect = vi.fn();
      const { getByTestId } = render(
        <CompactProgressBar
          currentRound={currentRound}
          currentTurn={currentTurn}
          debateStatus="active"
          viewedRound={currentRound}
          rounds={rounds}
          onRoundSelect={onRoundSelect}
        />
      );

      const container = getByTestId('compact-progress-bar');
      
      // Simulate swipe right (positive deltaX > threshold)
      fireEvent.touchStart(container, createTouchEvent('touchstart', 100, 100));
      fireEvent.touchEnd(container, createTouchEvent('touchend', 200, 100)); // +100 deltaX
      
      // Should navigate to previous round if navigable
      const prevRound = Math.max(currentRound - 1, 1) as RoundNumber;
      if (isRoundNavigable(prevRound, rounds, currentRound) && prevRound !== currentRound) {
        expect(onRoundSelect).toHaveBeenCalledWith(prevRound);
      }
      
      return true;
    }), { numRuns: 100 });
  });

  it('swipe below threshold does not navigate', () => {
    fc.assert(fc.property(roundNumberArb, sideArb, fc.integer({ min: 1, max: 49 }), (currentRound, currentTurn, swipeDistance) => {
      cleanup();
      
      const rounds: Round[] = [1, 2, 3].map(num => ({
        id: 'r' + num,
        debateId: 'd1',
        roundNumber: num as RoundNumber,
        roundType: (['opening', 'rebuttal', 'closing'] as const)[num - 1],
        supportArgumentId: 'a' + num,
        opposeArgumentId: 'b' + num,
        completedAt: new Date(),
      }));
      
      const onRoundSelect = vi.fn();
      const { getByTestId } = render(
        <CompactProgressBar
          currentRound={currentRound}
          currentTurn={currentTurn}
          debateStatus="active"
          viewedRound={currentRound}
          rounds={rounds}
          onRoundSelect={onRoundSelect}
        />
      );

      const container = getByTestId('compact-progress-bar');
      
      // Simulate swipe below threshold
      fireEvent.touchStart(container, createTouchEvent('touchstart', 100, 100));
      fireEvent.touchEnd(container, createTouchEvent('touchend', 100 + swipeDistance, 100));
      
      // Should not navigate
      expect(onRoundSelect).not.toHaveBeenCalled();
      
      return true;
    }), { numRuns: 100 });
  });

  it('vertical swipe does not trigger navigation', () => {
    fc.assert(fc.property(roundNumberArb, sideArb, (currentRound, currentTurn) => {
      cleanup();
      
      const rounds: Round[] = [1, 2, 3].map(num => ({
        id: 'r' + num,
        debateId: 'd1',
        roundNumber: num as RoundNumber,
        roundType: (['opening', 'rebuttal', 'closing'] as const)[num - 1],
        supportArgumentId: 'a' + num,
        opposeArgumentId: 'b' + num,
        completedAt: new Date(),
      }));
      
      const onRoundSelect = vi.fn();
      const { getByTestId } = render(
        <CompactProgressBar
          currentRound={currentRound}
          currentTurn={currentTurn}
          debateStatus="active"
          viewedRound={currentRound}
          rounds={rounds}
          onRoundSelect={onRoundSelect}
        />
      );

      const container = getByTestId('compact-progress-bar');
      
      // Simulate vertical swipe (deltaY > deltaX)
      fireEvent.touchStart(container, createTouchEvent('touchstart', 100, 100));
      fireEvent.touchEnd(container, createTouchEvent('touchend', 120, 250)); // deltaY=150 > deltaX=20
      
      // Should not navigate
      expect(onRoundSelect).not.toHaveBeenCalled();
      
      return true;
    }), { numRuns: 100 });
  });
});

/**
 * Property 6: Keyboard Navigation
 * For any focused progress bar state, pressing left/right arrow keys should navigate
 * to the previous/next navigable round respectively.
 * **Validates: Requirements 4.5**
 */
describe('Property 6: Keyboard Navigation', () => {
  afterEach(() => { cleanup(); });

  it('ArrowRight navigates to next navigable round', () => {
    fc.assert(fc.property(roundNumberArb, sideArb, (currentRound, currentTurn) => {
      cleanup();
      
      // Create rounds where all rounds up to current are completed
      const rounds: Round[] = [1, 2, 3].map(num => ({
        id: 'r' + num,
        debateId: 'd1',
        roundNumber: num as RoundNumber,
        roundType: (['opening', 'rebuttal', 'closing'] as const)[num - 1],
        supportArgumentId: num <= currentRound ? 'a' + num : null,
        opposeArgumentId: num <= currentRound ? 'b' + num : null,
        completedAt: num < currentRound ? new Date() : null,
      }));
      
      const onRoundSelect = vi.fn();
      const viewedRound = 1 as RoundNumber; // Start at round 1
      
      const { getByTestId } = render(
        <CompactProgressBar
          currentRound={currentRound}
          currentTurn={currentTurn}
          debateStatus="active"
          viewedRound={viewedRound}
          rounds={rounds}
          onRoundSelect={onRoundSelect}
        />
      );

      const container = getByTestId('compact-progress-bar');
      
      // Press ArrowRight
      fireEvent.keyDown(container, { key: 'ArrowRight' });
      
      // Find next navigable round
      let expectedNextRound: RoundNumber | null = null;
      for (let r = viewedRound + 1; r <= 3; r++) {
        const roundNum = r as RoundNumber;
        if (isRoundNavigable(roundNum, rounds, currentRound)) {
          expectedNextRound = roundNum;
          break;
        }
      }
      
      if (expectedNextRound) {
        expect(onRoundSelect).toHaveBeenCalledWith(expectedNextRound);
      } else {
        expect(onRoundSelect).not.toHaveBeenCalled();
      }
      
      return true;
    }), { numRuns: 100 });
  });

  it('ArrowLeft navigates to previous navigable round', () => {
    fc.assert(fc.property(roundNumberArb, sideArb, (currentRound, currentTurn) => {
      cleanup();
      
      // Create rounds where all rounds up to current are completed
      const rounds: Round[] = [1, 2, 3].map(num => ({
        id: 'r' + num,
        debateId: 'd1',
        roundNumber: num as RoundNumber,
        roundType: (['opening', 'rebuttal', 'closing'] as const)[num - 1],
        supportArgumentId: num <= currentRound ? 'a' + num : null,
        opposeArgumentId: num <= currentRound ? 'b' + num : null,
        completedAt: num < currentRound ? new Date() : null,
      }));
      
      const onRoundSelect = vi.fn();
      const viewedRound = currentRound; // Start at current round
      
      const { getByTestId } = render(
        <CompactProgressBar
          currentRound={currentRound}
          currentTurn={currentTurn}
          debateStatus="active"
          viewedRound={viewedRound}
          rounds={rounds}
          onRoundSelect={onRoundSelect}
        />
      );

      const container = getByTestId('compact-progress-bar');
      
      // Press ArrowLeft
      fireEvent.keyDown(container, { key: 'ArrowLeft' });
      
      // Find previous navigable round
      let expectedPrevRound: RoundNumber | null = null;
      for (let r = viewedRound - 1; r >= 1; r--) {
        const roundNum = r as RoundNumber;
        if (isRoundNavigable(roundNum, rounds, currentRound)) {
          expectedPrevRound = roundNum;
          break;
        }
      }
      
      if (expectedPrevRound) {
        expect(onRoundSelect).toHaveBeenCalledWith(expectedPrevRound);
      } else {
        expect(onRoundSelect).not.toHaveBeenCalled();
      }
      
      return true;
    }), { numRuns: 100 });
  });

  it('Home key navigates to first navigable round', () => {
    fc.assert(fc.property(roundNumberArb, sideArb, (currentRound, currentTurn) => {
      cleanup();
      
      // Create rounds where all rounds up to current are completed
      const rounds: Round[] = [1, 2, 3].map(num => ({
        id: 'r' + num,
        debateId: 'd1',
        roundNumber: num as RoundNumber,
        roundType: (['opening', 'rebuttal', 'closing'] as const)[num - 1],
        supportArgumentId: num <= currentRound ? 'a' + num : null,
        opposeArgumentId: num <= currentRound ? 'b' + num : null,
        completedAt: num < currentRound ? new Date() : null,
      }));
      
      const onRoundSelect = vi.fn();
      const viewedRound = currentRound; // Start at current round
      
      const { getByTestId } = render(
        <CompactProgressBar
          currentRound={currentRound}
          currentTurn={currentTurn}
          debateStatus="active"
          viewedRound={viewedRound}
          rounds={rounds}
          onRoundSelect={onRoundSelect}
        />
      );

      const container = getByTestId('compact-progress-bar');
      
      // Press Home
      fireEvent.keyDown(container, { key: 'Home' });
      
      // Find first navigable round
      let expectedFirstRound: RoundNumber | null = null;
      for (let r = 1; r <= 3; r++) {
        const roundNum = r as RoundNumber;
        if (isRoundNavigable(roundNum, rounds, currentRound)) {
          expectedFirstRound = roundNum;
          break;
        }
      }
      
      if (expectedFirstRound) {
        expect(onRoundSelect).toHaveBeenCalledWith(expectedFirstRound);
      }
      
      return true;
    }), { numRuns: 100 });
  });

  it('End key navigates to last navigable round', () => {
    fc.assert(fc.property(roundNumberArb, sideArb, (currentRound, currentTurn) => {
      cleanup();
      
      // Create rounds where all rounds up to current are completed
      const rounds: Round[] = [1, 2, 3].map(num => ({
        id: 'r' + num,
        debateId: 'd1',
        roundNumber: num as RoundNumber,
        roundType: (['opening', 'rebuttal', 'closing'] as const)[num - 1],
        supportArgumentId: num <= currentRound ? 'a' + num : null,
        opposeArgumentId: num <= currentRound ? 'b' + num : null,
        completedAt: num < currentRound ? new Date() : null,
      }));
      
      const onRoundSelect = vi.fn();
      const viewedRound = 1 as RoundNumber; // Start at round 1
      
      const { getByTestId } = render(
        <CompactProgressBar
          currentRound={currentRound}
          currentTurn={currentTurn}
          debateStatus="active"
          viewedRound={viewedRound}
          rounds={rounds}
          onRoundSelect={onRoundSelect}
        />
      );

      const container = getByTestId('compact-progress-bar');
      
      // Press End
      fireEvent.keyDown(container, { key: 'End' });
      
      // Find last navigable round
      let expectedLastRound: RoundNumber | null = null;
      for (let r = 3; r >= 1; r--) {
        const roundNum = r as RoundNumber;
        if (isRoundNavigable(roundNum, rounds, currentRound)) {
          expectedLastRound = roundNum;
          break;
        }
      }
      
      if (expectedLastRound) {
        expect(onRoundSelect).toHaveBeenCalledWith(expectedLastRound);
      }
      
      return true;
    }), { numRuns: 100 });
  });

  it('non-navigation keys do not trigger navigation', () => {
    fc.assert(fc.property(roundNumberArb, sideArb, fc.constantFrom('a', 'b', 'Enter', 'Space', 'Tab'), (currentRound, currentTurn, key) => {
      cleanup();
      
      const rounds: Round[] = [1, 2, 3].map(num => ({
        id: 'r' + num,
        debateId: 'd1',
        roundNumber: num as RoundNumber,
        roundType: (['opening', 'rebuttal', 'closing'] as const)[num - 1],
        supportArgumentId: 'a' + num,
        opposeArgumentId: 'b' + num,
        completedAt: new Date(),
      }));
      
      const onRoundSelect = vi.fn();
      
      const { getByTestId } = render(
        <CompactProgressBar
          currentRound={currentRound}
          currentTurn={currentTurn}
          debateStatus="active"
          viewedRound={currentRound}
          rounds={rounds}
          onRoundSelect={onRoundSelect}
        />
      );

      const container = getByTestId('compact-progress-bar');
      
      // Press non-navigation key
      fireEvent.keyDown(container, { key });
      
      // Should not navigate
      expect(onRoundSelect).not.toHaveBeenCalled();
      
      return true;
    }), { numRuns: 100 });
  });
});

describe('CompactProgressBar Component', () => {
  afterEach(() => { cleanup(); });

  it('renders all three round dots', () => {
    const rounds: Round[] = [1, 2, 3].map(num => ({
      id: 'r' + num,
      debateId: 'd1',
      roundNumber: num as RoundNumber,
      roundType: (['opening', 'rebuttal', 'closing'] as const)[num - 1],
      supportArgumentId: null,
      opposeArgumentId: null,
      completedAt: null
    }));
    const { getAllByTestId } = render(
      <CompactProgressBar currentRound={1} currentTurn="support" debateStatus="active"
        viewedRound={1} rounds={rounds} onRoundSelect={() => {}} />
    );
    expect(getAllByTestId(/^round-dot-/)).toHaveLength(3);
  });

  it('calls onRoundSelect when clicking navigable dot', () => {
    const onRoundSelect = vi.fn();
    const rounds: Round[] = [1, 2, 3].map(num => ({
      id: 'r' + num,
      debateId: 'd1',
      roundNumber: num as RoundNumber,
      roundType: (['opening', 'rebuttal', 'closing'] as const)[num - 1],
      supportArgumentId: num === 1 ? 'a1' : null,
      opposeArgumentId: num === 1 ? 'a2' : null,
      completedAt: num === 1 ? new Date() : null
    }));
    const { getByTestId } = render(
      <CompactProgressBar currentRound={2} currentTurn="support" debateStatus="active"
        viewedRound={2} rounds={rounds} onRoundSelect={onRoundSelect} />
    );
    fireEvent.click(getByTestId('round-dot-1'));
    expect(onRoundSelect).toHaveBeenCalledWith(1);
  });

  /**
   * Property 1: Round Dot Click Navigation
   * For any debate state and any round that is navigable (current round or completed),
   * clicking that round's dot should update the viewed round to match the clicked round.
   * **Validates: Requirements 1.2, 1.3, 2.3, 4.1**
   */
  it('clicking navigable round dots calls onRoundSelect with correct round number', () => {
    fc.assert(fc.property(roundsArb, roundNumberArb, sideArb, (rounds, currentRound, currentTurn) => {
      // Clean up DOM before each iteration to prevent multiple elements
      cleanup();
      
      const onRoundSelect = vi.fn();
      const { getByTestId } = render(
        <CompactProgressBar
          currentRound={currentRound}
          currentTurn={currentTurn}
          debateStatus="active"
          viewedRound={currentRound}
          rounds={rounds}
          onRoundSelect={onRoundSelect}
        />
      );

      // Test clicking each navigable round
      for (let i = 1; i <= 3; i++) {
        const roundNumber = i as RoundNumber;
        const navigable = isRoundNavigable(roundNumber, rounds, currentRound);
        
        if (navigable) {
          onRoundSelect.mockClear();
          fireEvent.click(getByTestId(`round-dot-${roundNumber}`));
          expect(onRoundSelect).toHaveBeenCalledWith(roundNumber);
        }
      }
      
      return true;
    }), { numRuns: 100 });
  });

  /**
   * Property 4: History Viewing Indicator
   * For any state where viewedRound differs from currentRound and the viewed round is completed,
   * the system should display a history viewing indicator.
   * **Validates: Requirements 2.6**
   */
  it('displays history indicator when viewing a completed round that is not the current round', () => {
    fc.assert(fc.property(roundNumberArb, roundNumberArb, sideArb, (currentRound, viewedRound, currentTurn) => {
      cleanup();
      
      // Create rounds where the viewed round is completed
      const rounds: Round[] = [1, 2, 3].map(num => ({
        id: 'r' + num,
        debateId: 'd1',
        roundNumber: num as RoundNumber,
        roundType: (['opening', 'rebuttal', 'closing'] as const)[num - 1],
        supportArgumentId: num <= viewedRound ? 'a' + num : null,
        opposeArgumentId: num <= viewedRound ? 'b' + num : null,
        completedAt: num < currentRound ? new Date() : null,
      }));
      
      const { queryByTestId } = render(
        <CompactProgressBar
          currentRound={currentRound}
          currentTurn={currentTurn}
          debateStatus="active"
          viewedRound={viewedRound}
          rounds={rounds}
          onRoundSelect={() => {}}
        />
      );

      const historyIndicator = queryByTestId('history-indicator');
      const isViewingHistory = viewedRound !== currentRound && rounds[viewedRound - 1]?.completedAt !== null;
      
      if (isViewingHistory) {
        expect(historyIndicator).not.toBeNull();
      } else {
        expect(historyIndicator).toBeNull();
      }
      
      return true;
    }), { numRuns: 100 });
  });

  /**
   * Property 8: User Turn Highlighting
   * For any active debate where isUserTurn is true, the progress bar should display
   * prominent turn highlighting.
   * **Validates: Requirements 6.1**
   */
  it('displays turn indicator when it is the user turn in an active debate', () => {
    fc.assert(fc.property(roundNumberArb, sideArb, fc.boolean(), (currentRound, currentTurn, isUserTurn) => {
      cleanup();
      
      const rounds: Round[] = [1, 2, 3].map(num => ({
        id: 'r' + num,
        debateId: 'd1',
        roundNumber: num as RoundNumber,
        roundType: (['opening', 'rebuttal', 'closing'] as const)[num - 1],
        supportArgumentId: null,
        opposeArgumentId: null,
        completedAt: null,
      }));
      
      const { queryByTestId, getByTestId } = render(
        <CompactProgressBar
          currentRound={currentRound}
          currentTurn={currentTurn}
          debateStatus="active"
          viewedRound={currentRound}
          rounds={rounds}
          isUserTurn={isUserTurn}
          onRoundSelect={() => {}}
        />
      );

      const turnIndicator = queryByTestId('turn-indicator');
      const progressText = getByTestId('progress-text');
      
      if (isUserTurn) {
        // Turn indicator should be visible
        expect(turnIndicator).not.toBeNull();
        // Progress text should have user-turn data attribute
        expect(progressText.getAttribute('data-user-turn')).toBe('true');
      } else {
        // Turn indicator should not be visible
        expect(turnIndicator).toBeNull();
        // Progress text should not have user-turn styling
        expect(progressText.getAttribute('data-user-turn')).toBe('false');
      }
      
      return true;
    }), { numRuns: 100 });
  });
});

/**
 * Property 9: Submission CTA Visibility
 * For any state where the user can submit an argument (correct side, their turn, active round,
 * no existing argument), a clear call-to-action should be visible.
 * **Validates: Requirements 6.3**
 */
describe('Property 9: Submission CTA Visibility', () => {
  afterEach(() => { cleanup(); });

  it('displays submission CTA when canSubmitArgument is true and viewing active round', () => {
    fc.assert(fc.property(roundNumberArb, sideArb, fc.boolean(), (currentRound, currentTurn, canSubmitArgument) => {
      cleanup();
      
      const rounds: Round[] = [1, 2, 3].map(num => ({
        id: 'r' + num,
        debateId: 'd1',
        roundNumber: num as RoundNumber,
        roundType: (['opening', 'rebuttal', 'closing'] as const)[num - 1],
        supportArgumentId: null,
        opposeArgumentId: null,
        completedAt: null,
      }));
      
      const onSubmitClick = vi.fn();
      const { queryByTestId } = render(
        <CompactProgressBar
          currentRound={currentRound}
          currentTurn={currentTurn}
          debateStatus="active"
          viewedRound={currentRound}
          rounds={rounds}
          isUserTurn={canSubmitArgument}
          canSubmitArgument={canSubmitArgument}
          onRoundSelect={() => {}}
          onSubmitClick={onSubmitClick}
        />
      );

      const submissionCta = queryByTestId('submission-cta');
      
      if (canSubmitArgument) {
        // CTA should be visible when user can submit
        expect(submissionCta).not.toBeNull();
      } else {
        // CTA should not be visible when user cannot submit
        expect(submissionCta).toBeNull();
      }
      
      return true;
    }), { numRuns: 100 });
  });

  it('submission CTA is not visible when viewing history', () => {
    fc.assert(fc.property(roundNumberArb, sideArb, (_currentRound, currentTurn) => {
      cleanup();
      
      // Create rounds where round 1 is completed
      const rounds: Round[] = [1, 2, 3].map(num => ({
        id: 'r' + num,
        debateId: 'd1',
        roundNumber: num as RoundNumber,
        roundType: (['opening', 'rebuttal', 'closing'] as const)[num - 1],
        supportArgumentId: num === 1 ? 'a1' : null,
        opposeArgumentId: num === 1 ? 'b1' : null,
        completedAt: num === 1 ? new Date() : null,
      }));
      
      // View round 1 (history) while current round is 2
      const viewedRound = 1 as RoundNumber;
      const activeRound = 2 as RoundNumber;
      
      const { queryByTestId } = render(
        <CompactProgressBar
          currentRound={activeRound}
          currentTurn={currentTurn}
          debateStatus="active"
          viewedRound={viewedRound}
          rounds={rounds}
          isUserTurn={true}
          canSubmitArgument={true}
          onRoundSelect={() => {}}
          onSubmitClick={() => {}}
        />
      );

      const submissionCta = queryByTestId('submission-cta');
      
      // CTA should not be visible when viewing history
      expect(submissionCta).toBeNull();
      
      return true;
    }), { numRuns: 100 });
  });

  it('submission CTA calls onSubmitClick when clicked', () => {
    fc.assert(fc.property(roundNumberArb, sideArb, (currentRound, currentTurn) => {
      cleanup();
      
      const rounds: Round[] = [1, 2, 3].map(num => ({
        id: 'r' + num,
        debateId: 'd1',
        roundNumber: num as RoundNumber,
        roundType: (['opening', 'rebuttal', 'closing'] as const)[num - 1],
        supportArgumentId: null,
        opposeArgumentId: null,
        completedAt: null,
      }));
      
      const onSubmitClick = vi.fn();
      const { getByTestId } = render(
        <CompactProgressBar
          currentRound={currentRound}
          currentTurn={currentTurn}
          debateStatus="active"
          viewedRound={currentRound}
          rounds={rounds}
          isUserTurn={true}
          canSubmitArgument={true}
          onRoundSelect={() => {}}
          onSubmitClick={onSubmitClick}
        />
      );

      const submissionCta = getByTestId('submission-cta');
      fireEvent.click(submissionCta);
      
      expect(onSubmitClick).toHaveBeenCalledTimes(1);
      
      return true;
    }), { numRuns: 100 });
  });
});

/**
 * Property 10: Concluded Debate Outcome Display
 * For any debate with status 'concluded', the system should prominently display the debate outcome.
 * **Validates: Requirements 6.5**
 */
describe('Property 10: Concluded Debate Outcome Display', () => {
  afterEach(() => { cleanup(); });

  const winnerSideArb = fc.constantFrom('support', 'oppose', 'tie') as fc.Arbitrary<'support' | 'oppose' | 'tie'>;

  it('displays outcome indicator when debate is concluded with a winner', () => {
    fc.assert(fc.property(roundNumberArb, sideArb, winnerSideArb, (currentRound, currentTurn, winnerSide) => {
      cleanup();
      
      const rounds: Round[] = [1, 2, 3].map(num => ({
        id: 'r' + num,
        debateId: 'd1',
        roundNumber: num as RoundNumber,
        roundType: (['opening', 'rebuttal', 'closing'] as const)[num - 1],
        supportArgumentId: 'a' + num,
        opposeArgumentId: 'b' + num,
        completedAt: new Date(),
      }));
      
      const { queryByTestId } = render(
        <CompactProgressBar
          currentRound={currentRound}
          currentTurn={currentTurn}
          debateStatus="concluded"
          viewedRound={3}
          rounds={rounds}
          winnerSide={winnerSide}
          onRoundSelect={() => {}}
        />
      );

      const outcomeIndicator = queryByTestId('outcome-indicator');
      
      // Outcome indicator should be visible for concluded debates
      expect(outcomeIndicator).not.toBeNull();
      
      // Verify correct content based on winner
      if (winnerSide === 'support') {
        expect(outcomeIndicator?.textContent).toContain('Support');
      } else if (winnerSide === 'oppose') {
        expect(outcomeIndicator?.textContent).toContain('Oppose');
      } else {
        expect(outcomeIndicator?.textContent).toContain('Tie');
      }
      
      return true;
    }), { numRuns: 100 });
  });

  it('does not display outcome indicator when debate is active', () => {
    fc.assert(fc.property(roundNumberArb, sideArb, winnerSideArb, (currentRound, currentTurn, winnerSide) => {
      cleanup();
      
      const rounds: Round[] = [1, 2, 3].map(num => ({
        id: 'r' + num,
        debateId: 'd1',
        roundNumber: num as RoundNumber,
        roundType: (['opening', 'rebuttal', 'closing'] as const)[num - 1],
        supportArgumentId: null,
        opposeArgumentId: null,
        completedAt: null,
      }));
      
      const { queryByTestId } = render(
        <CompactProgressBar
          currentRound={currentRound}
          currentTurn={currentTurn}
          debateStatus="active"
          viewedRound={currentRound}
          rounds={rounds}
          winnerSide={winnerSide}
          onRoundSelect={() => {}}
        />
      );

      const outcomeIndicator = queryByTestId('outcome-indicator');
      
      // Outcome indicator should not be visible for active debates
      expect(outcomeIndicator).toBeNull();
      
      return true;
    }), { numRuns: 100 });
  });

  it('progress text shows winner information when concluded', () => {
    fc.assert(fc.property(roundNumberArb, sideArb, winnerSideArb, fc.boolean(), (currentRound, currentTurn, winnerSide, isMobile) => {
      const progressText = getCompactProgressText(currentRound, currentTurn, 'concluded', isMobile, winnerSide);
      
      if (winnerSide === 'support') {
        expect(progressText).toContain('Support');
        expect(progressText).toContain('Won');
      } else if (winnerSide === 'oppose') {
        expect(progressText).toContain('Oppose');
        expect(progressText).toContain('Won');
      } else {
        expect(progressText).toContain('Tie');
      }
      
      return true;
    }), { numRuns: 100 });
  });

  it('progress text is shorter on mobile for concluded debates', () => {
    fc.assert(fc.property(roundNumberArb, sideArb, winnerSideArb, (currentRound, currentTurn, winnerSide) => {
      const mobileText = getCompactProgressText(currentRound, currentTurn, 'concluded', true, winnerSide);
      const desktopText = getCompactProgressText(currentRound, currentTurn, 'concluded', false, winnerSide);
      
      expect(mobileText.length).toBeLessThanOrEqual(desktopText.length);
      
      return true;
    }), { numRuns: 100 });
  });
});