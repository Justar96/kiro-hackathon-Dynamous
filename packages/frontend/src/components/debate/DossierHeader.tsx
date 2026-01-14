import type { Debate } from '@debate-platform/shared';

interface DossierHeaderProps {
  debate: Debate;
  tags?: string[];
  /** Optional word count for reading time estimation */
  wordCount?: number;
}

/**
 * DossierHeader displays the resolution as an inline heading with status indicator.
 * Follows the paper-clean dossier aesthetic with calm typography.
 * 
 * Requirements: 1.1, 3.1, 4.1, 4.2, 4.4, 4.5
 */
export function DossierHeader({ debate, tags = [], wordCount }: DossierHeaderProps) {
  const statusConfig = getStatusConfig(debate.status, debate.currentRound);
  const readingTime = wordCount ? estimateReadingTime(wordCount) : null;
  
  return (
    <header id="resolution" className="mb-5">
      {/* Single line with everything */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {/* Resolution first */}
        <h1 className="font-heading text-sm font-semibold text-text-primary">
          {debate.resolution}
        </h1>
        
        <span className="text-sm text-divider">·</span>
        
        {/* Status indicator */}
        <span className={`small-caps text-sm tracking-wide ${statusConfig.color}`}>
          {statusConfig.label}
        </span>
        
        <span className="text-sm text-divider">·</span>
        
        {/* Date */}
        <span className="text-sm text-text-secondary tracking-wide">
          {formatDate(debate.createdAt)}
        </span>
        
        {debate.concludedAt && (
          <>
            <span className="text-sm text-divider">·</span>
            <span className="text-sm text-text-secondary tracking-wide">
              Concluded {formatDate(debate.concludedAt)}
            </span>
          </>
        )}
        
        {/* Optional word count / reading time */}
        {readingTime && (
          <>
            <span className="text-sm text-divider">·</span>
            <span className="text-sm monospace-label text-text-tertiary">
              {readingTime}
            </span>
          </>
        )}
        
        {/* Inline tags */}
        {tags.length > 0 && (
          <>
            <span className="text-sm text-divider">·</span>
            {tags.map((tag, index) => (
              <span key={index}>
                <span className="text-sm text-text-tertiary">{tag}</span>
                {index < tags.length - 1 && <span className="text-sm text-divider ml-1">,</span>}
              </span>
            ))}
          </>
        )}
      </div>
    </header>
  );
}

function getStatusConfig(status: Debate['status'], currentRound: number): { label: string; color: string } {
  if (status === 'concluded') {
    return { label: 'Resolved', color: 'text-text-tertiary' };
  }
  
  // Active debate - show current round
  const roundLabels: Record<number, string> = {
    1: 'Open · Round 1',
    2: 'Open · Round 2', 
    3: 'Open · Round 3',
  };
  
  return { 
    label: roundLabels[currentRound] || 'Open',
    color: 'text-accent'
  };
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Estimate reading time based on word count
 * Uses average reading speed of 200 words per minute
 */
function estimateReadingTime(wordCount: number): string {
  const minutes = Math.ceil(wordCount / 200);
  if (minutes < 1) {
    return '< 1 min read';
  }
  return `${minutes} min read`;
}

export default DossierHeader;
