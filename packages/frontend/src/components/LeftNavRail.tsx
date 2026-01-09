import { useEffect, useRef, useCallback } from 'react';

export interface NavSection {
  id: string;
  label: string;
  indent?: number;
}

interface LeftNavRailProps {
  sections: NavSection[];
  activeSection: string;
  onSectionClick: (sectionId: string) => void;
  onActiveSectionChange?: (sectionId: string) => void;
}

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
    <nav className="space-y-1" aria-label="Table of contents">
      <h2 className="label-text mb-4 px-3">Contents</h2>
      <ul className="space-y-0.5">
        {sections.map((section) => {
          const isActive = activeSection === section.id;
          const indentClass = section.indent 
            ? `pl-${3 + section.indent * 3}` 
            : 'pl-3';
          
          return (
            <li key={section.id}>
              {/* Navigation button - 44px minimum touch target for accessibility (Requirement 8.4) */}
              <button
                onClick={() => handleSectionClick(section.id)}
                className={`
                  w-full text-left min-h-[44px] py-2 pr-3 rounded-subtle transition-colors duration-150
                  ${indentClass}
                  ${isActive 
                    ? 'text-accent bg-accent/5 font-medium' 
                    : 'text-text-secondary hover:text-text-primary hover:bg-black/[0.02]'
                  }
                  ${section.indent ? 'text-body-small' : 'text-body-small'}
                `}
                aria-current={isActive ? 'location' : undefined}
              >
                {section.label}
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
