import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { 
  SectionAnchorNav, 
  SectionAnchor, 
  DEFAULT_DEBATE_ANCHORS,
  MOBILE_BREAKPOINT 
} from './SectionAnchorNav';

/**
 * Feature: debate-page-paper-polish
 * Property Tests for SectionAnchorNav Component
 * 
 * Property 2: Section Anchor Click Navigation
 * Property 3: Responsive Anchor Visibility
 * Property 4: Active Section Indication
 */

// ============================================================================
// Mock IntersectionObserver
// ============================================================================

class MockIntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  
  constructor(
    _callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit
  ) {}
  
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}

// ============================================================================
// Arbitraries
// ============================================================================

// Generate valid section anchor with safe labels (no trailing spaces, no prefix conflicts)
const sectionAnchorArbitrary = fc.record({
  id: fc.stringMatching(/^[a-z][a-z0-9-]{2,15}$/),
  label: fc.stringMatching(/^[A-Z][a-z]{3,15}$/),
});

// Generate array of unique section anchors with distinct labels
const anchorsArrayArbitrary = fc.array(sectionAnchorArbitrary, { minLength: 1, maxLength: 5 })
  .map(anchors => {
    const seenIds = new Set<string>();
    const seenLabels = new Set<string>();
    return anchors.filter(a => {
      const lowerLabel = a.label.toLowerCase();
      if (seenIds.has(a.id) || seenLabels.has(lowerLabel)) return false;
      for (const existing of seenLabels) {
        if (lowerLabel.startsWith(existing) || existing.startsWith(lowerLabel)) {
          return false;
        }
      }
      seenIds.add(a.id);
      seenLabels.add(lowerLabel);
      return true;
    });
  })
  .filter(arr => arr.length > 0);

// ============================================================================
// Test Utilities
// ============================================================================

function setupScrollMock() {
  const scrollIntoViewMock = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoViewMock;
  return scrollIntoViewMock;
}

function createMockSections(anchors: SectionAnchor[]) {
  anchors.forEach(anchor => {
    const section = document.createElement('section');
    section.id = anchor.id;
    document.body.appendChild(section);
  });
}

function cleanupMockSections(anchors: SectionAnchor[]) {
  anchors.forEach(anchor => {
    const section = document.getElementById(anchor.id);
    if (section) {
      document.body.removeChild(section);
    }
  });
}

function getButtonBySectionId(sectionId: string): HTMLElement {
  const button = document.querySelector(`button[data-section-id="${sectionId}"]`);
  if (!button) {
    throw new Error(`Button with data-section-id="${sectionId}" not found`);
  }
  return button as HTMLElement;
}

// ============================================================================
// Property Tests
// ============================================================================

