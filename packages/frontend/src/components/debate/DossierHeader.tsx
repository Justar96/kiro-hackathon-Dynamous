import type { Debate } from '@debate-platform/shared';

interface DossierHeaderProps {
  debate: Debate;
  tags?: string[];
}

/**
 * DossierHeader displays the resolution as a serif heading with status indicator.
 * Follows the paper-clean dossier aesthetic with calm typography.
 * Requirements: 10.1
 */
export function DossierHeader({ debate, tags = [] }: DossierHeaderProps) {
  const statusConfig = getStatusConfig(debate.status, debate.currentRound);
  
  return (
    <header className="mb-6 pb-4 border-b border-gray-100" id="resolution">
      {/* Status indicator - tiny caps */}
      <div className="mb-2">
        <span className={`text-label uppercase tracking-wider ${statusConfig.color}`}>
          {statusConfig.label}
        </span>
      </div>
      
      {/* Resolution as serif heading */}
      <h1 className="font-heading text-heading-1 text-text-primary mb-2">
        {debate.resolution}
      </h1>
      
      {/* Subtitle with date */}
      <p className="text-body-small text-text-secondary">
        Started {formatDate(debate.createdAt)}
        {debate.concludedAt && (
          <> · Concluded {formatDate(debate.concludedAt)}</>
        )}
      </p>
      
      {/* Muted tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tags.map((tag, index) => (
            <span 
              key={index}
              className="px-2 py-0.5 text-caption text-text-tertiary bg-gray-50 rounded-subtle"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
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

export default DossierHeader;
