/**
 * RoundProgressIndicator displays the current debate progress and turn information.
 * Shows "Round X of 3" with current turn indicator and visual states for each round step.
 * Stays visible without scrolling on mobile (Requirement 6.2).
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.2
 */

import type { RoundProgressIndicatorProps, RoundStep } from './RoundSection.types';
import { deriveRoundStates, getProgressText } from './RoundSection.utils';

/**
 * Visual indicator showing debate progress through rounds.
 * Displays current round number, turn indicator, and step states.
 * Uses compact layout on mobile to stay visible (Requirement 6.2).
 */
export function RoundProgressIndicator({
  currentRound,
  currentTurn,
  debateStatus,
  viewedRound,
  rounds,
}: RoundProgressIndicatorProps) {
  const roundSteps = deriveRoundStates(
    { currentRound, status: debateStatus } as Parameters<typeof deriveRoundStates>[0],
    rounds,
    viewedRound
  );
  
  const isViewingHistory = viewedRound !== currentRound && 
    rounds[viewedRound - 1]?.completedAt !== null;
  
  const progressText = getProgressText(
    currentRound,
    currentTurn,
    debateStatus,
    isViewingHistory
  );

  return (
    <div className="flex items-center justify-between px-5 py-3 bg-gray-50/50">
      {/* Progress text */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium text-text-primary">
          {progressText}
        </span>
        {isViewingHistory && (
          <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
            Viewing history
          </span>
        )}
      </div>
      
      {/* Round step indicators - minimal dots */}
      <div className="flex items-center gap-3">
        {roundSteps.map((step, index) => (
          <RoundStepIndicator 
            key={step.roundNumber} 
            step={step} 
            showLabel={index === roundSteps.findIndex(s => s.state === 'active' || s.state === 'viewing-history')}
          />
        ))}
      </div>
    </div>
  );
}

interface RoundStepIndicatorProps {
  step: RoundStep;
  showLabel?: boolean;
}

/**
 * Individual step indicator showing the state of a single round.
 * Compact on mobile with abbreviated labels.
 */
function RoundStepIndicator({ step, showLabel = false }: RoundStepIndicatorProps) {
  const stateStyles = getStepStateStyles(step.state);
  
  return (
    <div 
      className="flex items-center gap-1.5"
      title={`${step.label}: ${getStateLabel(step.state)}`}
    >
      {/* Step dot/icon */}
      <div 
        className={`w-2.5 h-2.5 rounded-full transition-all ${stateStyles.dot}`}
        aria-hidden="true"
      />
      {/* Step label - only show for active step */}
      {showLabel && (
        <span className={`text-xs font-medium ${stateStyles.label}`}>
          {step.label}
        </span>
      )}
    </div>
  );
}

/**
 * Gets the CSS classes for a step based on its state.
 */
function getStepStateStyles(state: RoundStep['state']): { dot: string; label: string } {
  switch (state) {
    case 'completed':
      return {
        dot: 'bg-green-500',
        label: 'text-green-600',
      };
    case 'active':
      return {
        dot: 'bg-blue-500 ring-2 ring-blue-200',
        label: 'text-blue-600 font-medium',
      };
    case 'viewing-history':
      return {
        dot: 'bg-amber-500',
        label: 'text-amber-600',
      };
    case 'pending':
    default:
      return {
        dot: 'bg-gray-300',
        label: 'text-text-tertiary',
      };
  }
}

/**
 * Gets a human-readable label for a step state.
 */
function getStateLabel(state: RoundStep['state']): string {
  switch (state) {
    case 'completed':
      return 'Completed';
    case 'active':
      return 'Active';
    case 'viewing-history':
      return 'Viewing';
    case 'pending':
    default:
      return 'Pending';
  }
}

export default RoundProgressIndicator;