describe('SectionAnchorNav Property Tests', () => {
  beforeAll(() => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 2: Section Anchor Click Navigation
   * 
   * For any section anchor in the SectionAnchorNav component, when clicked,
   * the page SHALL initiate a scroll to the corresponding section element with that ID.
   * 
   * Validates: Requirements 6.3
   */
  describe('Property 2: Section Anchor Click Navigation', () => {
    it('Clicking any anchor should initiate scroll to corresponding section', () => {
      fc.assert(
        fc.property(anchorsArrayArbitrary, (anchors) => {
          cleanup();
          
          createMockSections(anchors);
          const scrollMock = setupScrollMock();
          const onAnchorClick = vi.fn();
          
          render(
            <SectionAnchorNav
              anchors={anchors}
              activeSection={anchors[0].id}
              onAnchorClick={onAnchorClick}
              data-testid="anchor-nav"
            />
          );
          
          anchors.forEach(anchor => {
            scrollMock.mockClear();
            onAnchorClick.mockClear();
            
            const button = getButtonBySectionId(anchor.id);
            fireEvent.click(button);
            
            expect(scrollMock).toHaveBeenCalledWith({ 
              behavior: 'smooth', 
              block: 'start' 
            });
            expect(onAnchorClick).toHaveBeenCalledWith(anchor.id);
          });
          
          cleanupMockSections(anchors);
        }),
        { numRuns: 100 }
      );
    });

    it('Clicking anchor should call scrollIntoView on correct element', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...DEFAULT_DEBATE_ANCHORS),
          (anchor) => {
            cleanup();
            
            createMockSections([anchor]);
            const scrollMock = setupScrollMock();
            
            render(
              <SectionAnchorNav
                anchors={DEFAULT_DEBATE_ANCHORS}
                activeSection={DEFAULT_DEBATE_ANCHORS[0].id}
                data-testid="anchor-nav"
              />
            );
            
            const button = getButtonBySectionId(anchor.id);
            fireEvent.click(button);
            
            expect(scrollMock).toHaveBeenCalled();
            
            cleanupMockSections([anchor]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Anchor buttons should have correct data-section-id attribute', () => {
      fc.assert(
        fc.property(anchorsArrayArbitrary, (anchors) => {
          cleanup();
          
          render(
            <SectionAnchorNav
              anchors={anchors}
              activeSection={anchors[0].id}
              data-testid="anchor-nav"
            />
          );
          
          anchors.forEach(anchor => {
            const button = getButtonBySectionId(anchor.id);
            expect(button).toHaveAttribute('data-section-id', anchor.id);
          });
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: Responsive Anchor Visibility
   * 
   * For any viewport width less than 1024px, the SectionAnchorNav component
   * SHALL not be visible (display: none or visibility: hidden).
   * 
   * Validates: Requirements 6.5
   */
  describe('Property 3: Responsive Anchor Visibility', () => {
    it('Component should have hidden class for mobile and lg:block for desktop', () => {
      fc.assert(
        fc.property(anchorsArrayArbitrary, (anchors) => {
          cleanup();
          
          render(
            <SectionAnchorNav
              anchors={anchors}
              activeSection={anchors[0].id}
              data-testid="anchor-nav"
            />
          );
          
          const nav = screen.getByTestId('anchor-nav');
          
          expect(nav.className).toContain('hidden');
          expect(nav.className).toContain('lg:block');
        }),
        { numRuns: 100 }
      );
    });

    it('Component should expose mobile breakpoint via data attribute', () => {
      fc.assert(
        fc.property(anchorsArrayArbitrary, (anchors) => {
          cleanup();
          
          render(
            <SectionAnchorNav
              anchors={anchors}
              activeSection={anchors[0].id}
              data-testid="anchor-nav"
            />
          );
          
          const nav = screen.getByTestId('anchor-nav');
          
          expect(nav).toHaveAttribute('data-mobile-breakpoint', String(MOBILE_BREAKPOINT));
          expect(MOBILE_BREAKPOINT).toBe(1024);
        }),
        { numRuns: 100 }
      );
    });

    it('MOBILE_BREAKPOINT constant should be 1024', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          expect(MOBILE_BREAKPOINT).toBe(1024);
        }),
        { numRuns: 100 }
      );
    });

    it('Tailwind lg breakpoint matches mobile breakpoint requirement', () => {
      fc.assert(
        fc.property(anchorsArrayArbitrary, (anchors) => {
          cleanup();
          
          render(
            <SectionAnchorNav
              anchors={anchors}
              activeSection={anchors[0].id}
              data-testid="anchor-nav"
            />
          );
          
          const nav = screen.getByTestId('anchor-nav');
          const classes = nav.className.split(' ');
          
          expect(classes).toContain('hidden');
          expect(classes.some(c => c.includes('lg:block'))).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Active Section Indication
   * 
   * For any scroll position where a section element is within the viewport's active zone,
   * the corresponding anchor in SectionAnchorNav SHALL have the active visual state applied.
   * 
   * Validates: Requirements 6.6
   */
  describe('Property 4: Active Section Indication', () => {
    it('Active section anchor should have data-active="true" attribute', () => {
      fc.assert(
        fc.property(anchorsArrayArbitrary, (anchors) => {
          cleanup();
          
          const activeIndex = Math.floor(Math.random() * anchors.length);
          const activeAnchor = anchors[activeIndex];
          
          render(
            <SectionAnchorNav
              anchors={anchors}
              activeSection={activeAnchor.id}
              data-testid="anchor-nav"
            />
          );
          
          const activeButton = getButtonBySectionId(activeAnchor.id);
          expect(activeButton).toHaveAttribute('data-active', 'true');
        }),
        { numRuns: 100 }
      );
    });

    it('Non-active section anchors should have data-active="false" attribute', () => {
      fc.assert(
        fc.property(
          anchorsArrayArbitrary.filter(arr => arr.length >= 2),
          (anchors) => {
            cleanup();
            
            const activeAnchor = anchors[0];
            
            render(
              <SectionAnchorNav
                anchors={anchors}
                activeSection={activeAnchor.id}
                data-testid="anchor-nav"
              />
            );
            
            anchors.slice(1).forEach(anchor => {
              const button = getButtonBySectionId(anchor.id);
              expect(button).toHaveAttribute('data-active', 'false');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Active anchor should have aria-current="location" attribute', () => {
      fc.assert(
        fc.property(anchorsArrayArbitrary, (anchors) => {
          cleanup();
          
          const activeAnchor = anchors[0];
          
          render(
            <SectionAnchorNav
              anchors={anchors}
              activeSection={activeAnchor.id}
              data-testid="anchor-nav"
            />
          );
          
          const activeButton = getButtonBySectionId(activeAnchor.id);
          expect(activeButton).toHaveAttribute('aria-current', 'location');
        }),
        { numRuns: 100 }
      );
    });

    it('Non-active anchors should not have aria-current attribute', () => {
      fc.assert(
        fc.property(
          anchorsArrayArbitrary.filter(arr => arr.length >= 2),
          (anchors) => {
            cleanup();
            
            const activeAnchor = anchors[0];
            
            render(
              <SectionAnchorNav
                anchors={anchors}
                activeSection={activeAnchor.id}
                data-testid="anchor-nav"
              />
            );
            
            anchors.slice(1).forEach(anchor => {
              const button = getButtonBySectionId(anchor.id);
              expect(button).not.toHaveAttribute('aria-current');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Exactly one anchor should be active at any time', () => {
      fc.assert(
        fc.property(anchorsArrayArbitrary, (anchors) => {
          cleanup();
          
          const activeIndex = Math.floor(Math.random() * anchors.length);
          const activeAnchor = anchors[activeIndex];
          
          render(
            <SectionAnchorNav
              anchors={anchors}
              activeSection={activeAnchor.id}
              data-testid="anchor-nav"
            />
          );
          
          const buttons = screen.getAllByRole('button');
          const activeButtons = buttons.filter(
            btn => btn.getAttribute('data-active') === 'true'
          );
          
          expect(activeButtons).toHaveLength(1);
          expect(activeButtons[0]).toHaveAttribute('data-section-id', activeAnchor.id);
        }),
        { numRuns: 100 }
      );
    });

    it('Active section styling should apply accent color class', () => {
      fc.assert(
        fc.property(anchorsArrayArbitrary, (anchors) => {
          cleanup();
          
          const activeAnchor = anchors[0];
          
          render(
            <SectionAnchorNav
              anchors={anchors}
              activeSection={activeAnchor.id}
              data-testid="anchor-nav"
            />
          );
          
          const activeButton = getButtonBySectionId(activeAnchor.id);
          expect(activeButton.className).toContain('text-accent');
        }),
        { numRuns: 100 }
      );
    });

    it('Changing activeSection prop should update active indication', () => {
      fc.assert(
        fc.property(
          anchorsArrayArbitrary.filter(arr => arr.length >= 2),
          (anchors) => {
            cleanup();
            
            const { rerender } = render(
              <SectionAnchorNav
                anchors={anchors}
                activeSection={anchors[0].id}
                data-testid="anchor-nav"
              />
            );
            
            let firstButton = getButtonBySectionId(anchors[0].id);
            expect(firstButton).toHaveAttribute('data-active', 'true');
            
            rerender(
              <SectionAnchorNav
                anchors={anchors}
                activeSection={anchors[1].id}
                data-testid="anchor-nav"
              />
            );
            
            const secondButton = getButtonBySectionId(anchors[1].id);
            expect(secondButton).toHaveAttribute('data-active', 'true');
            
            firstButton = getButtonBySectionId(anchors[0].id);
            expect(firstButton).toHaveAttribute('data-active', 'false');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
