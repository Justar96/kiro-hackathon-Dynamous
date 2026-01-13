/**
 * SectionAnchorNav component for right-margin navigation anchors
 * Displays section links with em-dash prefix styling, hidden on mobile
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface SectionAnchor {
  /** Unique identifier matching the section element's id attribute */
  id: string;
  /** Display label for the anchor */
  label: string;
}

export interface SectionAnchorNavProps {
  /** Array of section anchors to display */
  anchors: SectionAnchor[];
  /** Currently active section id */
  activeSection?: string;
  /** Callback when an anchor is clicked */
  onAnchorClick?: (sectionId: string) => void;
  /** Callback when active section changes via scroll */
  onActiveSectionChange?: (sectionId: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for property-based testing */
  'data-testid'?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default debate page anchors
 * Requirements: 6.2 - Resolution, Round 1, Round 2, Round 3, Comments
 */
export const DEFAULT_DEBATE_ANCHORS: SectionAnchor[] = [
  { id: 'resolution', label: 'Resolution' },
  { id: 'round-1', label: 'Round I' },
  { id: 'round-2', label: 'Round II' },
  { id: 'round-3', label: 'Round III' },
  { id: 'comments', label: 'Comments' },
];

/**
 * Breakpoint for hiding anchors on mobile
 * Requirements: 6.5 - Hide on mobile viewports (< 1024px)
 */
export const MOBILE_BREAKPOINT = 1024;

// ============================================================================
// Component
// ============================================================================

/**
 * SectionAnchorNav - Right-margin navigation anchors for desktop viewports
 * 
 * Displays section links with uppercase monospace styling and em-dash prefix.
 * Hidden on mobile viewports (< 1024px). Supports scroll-based active section
 * tracking via IntersectionObserver.
 * 
 * @example
 * // Basic usage with default anchors
 * <SectionAnchorNav 
 *   anchors={DEFAULT_DEBATE_ANCHORS}
 *   activeSection="resolution"
 *   onAnchorClick={(id) => console.log('Clicked:', id)}
 * />
 * 
 * @example
 * // With active section tracking
 * <SectionAnchorNav 
 *   anchors={anchors}
 *   onActiveSectionChange={(id) => setActiveSection(id)}
 * />
 */
export function SectionAnchorNav({
  anchors,
  activeSection,
  onAnchorClick,
  onActiveSectionChange,
  className = '',
  'data-testid': testId,
}: SectionAnchorNavProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [internalActiveSection, setInternalActiveSection] = useState<string>(
    activeSection || anchors[0]?.id || ''
  );

  // Use controlled or internal active section
  const currentActiveSection = activeSection ?? internalActiveSection;

  /**
   * Handle anchor click - smooth scroll to section
   * Requirements: 6.3 - Smooth-scroll to section on click
   */
  const handleAnchorClick = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    onAnchorClick?.(sectionId);
  }, [onAnchorClick]);

  /**
   * Set up IntersectionObserver for scroll-based active section tracking
   * Requirements: 6.6 - Active section visually indicated
   */
  useEffect(() => {
    if (!onActiveSectionChange && activeSection !== undefined) {
      // If controlled externally, don't set up observer
      return;
    }

    const observerCallback: IntersectionObserverCallback = (entries) => {
      // Find the most visible section in the active zone
      const visibleSections: { id: string; ratio: number; top: number }[] = [];

      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          visibleSections.push({
            id: entry.target.id,
            ratio: entry.intersectionRatio,
            top: entry.boundingClientRect.top,
          });
        }
      });

      // Sort by position (top of viewport first)
      visibleSections.sort((a, b) => a.top - b.top);

      // Use the topmost visible section
      if (visibleSections.length > 0) {
        const newActiveSection = visibleSections[0].id;
        setInternalActiveSection(newActiveSection);
        onActiveSectionChange?.(newActiveSection);
      }
    };

    observerRef.current = new IntersectionObserver(observerCallback, {
      root: null,
      // Active zone: top 20% to 40% of viewport
      rootMargin: '-20% 0px -60% 0px',
      threshold: [0, 0.25, 0.5, 0.75, 1],
    });

    // Observe all sections
    anchors.forEach((anchor) => {
      const element = document.getElementById(anchor.id);
      if (element) {
        observerRef.current?.observe(element);
      }
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [anchors, onActiveSectionChange, activeSection]);

  return (
    <nav
      className={`hidden lg:block ${className}`}
      aria-label="Section navigation"
      data-testid={testId}
      data-mobile-breakpoint={MOBILE_BREAKPOINT}
    >
      <ul className="space-y-2">
        {anchors.map((anchor) => {
          const isActive = currentActiveSection === anchor.id;
          
          return (
            <li key={anchor.id}>
              <button
                onClick={() => handleAnchorClick(anchor.id)}
                className={`
                  group flex items-center gap-2 text-right w-full
                  monospace-label transition-colors duration-150
                  ${isActive 
                    ? 'text-accent' 
                    : 'text-text-tertiary hover:text-text-secondary'
                  }
                `}
                aria-current={isActive ? 'location' : undefined}
                data-section-id={anchor.id}
                data-active={isActive}
              >
                {/* Em-dash prefix */}
                <span 
                  className={`
                    transition-opacity duration-150
                    ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}
                  `}
                  aria-hidden="true"
                >
                  —
                </span>
                {/* Label */}
                <span>{anchor.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ============================================================================
// Hook for external active section management
// ============================================================================

/**
 * Hook for managing active section state with scroll observation
 * Use this when you need to share active section state across components
 * 
 * @param anchors - Array of section anchors to observe
 * @returns Current active section id
 */
export function useActiveSectionTracking(anchors: SectionAnchor[]): string {
  const [activeSection, setActiveSection] = useState<string>(anchors[0]?.id || '');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const observerCallback: IntersectionObserverCallback = (entries) => {
      const visibleSections: { id: string; ratio: number; top: number }[] = [];

      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          visibleSections.push({
            id: entry.target.id,
            ratio: entry.intersectionRatio,
            top: entry.boundingClientRect.top,
          });
        }
      });

      visibleSections.sort((a, b) => a.top - b.top);

      if (visibleSections.length > 0) {
        setActiveSection(visibleSections[0].id);
      }
    };

    observerRef.current = new IntersectionObserver(observerCallback, {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: [0, 0.25, 0.5, 0.75, 1],
    });

    anchors.forEach((anchor) => {
      const element = document.getElementById(anchor.id);
      if (element) {
        observerRef.current?.observe(element);
      }
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [anchors]);

  return activeSection;
}

export default SectionAnchorNav;
