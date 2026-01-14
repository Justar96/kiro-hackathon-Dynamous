import { useEffect, useRef, useCallback } from 'react';

export interface NavSection {
  id: string;
  label: string;
  indent?: number;
  /** Optional badge content (e.g., round number, status) */
  badge?: string;
  /** Optional status indicator */
  status?: 'active' | 'completed' | 'pending';
}

/**
 * Generates the label for the Debate Rounds TOC entry.
 */
export function generateDebateRoundsLabel(): string {
  return 'Rounds';
}

/**
 * Creates the unified TOC sections array for a debate page.
 * 
 * Requirements: 8.1, 8.3, 8.4
 * - 8.1: Single "Debate Rounds" section
 * - 8.3: Current round indicator badge
 * - 8.4: Resolution, Outcome, and Discussion sections
 */
export function createUnifiedTocSections(currentRound: 1 | 2 | 3): NavSection[] {
  return [
    { id: 'resolution', label: 'Resolution' },
    { id: 'debate-rounds', label: 'Rounds', badge: `${currentRound}/3`, status: 'active' },
    { id: 'outcome', label: 'Outcome' },
    { id: 'comments', label: 'Discussion' },
  ];
}

interface LeftNavRailProps {
  sections: NavSection[];
  activeSection: string;
  onSectionClick: (sectionId: string) => void;
  onActiveSectionChange?: (sectionId: string) => void;
}

/**
 * LeftNavRail - Modern, compact navigation sidebar
 * 
 * Features:
 * - Clean vertical line indicator for active section
 * - Compact spacing with better visual hierarchy
 * - Badge support for status indicators
 * - Smooth animations for state changes
 */
export function LeftNavRail({ 
  sections, 
  activeSection, 
  onSectionClick,
  onActiveSectionChange 
}: LeftNavRailProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sectionRefs = useRef<Map<string, Element>>(new Map());

  const handleSectionClick = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    onSectionClick(sectionId);
  }, [onSectionClick]);

  useEffect(() => {
    // Set up IntersectionObserver for scroll-based section highlighting
    const observerCallback: IntersectionObserverCallback = (entries) => {
      // Find the most visible section
      let mostVisibleEntry: IntersectionObserverEntry | null = null;
      let maxRatio = 0;

      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
          maxRatio = entry.intersectionRatio;
          mostVisibleEntry = entry;
        }
      });

      if (mostVisibleEntry && onActiveSectionChange) {
        const sectionId = (mostVisibleEntry as IntersectionObserverEntry).target.id;
        if (sectionId) {
          onActiveSectionChange(sectionId);
        }
      }
    };

    observerRef.current = new IntersectionObserver(observerCallback, {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: [0, 0.25, 0.5, 0.75, 1],
    });

    // Observe all sections
    sections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) {
        sectionRefs.current.set(section.id, element);
        observerRef.current?.observe(element);
      }
    });

    return () => {
      observerRef.current?.disconnect();
      sectionRefs.current.clear();
    };
  }, [sections, onActiveSectionChange]);

  return (
    <nav className="relative" aria-label="Page navigation">
      {/* Navigation items */}
      <ul className="space-y-1">
        {sections.map((section) => {
          const isActive = activeSection === section.id;
          
          const indicatorClasses = [
            'absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full',
            'transition-all duration-200',
            isActive ? 'bg-accent opacity-100' : 'bg-transparent opacity-0'
          ].join(' ');

          const buttonClasses = [
            'w-full text-left pl-3 pr-2 py-2 rounded-r-lg',
            'transition-all duration-150',
            'flex items-center justify-between gap-2',
            isActive 
              ? 'text-accent bg-accent/5' 
              : 'text-text-secondary hover:text-text-primary hover:bg-page-bg/50'
          ].join(' ');

          const badgeClasses = [
            'text-xs px-1.5 py-0.5 rounded-full tabular-nums',
            isActive 
              ? 'bg-accent/10 text-accent' 
              : 'bg-divider/50 text-text-tertiary'
          ].join(' ');
          
          return (
            <li key={section.id} className="relative">
              {/* Active indicator line */}
              <div className={indicatorClasses} />
              
              <button
                onClick={() => handleSectionClick(section.id)}
                className={buttonClasses}
                aria-current={isActive ? 'location' : undefined}
              >
                <span className={`text-sm ${isActive ? 'font-medium' : ''}`}>
                  {section.label}
                </span>
                
                {/* Badge (e.g., round progress) */}
                {section.badge && (
                  <span className={badgeClasses}>
                    {section.badge}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Hook for managing active section state with scroll observation
export function useActiveSectionObserver(sections: NavSection[]) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const activeSectionRef = useRef<string>(sections[0]?.id || '');

  useEffect(() => {
    const observerCallback: IntersectionObserverCallback = (entries) => {
      // Track which sections are currently visible
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
        activeSectionRef.current = visibleSections[0].id;
      }
    };

    observerRef.current = new IntersectionObserver(observerCallback, {
      root: null,
      rootMargin: '-10% 0px -70% 0px',
      threshold: [0, 0.1, 0.5, 1],
    });

    // Observe all sections
    sections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) {
        observerRef.current?.observe(element);
      }
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [sections]);

  return activeSectionRef;
}
