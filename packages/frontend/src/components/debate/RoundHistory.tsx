/**
 * RoundHistory displays a collapsed/expandable summary of completed rounds.
 * Shows truncated excerpts of arguments and allows navigation to full round views.
 * On mobile, uses a bottom sheet for better UX (Requirement 6.3).
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.2, 6.3, 6.4
 */

import type { RoundHistoryProps, RoundSummary } from './RoundSection.types';
import { generateExcerpt, getRoundLabel } from './RoundSection.utils';
import { BottomSheet } from '../common/BottomSheet';
import { useIsMobile } from '../common/hooks';

// Inline SVG icons
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/**
 * Collapsible history view of completed rounds.
 * Hidden when no history exists (Round 1).
 * Uses bottom sheet on mobile for better UX (Requirement 6.3).
 */
export function RoundHistory({
  completedRounds,
  supportDebater,
  opposeDebater,
  arguments: roundArguments,
  expanded,
  onToggle,
  onRoundClick,
}: RoundHistoryProps) {
  const isMobile = useIsMobile();
  
  // Hide when no history exists (Requirement 4.5)
  if (completedRounds.length === 0) {
    return null;
  }

  // Build summaries for completed rounds
  const summaries: RoundSummary[] = completedRounds.map((round) => {
    const args = roundArguments?.[round.roundNumber];
    return {
      roundNumber: round.roundNumber,
      roundType: round.roundType,
      supportExcerpt: generateExcerpt(args?.support?.content || '', 100),
      opposeExcerpt: generateExcerpt(args?.oppose?.content || '', 100),
      completedAt: round.completedAt ? new Date(round.completedAt) : new Date(),
    };
  });

  // Handle round click and close bottom sheet on mobile
  const handleRoundClick = (roundNumber: 1 | 2 | 3) => {
    onRoundClick(roundNumber);
    if (isMobile && expanded) {
      onToggle(); // Close bottom sheet after selection
    }
  };

  // Render content for both desktop and mobile
  const historyContent = (
    <div className={isMobile ? '' : 'border-t border-gray-100'}>
      {summaries.map((summary) => (
        <RoundSummaryCard
          key={summary.roundNumber}
          summary={summary}
          supportDebaterName={supportDebater?.username}
          opposeDebaterName={opposeDebater?.username}
          onClick={() => handleRoundClick(summary.roundNumber)}
        />
      ))}
    </div>
  );

  // Mobile: Use bottom sheet (Requirement 6.3)
  if (isMobile) {
    return (
      <>
        {/* Compact trigger button for mobile */}
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-gray-200 rounded-subtle hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-h-[44px]"
          aria-expanded={expanded}
          aria-controls="round-history-sheet"
        >
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
            <span className="text-sm font-medium text-text-primary">
              Previous ({completedRounds.length})
            </span>
          </div>
          <ChevronUpIcon className="w-4 h-4 text-text-tertiary" />
        </button>

        {/* Bottom sheet for expanded content */}
        <BottomSheet
          isOpen={expanded}
          onClose={onToggle}
          snapPoints={[50, 75]}
          initialSnap={0}
          ariaLabelledBy="round-history-title"
        >
          <div id="round-history-sheet">
            <h3 
              id="round-history-title" 
              className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2"
            >
              <CheckCircleIcon className="w-5 h-5 text-green-500" />
              Previous Rounds
            </h3>
            {historyContent}
          </div>
        </BottomSheet>
      </>
    );
  }

  // Desktop: Standard expandable section
  return (
    <div className="border border-gray-200 rounded-subtle bg-white overflow-hidden">
      {/* Collapsed header - always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
        aria-expanded={expanded}
        aria-controls="round-history-content"
      >
        <div className="flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 text-green-500" />
          <span className="text-body font-medium text-text-primary">
            Previous Rounds ({completedRounds.length})
          </span>
        </div>
        {expanded ? (
          <ChevronUpIcon className="w-5 h-5 text-text-tertiary" />
        ) : (
          <ChevronDownIcon className="w-5 h-5 text-text-tertiary" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div id="round-history-content">
          {historyContent}
        </div>
      )}
    </div>
  );
}

interface RoundSummaryCardProps {
  summary: RoundSummary;
  supportDebaterName?: string;
  opposeDebaterName?: string;
  onClick: () => void;
}

/**
 * Individual summary card for a completed round.
 * Shows round type, truncated excerpts, and completion status.
 * Uses full-width layout on mobile (Requirement 6.4).
 */
function RoundSummaryCard({
  summary,
  supportDebaterName,
  opposeDebaterName,
  onClick,
}: RoundSummaryCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 sm:px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset min-h-[44px]"
    >
      {/* Round header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm sm:text-body font-medium text-text-primary">
          {getRoundLabel(summary.roundType)}
        </span>
        <span className="text-xs sm:text-label text-green-600 flex items-center gap-1">
          <CheckCircleIcon className="w-3 h-3" />
          <span className="hidden sm:inline">Completed</span>
        </span>
      </div>

      {/* Argument excerpts */}
      <div className="space-y-2">
        {/* Support excerpt */}
        {summary.supportExcerpt && (
          <ArgumentExcerpt
            side="support"
            debaterName={supportDebaterName}
            excerpt={summary.supportExcerpt}
          />
        )}

        {/* Oppose excerpt */}
        {summary.opposeExcerpt && (
          <ArgumentExcerpt
            side="oppose"
            debaterName={opposeDebaterName}
            excerpt={summary.opposeExcerpt}
          />
        )}
      </div>
    </button>
  );
}

interface ArgumentExcerptProps {
  side: 'support' | 'oppose';
  debaterName?: string;
  excerpt: string;
}

/**
 * Truncated excerpt of an argument with side indicator.
 * Responsive text sizing for mobile (Requirement 6.4).
 */
function ArgumentExcerpt({ side, debaterName, excerpt }: ArgumentExcerptProps) {
  const sideStyles = side === 'support' 
    ? 'border-l-green-500 bg-green-50/50' 
    : 'border-l-red-500 bg-red-50/50';
  
  const sideLabel = side === 'support' ? 'Support' : 'Oppose';
  
  return (
    <div className={`pl-2 sm:pl-3 py-1 sm:py-1.5 border-l-2 rounded-r-sm ${sideStyles}`}>
      <div className="text-xs sm:text-label text-text-tertiary mb-0.5">
        {debaterName || sideLabel}
      </div>
      <div className="text-sm sm:text-body text-text-secondary line-clamp-2">
        {excerpt || <span className="italic">No argument submitted</span>}
      </div>
    </div>
  );
}

export default RoundHistory;
