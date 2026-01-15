/**
 * Property-based tests for CompactDebateCard component.
 * 
 * Feature: reddit-style-feed, Property 3: Debate Card Data Display
 * Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6, 2.8
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { render } from '@testing-library/react';
import { CompactDebateCard, CARD_CONFIG } from './CompactDebateCard';
import type { Debate, MarketPrice } from '@thesis/shared';

// Mock TanStack Router's Link component
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string; [key: string]: unknown }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

// Mock the usePrefetch hook - must match the actual import path
vi.mock('../../lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib')>();
  return {
    ...actual,
    useDebateLinkPrefetch: () => ({}),
  };
});

// Arbitraries for generating test data
const roundNumberArb = fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>;
const debateStatusArb = fc.constantFrom('active', 'concluded') as fc.Arbitrary<'active' | 'concluded'>;
const sideArb = fc.constantFrom('support', 'oppose') as fc.Arbitrary<'support' | 'oppose'>;

// Generate a valid debate
const debateArb: fc.Arbitrary<Debate> = fc.record({
  id: fc.uuid(),
  resolution: fc.string({ minLength: 1, maxLength: 500 }),
  status: debateStatusArb,
  currentRound: roundNumberArb,
  currentTurn: sideArb,
  supportDebaterId: fc.uuid(),
  opposeDebaterId: fc.option(fc.uuid(), { nil: null }),
  createdAt: fc.date(),
  concludedAt: fc.option(fc.date(), { nil: null }),
});

// Generate market price data
const marketPriceArb: fc.Arbitrary<MarketPrice> = fc.record({
  supportPrice: fc.integer({ min: 0, max: 100 }),
  opposePrice: fc.integer({ min: 0, max: 100 }),
  totalVotes: fc.integer({ min: 0, max: 10000 }),
  mindChangeCount: fc.integer({ min: 0, max: 1000 }),
});

describe('CompactDebateCard Property Tests - Debate Card Data Display', () => {
  /**
   * Property 3: Debate Card Data Display
   * For any debate with market price data, the CompactDebateCard SHALL:
   * - Display support/oppose bar with widths matching the percentage values
   * - Display mind change count when count > 0
   * - Display correct status badge based on debate.status and opposeDebaterId
   * - Display round information for active debates
   * - Show pulsing indicator when debate.status === 'active'
   * - Render sparkline SVG with data points
   * 
   * Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6, 2.8
   */

  it('Property 3.1: Support/oppose bar widths match percentage values (Requirement 2.2)', () => {
    fc.assert(
      fc.property(debateArb, marketPriceArb, (debate, marketPrice) => {
        const { container } = render(
          <CompactDebateCard debate={debate} marketPrice={marketPrice} />
        );

        const supportBar = container.querySelector('[data-testid="support-bar"]');
        const opposeBar = container.querySelector('[data-testid="oppose-bar"]');

        expect(supportBar).not.toBeNull();
        expect(opposeBar).not.toBeNull();

        // Check that the widths are set correctly
        const supportWidth = supportBar?.getAttribute('style');
        const opposeWidth = opposeBar?.getAttribute('style');

        expect(supportWidth).toContain(`width: ${marketPrice.supportPrice}%`);
        expect(opposeWidth).toContain(`width: ${marketPrice.opposePrice}%`);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 3.2: Mind change delta is displayed when count > 0 (Requirement 2.3)', () => {
    fc.assert(
      fc.property(
        debateArb,
        fc.record({
          supportPrice: fc.integer({ min: 0, max: 100 }),
          opposePrice: fc.integer({ min: 0, max: 100 }),
          totalVotes: fc.integer({ min: 0, max: 10000 }),
          mindChangeCount: fc.integer({ min: 1, max: 1000 }), // Always > 0
        }),
        (debate, marketPrice) => {
          const { container } = render(
            <CompactDebateCard debate={debate} marketPrice={marketPrice} />
          );

          const mindChangeDelta = container.querySelector('[data-testid="mind-change-delta"]');
          expect(mindChangeDelta).not.toBeNull();
          expect(mindChangeDelta?.textContent).toContain(String(marketPrice.mindChangeCount));
          expect(mindChangeDelta?.textContent).toContain('Δ');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.3: Mind change delta is NOT displayed when count is 0 (Requirement 2.3)', () => {
    fc.assert(
      fc.property(
        debateArb,
        fc.record({
          supportPrice: fc.integer({ min: 0, max: 100 }),
          opposePrice: fc.integer({ min: 0, max: 100 }),
          totalVotes: fc.integer({ min: 0, max: 10000 }),
          mindChangeCount: fc.constant(0),
        }),
        (debate, marketPrice) => {
          const { container } = render(
            <CompactDebateCard debate={debate} marketPrice={marketPrice} />
          );

          const mindChangeDelta = container.querySelector('[data-testid="mind-change-delta"]');
          expect(mindChangeDelta).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.4: Status badge shows "Open" when debate needs opponent (Requirement 2.4)', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          resolution: fc.string({ minLength: 1, maxLength: 500 }),
          status: fc.constant('active' as const),
          currentRound: roundNumberArb,
          currentTurn: sideArb,
          supportDebaterId: fc.uuid(),
          opposeDebaterId: fc.constant(null), // No opponent
          createdAt: fc.date(),
          concludedAt: fc.constant(null),
        }),
        (debate) => {
          const { container } = render(
            <CompactDebateCard debate={debate} />
          );

          expect(container.textContent).toContain('Open');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.5: Status badge shows "Resolved" when debate is concluded (Requirement 2.4)', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          resolution: fc.string({ minLength: 1, maxLength: 500 }),
          status: fc.constant('concluded' as const),
          currentRound: roundNumberArb,
          currentTurn: sideArb,
          supportDebaterId: fc.uuid(),
          opposeDebaterId: fc.uuid(),
          createdAt: fc.date(),
          concludedAt: fc.date(),
        }),
        (debate) => {
          const { container } = render(
            <CompactDebateCard debate={debate} />
          );

          expect(container.textContent).toContain('Resolved');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.6: Round info shows "Round X/3" for active debates with opponent (Requirement 2.5)', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          resolution: fc.string({ minLength: 1, maxLength: 500 }),
          status: fc.constant('active' as const),
          currentRound: roundNumberArb,
          currentTurn: sideArb,
          supportDebaterId: fc.uuid(),
          opposeDebaterId: fc.uuid(), // Has opponent
          createdAt: fc.date(),
          concludedAt: fc.constant(null),
        }),
        (debate) => {
          const { container } = render(
            <CompactDebateCard debate={debate} />
          );

          const roundInfo = container.querySelector('[data-testid="round-info"]');
          expect(roundInfo).not.toBeNull();
          expect(roundInfo?.textContent).toContain(`Round ${debate.currentRound}/3`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.7: Live indicator is shown for active debates with opponent (Requirement 2.6)', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          resolution: fc.string({ minLength: 1, maxLength: 500 }),
          status: fc.constant('active' as const),
          currentRound: roundNumberArb,
          currentTurn: sideArb,
          supportDebaterId: fc.uuid(),
          opposeDebaterId: fc.uuid(), // Has opponent = live
          createdAt: fc.date(),
          concludedAt: fc.constant(null),
        }),
        (debate) => {
          const { container } = render(
            <CompactDebateCard debate={debate} />
          );

          const liveIndicator = container.querySelector('[data-testid="live-indicator"]');
          expect(liveIndicator).not.toBeNull();
          expect(container.textContent).toContain('Live');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.8: Live indicator is NOT shown for concluded debates (Requirement 2.6)', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          resolution: fc.string({ minLength: 1, maxLength: 500 }),
          status: fc.constant('concluded' as const),
          currentRound: roundNumberArb,
          currentTurn: sideArb,
          supportDebaterId: fc.uuid(),
          opposeDebaterId: fc.uuid(),
          createdAt: fc.date(),
          concludedAt: fc.date(),
        }),
        (debate) => {
          const { container } = render(
            <CompactDebateCard debate={debate} />
          );

          const liveIndicator = container.querySelector('[data-testid="live-indicator"]');
          expect(liveIndicator).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.9: Sparkline SVG is rendered (Requirement 2.8)', () => {
    fc.assert(
      fc.property(debateArb, marketPriceArb, (debate, marketPrice) => {
        const { container } = render(
          <CompactDebateCard debate={debate} marketPrice={marketPrice} />
        );

        const sparkline = container.querySelector('[data-testid="mini-sparkline"]');
        expect(sparkline).not.toBeNull();
        expect(sparkline?.tagName.toLowerCase()).toBe('svg');
      }),
      { numRuns: 100 }
    );
  });

  it('Property 3.10: Resolution text is displayed (Requirement 2.1)', () => {
    fc.assert(
      fc.property(debateArb, (debate) => {
        const { container } = render(
          <CompactDebateCard debate={debate} />
        );

        const resolutionText = container.querySelector('[data-testid="resolution-text"]');
        expect(resolutionText).not.toBeNull();
        expect(resolutionText?.textContent).toBe(debate.resolution);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 3.11: Card has max-height constraint for feed density (Requirement 2.7)', () => {
    fc.assert(
      fc.property(debateArb, (debate) => {
        const { container } = render(
          <CompactDebateCard debate={debate} />
        );

        const card = container.querySelector('[data-testid="compact-debate-card"]');
        expect(card).not.toBeNull();
        
        const style = card?.getAttribute('style');
        expect(style).toContain(`max-height: ${CARD_CONFIG.maxHeight}px`);
        expect(style).toContain(`min-height: ${CARD_CONFIG.minHeight}px`);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 3.12: Default market price values when marketPrice is null', () => {
    fc.assert(
      fc.property(debateArb, (debate) => {
        const { container } = render(
          <CompactDebateCard debate={debate} marketPrice={null} />
        );

        // Should still render support/oppose bar with default 50/50
        const supportBar = container.querySelector('[data-testid="support-bar"]');
        const opposeBar = container.querySelector('[data-testid="oppose-bar"]');

        expect(supportBar).not.toBeNull();
        expect(opposeBar).not.toBeNull();

        // Default values should be 50%
        expect(supportBar?.getAttribute('style')).toContain('width: 50%');
        expect(opposeBar?.getAttribute('style')).toContain('width: 50%');
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Property-based tests for Quick Stance Interaction.
 * 
 * Feature: reddit-style-feed, Property 4: Quick Stance Interaction
 * Validates: Requirements 3.3, 3.4, 3.5, 3.6
 */
describe('CompactDebateCard Property Tests - Quick Stance Interaction', () => {
  /**
   * Property 4: Quick Stance Interaction
   * For any authenticated user viewing a debate card:
   * - Quick stance buttons SHALL be rendered
   * - Clicking a stance button SHALL call onQuickStance with correct debateId and side
   * - Clicking a stance button SHALL NOT trigger navigation (event propagation stopped)
   * - After stance is recorded, the card SHALL display the user's stance visually
   * - If user has existing stance, it SHALL be displayed on initial render
   * 
   * Validates: Requirements 3.3, 3.4, 3.5, 3.6
   */

  it('Property 4.1: Quick stance buttons are rendered for authenticated users (Requirement 3.3)', () => {
    fc.assert(
      fc.property(debateArb, marketPriceArb, (debate, marketPrice) => {
        const onQuickStance = vi.fn();
        
        const { container } = render(
          <CompactDebateCard 
            debate={debate} 
            marketPrice={marketPrice}
            isAuthenticated={true}
            onQuickStance={onQuickStance}
          />
        );

        // Quick stance buttons should be rendered
        const quickStanceGroup = container.querySelector('[aria-label="Quick stance buttons"]');
        expect(quickStanceGroup).not.toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('Property 4.2: Quick stance buttons are NOT rendered for unauthenticated users (Requirement 3.3)', () => {
    fc.assert(
      fc.property(debateArb, marketPriceArb, (debate, marketPrice) => {
        const onQuickStance = vi.fn();
        
        const { container } = render(
          <CompactDebateCard 
            debate={debate} 
            marketPrice={marketPrice}
            isAuthenticated={false}
            onQuickStance={onQuickStance}
          />
        );

        // Quick stance buttons should NOT be rendered
        const quickStanceGroup = container.querySelector('[aria-label="Quick stance buttons"]');
        expect(quickStanceGroup).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('Property 4.3: Quick stance buttons are NOT rendered when onQuickStance is not provided', () => {
    fc.assert(
      fc.property(debateArb, marketPriceArb, (debate, marketPrice) => {
        const { container } = render(
          <CompactDebateCard 
            debate={debate} 
            marketPrice={marketPrice}
            isAuthenticated={true}
            // onQuickStance not provided
          />
        );

        // Quick stance buttons should NOT be rendered
        const quickStanceGroup = container.querySelector('[aria-label="Quick stance buttons"]');
        expect(quickStanceGroup).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('Property 4.4: Clicking support button calls onQuickStance with correct debateId and "support" (Requirement 3.4)', () => {
    fc.assert(
      fc.property(debateArb, marketPriceArb, (debate, marketPrice) => {
        const onQuickStance = vi.fn();
        
        const { container } = render(
          <CompactDebateCard 
            debate={debate} 
            marketPrice={marketPrice}
            isAuthenticated={true}
            onQuickStance={onQuickStance}
          />
        );

        // Find and click the support button (first button in InlineQuickStance)
        const buttons = container.querySelectorAll('[aria-label="Quick stance buttons"] button');
        if (buttons.length > 0) {
          const supportButton = buttons[0] as HTMLButtonElement;
          supportButton.click();
          
          expect(onQuickStance).toHaveBeenCalledWith(debate.id, 'support');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 4.5: Clicking oppose button calls onQuickStance with correct debateId and "oppose" (Requirement 3.4)', () => {
    fc.assert(
      fc.property(debateArb, marketPriceArb, (debate, marketPrice) => {
        const onQuickStance = vi.fn();
        
        const { container } = render(
          <CompactDebateCard 
            debate={debate} 
            marketPrice={marketPrice}
            isAuthenticated={true}
            onQuickStance={onQuickStance}
          />
        );

        // Find and click the oppose button (second button in InlineQuickStance)
        const buttons = container.querySelectorAll('[aria-label="Quick stance buttons"] button');
        if (buttons.length > 1) {
          const opposeButton = buttons[1] as HTMLButtonElement;
          opposeButton.click();
          
          expect(onQuickStance).toHaveBeenCalledWith(debate.id, 'oppose');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 4.6: User existing stance is displayed when userStance is provided (Requirement 3.6)', () => {
    fc.assert(
      fc.property(
        debateArb, 
        marketPriceArb,
        fc.integer({ min: 1, max: 100 }), // userStance > 0 means they've voted
        (debate, marketPrice, userStance) => {
          const onQuickStance = vi.fn();
          
          const { container } = render(
            <CompactDebateCard 
              debate={debate} 
              marketPrice={marketPrice}
              isAuthenticated={true}
              onQuickStance={onQuickStance}
              userStance={userStance}
            />
          );

          // When user has voted, InlineQuickStance shows a checkmark instead of buttons
          const quickStanceGroup = container.querySelector('[aria-label="Quick stance buttons"]');
          expect(quickStanceGroup).not.toBeNull();
          
          // The checkmark indicator should be present (✓)
          expect(quickStanceGroup?.textContent).toContain('✓');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.7: Quick stance buttons show vote buttons when userStance is null (Requirement 3.6)', () => {
    fc.assert(
      fc.property(debateArb, marketPriceArb, (debate, marketPrice) => {
        const onQuickStance = vi.fn();
        
        const { container } = render(
          <CompactDebateCard 
            debate={debate} 
            marketPrice={marketPrice}
            isAuthenticated={true}
            onQuickStance={onQuickStance}
            userStance={null}
          />
        );

        // When user hasn't voted, buttons should be present
        const buttons = container.querySelectorAll('[aria-label="Quick stance buttons"] button');
        expect(buttons.length).toBe(2); // Support and Oppose buttons
      }),
      { numRuns: 100 }
    );
  });
});
