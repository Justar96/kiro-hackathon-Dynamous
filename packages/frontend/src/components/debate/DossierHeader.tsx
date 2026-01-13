import type { Debate } from '@debate-platform/shared';
import { HorizontalDivider } from '../ui/HorizontalDivider';

interface DossierHeaderProps {
  debate: Debate;
  tags?: string[];
  /** Optional word count for reading time estimation */
  wordCount?: number;
}

/**
 * DossierHeader displays the resolution as a serif heading with status indicator.
 * Follows the paper-clean dossier aesthetic with calm typography.
 * 
 * Requirements: 1.1, 3.1, 4.1, 4.2, 4.4, 4.5
 */
export function DossierHeader({ debate, tags = [], wordCount }: DossierHeaderProps) {
  const statusConfig = getStatusConfig(debate.status, debate.currentRound);
  const readingTime = wordCount ? estimateReadingTime(wordCount) : null;
  
  return (
    <header id="resolution">
      {/* Status indicator - small-caps styling with letter-spacing */}
      <div className="mb-3">
        <span className={`small-caps text-label tracking-wide ${statusConfig.color}`}>
          {statusConfig.label}
        </span>
      </div>
      
      {/* Resolution as larger serif heading (2.25rem) */}
      <h1 className="font-heading text-[2.25rem] leading-[1.25] font-semibold text-text-primary mb-4">
        {debate.resolution}
      </h1>
      
      {/* Metadata row with refined typography and letter-spacing */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-small text-text-secondary">
        {/* Date display with refined styling */}
        <span className="tracking-wide">
          {formatDate(debate.createdAt)}
        </span>
        
        {debate.concludedAt && (
          <>
            <span className="text-divider">·</span>
            <span className="tracking-wide">
              Concluded {formatDate(debate.concludedAt)}
            </span>
          </>
        )}
        
        {/* Optional word count / reading time */}
        {readingTime && (
          <>
            <span className="text-divider">·</span>
            <span className="monospace-label text-text-tertiary">
              {readingTime}
            </span>
          </>
        )}
      </div>
      
      {/* Muted tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4">
          {tags.map((tag, index) => (
            <span 
              key={index}
              className="px-2 py-0.5 text-caption text-text-tertiary bg-gray-50 rounded-subtle tracking-wide"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      
      {/* Subtle horizontal divider below header */}
      <HorizontalDivider spacing="lg" className="mt-6" />
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
