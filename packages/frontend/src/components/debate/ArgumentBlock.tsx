import type { Argument, User } from '@thesis/shared';
import { CheckIcon, LightBulbIcon } from '../icons';
import { ReactionDisplay } from './ReactionDisplay';

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
  /** Whether to highlight this argument (for real-time SSE updates) */
  highlight?: boolean;
  onAttributeImpact?: () => void;
  onCitationHover?: (citation: Citation | null, position: { top: number }) => void;
  /** Callback when user clicks "This changed my mind" button */
  onMindChanged?: () => void;
  /** Whether this argument has been attributed as "changed my mind" */
  attributed?: boolean;
  /** Whether to show reaction buttons (Requirement 6.3) */
  showReactions?: boolean;
}

/**
 * ArgumentBlock displays an individual argument as an essay paragraph.
 * Shows side label (FOR/AGAINST), author+reputation, main text, footnotes, and impact badge.
 * Includes "This changed my mind" button for impact attribution.
 */
export function ArgumentBlock({ 
  argument, 
  side, 
  author,
  citations = [],
  highlight = false,
  onAttributeImpact,
  onCitationHover,
  onMindChanged,
  attributed = false,
  showReactions = true,
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
    <article
      className={`bg-paper border border-divider rounded-lg shadow-paper overflow-hidden transition-all duration-500 hover:shadow-md ${
        highlight ? 'ring-2 ring-accent/50 shadow-lg animate-pulse-once' : ''
      }`}
    >
      {/* Byline Header */}
      <div className="px-5 pt-4 pb-2 flex items-baseline justify-between gap-3 bg-page-bg/30 border-b border-divider">
        <div className="flex items-baseline gap-2">
          {/* Side label */}
          <span className={`small-caps text-xs font-medium ${sideConfig.color}`}>
            {sideConfig.label}
          </span>
          {/* Author byline */}
          {author && (
            <>
              <span className="text-divider">—</span>
              <span className="text-body-small text-text-secondary italic">
                {author.username}
              </span>
              <span className="text-caption text-text-tertiary">
                ({author.reputationScore.toFixed(0)} rep)
              </span>
          </>
        )}
        </div>
        
        {/* Impact badge */}
        {hasImpact && (
          <ImpactBadge score={argument.impactScore} />
        )}
      </div>
      
      {/* Main content */}
      <div className="px-5 pb-4">
        <div className="text-body text-text-primary leading-[1.7]">
          {contentWithCitations}
        </div>
      </div>
      
      {/* Footer - Reactions and Attribution button */}
      <div className="px-5 py-3 border-t border-divider">
        <div className="flex items-center justify-between gap-4">
          {/* Reactions - Aggregate counts only (Requirement 6.3) */}
          {showReactions && (
            <ReactionDisplay 
              argumentId={argument.id} 
              interactive={true}
              compact={false}
            />
          )}
          
          {/* Mind Changed button */}
          {(onAttributeImpact || onMindChanged) && (
            <MindChangedButton 
              onClick={onMindChanged || onAttributeImpact}
              attributed={attributed}
            />
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * ImpactBadge shows the net stance change attributed to an argument.
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
 * MindChangedButton allows users to attribute their mind-change to an argument.
 */
interface MindChangedButtonProps {
  onClick?: () => void;
  attributed?: boolean;
}

export function MindChangedButton({ onClick, attributed = false }: MindChangedButtonProps) {
  if (attributed) {
    return (
      <span className="text-caption text-accent flex items-center gap-1">
        <CheckIcon size="xs" className="text-accent" animate="mount" />
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
      <LightBulbIcon 
        size="xs" 
        className="opacity-0 group-hover:opacity-100 transition-opacity" 
        animate="click"
      />
      This changed my mind
    </button>
  );
}

function getSideConfig(side: 'support' | 'oppose'): { 
  label: string; 
  color: string; 
} {
  if (side === 'support') {
    return { 
      label: 'For', 
      color: 'text-support',
    };
  }
  return { 
    label: 'Against', 
    color: 'text-oppose',
  };
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
