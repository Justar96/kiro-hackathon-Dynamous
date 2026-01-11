import type { Argument, User } from '@debate-platform/shared';

export interface Citation {
  number: number;
  title: string;
  domain: string;
  year: number;
  excerpt: string;
  type: 'study' | 'news' | 'opinion';
}

interface ArgumentBlockProps {
  argument: Argument;
  side: 'support' | 'oppose';
  author?: User | null;
  citations?: Citation[];
  onAttributeImpact?: () => void;
  onCitationHover?: (citation: Citation | null, position: { top: number }) => void;
  /** Callback when user clicks "This changed my mind" button */
  onMindChanged?: () => void;
  /** Whether this argument has been attributed as "changed my mind" */
  attributed?: boolean;
}

/**
 * ArgumentBlock displays an individual argument as an essay paragraph.
 * Follows the paper-clean dossier aesthetic - not a comment bubble.
 * Shows side label (FOR/AGAINST), author+reputation, main text, footnotes, and impact badge.
 * 
 * Includes "This changed my mind" button for impact attribution.
 * 
 * Requirements: 10.3, 13.1, 13.2, 13.3
 */
export function ArgumentBlock({ 
  argument, 
  side, 
  author,
  citations = [],
  onAttributeImpact,
  onCitationHover,
  onMindChanged,
  attributed = false,
}: ArgumentBlockProps) {
  const sideConfig = getSideConfig(side);
  const hasImpact = argument.impactScore > 0;
  
  // Parse content for citation markers [1], [2], etc.
  const contentWithCitations = renderContentWithCitations(
    argument.content, 
    citations,
    onCitationHover
  );
  
  return (
    <article className="mb-8 last:mb-0">
      {/* Side label - tiny caps */}
      <div className="mb-2">
        <span className={`text-label uppercase tracking-wider ${sideConfig.color}`}>
          {sideConfig.label}
        </span>
      </div>
      
      {/* Author + reputation (small text) */}
      {author && (
        <div className="flex items-center gap-2 mb-3 text-body-small text-text-secondary">
          <span className="font-medium">{author.username}</span>
          <span className="text-text-tertiary">·</span>
          <span className="text-text-tertiary">
            Rep: {author.reputationScore.toFixed(0)}
          </span>
        </div>
      )}
      
      {/* Main text as readable paragraph */}
      <div className="text-body text-text-primary leading-relaxed mb-4">
        {contentWithCitations}
      </div>
      
      {/* Footer: Impact badge and attribution button */}
      <div className="flex items-center justify-between">
        {/* Impact badge - muted but conceptually significant */}
        {hasImpact && (
          <ImpactBadge score={argument.impactScore} />
        )}
        
        {/* Spacer when no impact badge */}
        {!hasImpact && <div />}
        
        {/* "This changed my mind" button - for impact attribution */}
        {(onAttributeImpact || onMindChanged) && (
          <MindChangedButton 
            onClick={onMindChanged || onAttributeImpact}
            attributed={attributed}
          />
        )}
      </div>
    </article>
  );
}

/**
 * ImpactBadge shows the net stance change attributed to an argument.
 * Visually muted (tiny, not shouting) but conceptually significant.
 * Requirements: 13.2, 13.3
 */
export function ImpactBadge({ score }: { score: number }) {
  const sign = score >= 0 ? '+' : '';
  return (
    <span className="text-caption text-text-tertiary">
      Impact: {sign}{score.toFixed(0)}
    </span>
  );
}

/**
 * MindChangedButton allows users to attribute their mind-change to a specific argument.
 * This is the core interaction for impact attribution.
 * Requirements: 13.1
 */
interface MindChangedButtonProps {
  onClick?: () => void;
  attributed?: boolean;
}

export function MindChangedButton({ onClick, attributed = false }: MindChangedButtonProps) {
  if (attributed) {
    return (
      <span className="text-caption text-accent flex items-center gap-1">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Changed my mind
      </span>
    );
  }

  return (
    <button
      onClick={onClick}
      className="text-caption text-text-tertiary hover:text-accent transition-colors flex items-center gap-1 group"
      title="Attribute your mind-change to this argument"
    >
      <svg 
        className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
      This changed my mind
    </button>
  );
}

function getSideConfig(side: 'support' | 'oppose'): { label: string; color: string } {
  if (side === 'support') {
    return { label: 'For', color: 'text-support' };
  }
  return { label: 'Against', color: 'text-oppose' };
}

/**
 * Renders content with inline citation footnotes [1], [2], etc.
 * Citations show source cards on hover in the right margin.
 */
function renderContentWithCitations(
  content: string,
  citations: Citation[],
  onCitationHover?: (citation: Citation | null, position: { top: number }) => void
): React.ReactNode {
  if (citations.length === 0) {
    return content;
  }
  
  // Split content by citation markers like [1], [2], etc.
  const parts = content.split(/(\[\d+\])/g);
  
  return parts.map((part, index) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const citationNum = parseInt(match[1], 10);
      const citation = citations.find(c => c.number === citationNum);
      
      if (citation) {
        return (
          <EvidenceFootnote
            key={index}
            number={citationNum}
            citation={citation}
            onHover={onCitationHover}
          />
        );
      }
    }
    return <span key={index}>{part}</span>;
  });
}

interface EvidenceFootnoteProps {
  number: number;
  citation: Citation;
  onHover?: (citation: Citation | null, position: { top: number }) => void;
}

/**
 * Inline numbered citation that triggers source card display on hover.
 */
function EvidenceFootnote({ number, citation, onHover }: EvidenceFootnoteProps) {
  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    if (onHover) {
      const rect = e.currentTarget.getBoundingClientRect();
      onHover(citation, { top: rect.top });
    }
  };
  
  const handleMouseLeave = () => {
    if (onHover) {
      onHover(null, { top: 0 });
    }
  };
  
  return (
    <sup
      className="text-accent cursor-help hover:underline mx-0.5"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      [{number}]
    </sup>
  );
}

export default ArgumentBlock;
