import { useState, useRef, useCallback } from 'react';

export interface EvidenceSource {
  title: string;
  domain: string;
  year: number;
  excerpt: string;
  type: 'study' | 'news' | 'opinion';
}

interface EvidenceFootnoteProps {
  number: number;
  source: EvidenceSource;
  onShowSourceCard?: (source: EvidenceSource, position: { top: number }) => void;
  onHideSourceCard?: () => void;
}

/**
 * EvidenceFootnote renders an inline numbered citation [1], [2], etc.
 * On hover, it triggers the display of a SourceCard in the right margin.
 * Requirements: 10.4, 10.5
 */
export function EvidenceFootnote({ 
  number, 
  source,
  onShowSourceCard,
  onHideSourceCard,
}: EvidenceFootnoteProps) {
  const ref = useRef<HTMLElement>(null);
  
  const handleMouseEnter = useCallback(() => {
    if (onShowSourceCard && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      onShowSourceCard(source, { top: rect.top });
    }
  }, [source, onShowSourceCard]);
  
  const handleMouseLeave = useCallback(() => {
    if (onHideSourceCard) {
      onHideSourceCard();
    }
  }, [onHideSourceCard]);
  
  return (
    <sup
      ref={ref}
      className="text-accent cursor-help hover:underline mx-0.5 font-body"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="doc-noteref"
      aria-label={`Citation ${number}: ${source.title}`}
    >
      [{number}]
    </sup>
  );
}

interface SourceCardProps {
  source: EvidenceSource;
  position?: { top: number };
}

/**
 * SourceCard displays citation details in the right margin.
 * Shows: title, domain, year, 1-2 line excerpt, type (Study/News/Opinion).
 * Requirements: 10.4, 10.5
 */
export function SourceCard({ source, position }: SourceCardProps) {
  const typeConfig = getTypeConfig(source.type);
  
  return (
    <div 
      className="bg-white border border-gray-100 rounded-small shadow-paper p-4 max-w-[200px]"
      style={position ? { marginTop: position.top } : undefined}
      role="tooltip"
    >
      {/* Type badge */}
      <div className="mb-2">
        <span className={`text-label uppercase tracking-wider ${typeConfig.color}`}>
          {typeConfig.label}
        </span>
      </div>
      
      {/* Title */}
      <h4 className="text-body-small font-medium text-text-primary mb-1 line-clamp-2">
        {source.title}
      </h4>
      
      {/* Domain and year */}
      <p className="text-caption text-text-tertiary mb-2">
        {source.domain} · {source.year}
      </p>
      
      {/* Excerpt */}
      <p className="text-caption text-text-secondary line-clamp-2">
        {source.excerpt}
      </p>
    </div>
  );
}

/**
 * SourceCardContainer manages the display of source cards in the right margin.
 * Positioned absolutely to align with the footnote that triggered it.
 */
interface SourceCardContainerProps {
  position: { top: number };
  children: React.ReactNode;
}

export function SourceCardContainer({ position, children }: SourceCardContainerProps) {
  return (
    <div 
      className="mt-4 transition-opacity duration-200"
      style={{ marginTop: Math.max(0, position.top - 100) }}
    >
      {children}
    </div>
  );
}

function getTypeConfig(type: EvidenceSource['type']): { label: string; color: string } {
  switch (type) {
    case 'study':
      return { label: 'Study', color: 'text-blue-600' };
    case 'news':
      return { label: 'News', color: 'text-amber-600' };
    case 'opinion':
      return { label: 'Opinion', color: 'text-purple-600' };
    default:
      return { label: 'Source', color: 'text-text-tertiary' };
  }
}

/**
 * Hook to manage source card visibility state.
 * Returns state and handlers for showing/hiding source cards.
 * 
 * The handleCitationHover function is designed to work with the Citation type
 * from ArgumentBlock, converting it to EvidenceSource format.
 */
export function useSourceCardState() {
  const [hoveredSource, setHoveredSource] = useState<EvidenceSource | null>(null);
  const [sourcePosition, setSourcePosition] = useState<{ top: number }>({ top: 0 });
  
  const showSourceCard = useCallback((source: EvidenceSource, position: { top: number }) => {
    setHoveredSource(source);
    setSourcePosition(position);
  }, []);
  
  const hideSourceCard = useCallback(() => {
    setHoveredSource(null);
  }, []);

  // Handler that works with Citation type from ArgumentBlock
  const handleCitationHover = useCallback((citation: { 
    title: string; 
    domain: string; 
    year: number; 
    excerpt: string; 
    type: 'study' | 'news' | 'opinion';
  } | null, position: { top: number }) => {
    if (citation) {
      setHoveredSource(citation);
      setSourcePosition(position);
    } else {
      setHoveredSource(null);
    }
  }, []);
  
  return {
    hoveredSource,
    sourcePosition,
    showSourceCard,
    hideSourceCard,
    handleCitationHover,
  };
}

export default EvidenceFootnote;
