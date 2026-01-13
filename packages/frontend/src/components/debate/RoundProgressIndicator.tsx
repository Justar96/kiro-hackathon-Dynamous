/**
 * RoundProgressIndicator displays compact debate progress with clickable round steps.
 * Combines progress info and navigation into a single inline element.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.2
 */

import type { Round, RoundNumber } from '@debate-platform/shared';
import type { RoundStep } from './RoundSection.types';
import { deriveRoundStates, canNavigateToRound } from './RoundSection.utils';

export interface RoundProgressIndicatorProps {
  currentRound: RoundNumber;
  currentTurn: 'support' | 'oppose';
  debateStatus: 'pending' | 'active' | 'concluded';
  viewedRound: RoundNumber;
  rounds: Round[];
  onRoundSelect?: (round: RoundNumber) => void;
}

const ROUND_LABELS = ['Opening', 'Rebuttal', 'Closing'] as const;

export function RoundProgressIndicator({
  currentRound,
  currentTurn,
  debateStatus,
  viewedRound,
  rounds,
  onRoundSelect,
}: RoundProgressIndicatorProps) {
  const roundSteps = deriveRoundStates(
    { currentRound, status: debateStatus } as Parameters<typeof deriveRoundStates>[0],
    rounds,
    viewedRound
  );

  const turnLabel = currentTurn === 'support' ? 'For' : 'Against';
  const isActive = debateStatus === 'active';

  return (
    <div className="flex items-center gap-3 text-sm">
      {/* Compact round stepper */}
      <div className="flex items-center gap-1" role="tablist" aria-label="Debate rounds">
        {roundSteps.map((step, idx) => {
          const isNavigable = canNavigateToRound(step.roundNumber, rounds, currentRound);
          const isViewing = viewedRound === step.roundNumber;
          
          return (
            <button
              key={step.roundNumber}
              role="tab"
              aria-selected={isViewing}
              aria-label={`${ROUND_LABELS[idx]}: ${getStateLabel(step.state)}`}
              disabled={!isNavigable}
              onClick={() => isNavigable && onRoundSelect?.(step.roundNumber)}
              className={`
                px-2.5 py-1 rounded-full text-xs font-medium transition-all
                ${isViewing 
                  ? getActiveStyles(step.state)
                  : isNavigable 
                    ? 'text-text-tertiary hover:text-text-secondary hover:bg-gray-100 cursor-pointer'
                    : 'text-text-tertiary/40 cursor-not-allowed'
                }
              `}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Current status */}
      <span className="text-text-tertiary">·</span>
      <span className="text-text-secondary">
        {ROUND_LABELS[viewedRound - 1]}
      </span>
      
      {isActive && viewedRound === currentRound && (
        <>
          <span className="text-text-tertiary">·</span>
          <span className={`font-medium ${currentTurn === 'support' ? 'text-support' : 'text-oppose'}`}>
            {turnLabel}'s turn
          </span>
        </>
      )}
    </div>
  );
}

function getActiveStyles(state: RoundStep['state']): string {
  switch (state) {
    case 'completed':
      return 'bg-green-100 text-green-700';
    case 'active':
      return 'bg-accent/10 text-accent';
    case 'viewing-history':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-gray-100 text-text-secondary';
  }
}

function getStateLabel(state: RoundStep['state']): string {
  switch (state) {
    case 'completed': return 'Completed';
    case 'active': return 'Active';
    case 'viewing-history': return 'Viewing';
    default: return 'Pending';
  }
}

export default RoundProgressIndicator;
