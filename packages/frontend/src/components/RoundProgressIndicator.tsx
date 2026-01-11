/**
 * RoundProgressIndicator displays the current debate progress and turn information.
 * Shows "Round X of 3" with current turn indicator and visual states for each round step.
 * Stays visible without scrolling on mobile (Requirement 6.2).
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.2
 */

import type { RoundProgressIndicatorProps, RoundStep } from './UnifiedRoundSection.types';
import { deriveRoundStates, getProgressText } from './UnifiedRoundSection.utils';

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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 py-2.5 sm:py-3 px-3 sm:px-4 bg-gray-50 rounded-subtle border border-gray-100">
      {/* Progress text */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm sm:text-body font-medium text-text-primary truncate">
          {progressText}
        </span>
        {isViewingHistory && (
          <span className="text-xs sm:text-label text-text-tertiary bg-gray-100 px-1.5 sm:px-2 py-0.5 rounded flex-shrink-0">
            History
          </span>
        )}
      </div>
      
      {/* Round step indicators */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {roundSteps.map((step) => (
          <RoundStepIndicator key={step.roundNumber} step={step} />
        ))}
      </div>
    </div>
  );
}

interface RoundStepIndicatorProps {
  step: RoundStep;
}

/**
 * Individual step indicator showing the state of a single round.
 * Compact on mobile with abbreviated labels.
 */
function RoundStepIndicator({ step }: RoundStepIndicatorProps) {
  const stateStyles = getStepStateStyles(step.state);
  
  return (
    <div 
      className="flex items-center gap-1 sm:gap-1.5"
      title={`${step.label}: ${getStateLabel(step.state)}`}
    >
      {/* Step dot/icon */}
      <div 
        className={`w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full transition-colors ${stateStyles.dot}`}
        aria-hidden="true"
      />
      {/* Step label (abbreviated on mobile, hidden on very small screens) */}
      <span className={`text-xs sm:text-label hidden xs:inline ${stateStyles.label}`}>
        {getMobileStepLabel(step.label)}
      </span>
    </div>
  );
}

/**
 * Gets abbreviated step label for mobile display.
 */
function getMobileStepLabel(label: string): string {
  // On small screens, use first letter only
  // This is handled by CSS, but we provide abbreviated versions
  const abbreviated: Record<string, string> = {
    'Opening': 'O',
    'Rebuttal': 'R',
    'Closing': 'C',
  };
  return abbreviated[label] || label.charAt(0);
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
