/**
 * RoundNavigator provides a horizontal stepper/tab interface for switching between rounds.
 * Renders three tabs (Opening, Rebuttal, Closing) with visual states and navigation controls.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.1
 */

import { useRef, useCallback, useState, type TouchEvent } from 'react';
import type { RoundNavigatorProps, RoundStep } from './RoundSection.types';
import { deriveRoundStates, canNavigateToRound } from './RoundSection.utils';

// Swipe threshold in pixels to trigger navigation
const SWIPE_THRESHOLD = 50;

/**
 * Horizontal stepper navigation for switching between debate rounds.
 * Shows visual states for each round and handles navigation clicks.
 * On mobile, supports swipe gestures for navigation (Requirement 6.1).
 */
export function RoundNavigator({
  rounds,
  currentRound,
  viewedRound,
  onRoundSelect,
}: RoundNavigatorProps) {
  // Create a minimal debate object for deriveRoundStates
  const debateState = { currentRound, status: 'active' as const };
  const roundSteps = deriveRoundStates(debateState as any, rounds, viewedRound);

  // Touch/swipe state for mobile navigation
  const touchRef = useRef({ startX: 0, startY: 0 });
  const [isSwiping, setIsSwiping] = useState(false);

  const handleRoundClick = (roundNumber: 1 | 2 | 3) => {
    if (canNavigateToRound(roundNumber, rounds, currentRound)) {
      onRoundSelect(roundNumber);
    }
  };

  // Handle touch start for swipe detection
  const handleTouchStart = useCallback((e: TouchEvent<HTMLElement>) => {
    const touch = e.touches[0];
    touchRef.current = { startX: touch.clientX, startY: touch.clientY };
    setIsSwiping(true);
  }, []);

  // Handle touch end for swipe navigation
  const handleTouchEnd = useCallback((e: TouchEvent<HTMLElement>) => {
    if (!isSwiping) return;
    setIsSwiping(false);

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchRef.current.startX;
    const deltaY = touch.clientY - touchRef.current.startY;

    // Only trigger if horizontal swipe is dominant
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
      if (deltaX < 0) {
        // Swipe left - go to next round
        const nextRound = Math.min(viewedRound + 1, 3) as 1 | 2 | 3;
        if (canNavigateToRound(nextRound, rounds, currentRound)) {
          onRoundSelect(nextRound);
        }
      } else {
        // Swipe right - go to previous round
        const prevRound = Math.max(viewedRound - 1, 1) as 1 | 2 | 3;
        if (canNavigateToRound(prevRound, rounds, currentRound)) {
          onRoundSelect(prevRound);
        }
      }
    }
  }, [isSwiping, viewedRound, rounds, currentRound, onRoundSelect]);

  return (
    <nav 
      className="flex items-center border-b border-gray-200"
      role="tablist"
      aria-label="Debate rounds"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {roundSteps.map((step, index) => {
        const isNavigable = canNavigateToRound(step.roundNumber, rounds, currentRound);
        const isSelected = viewedRound === step.roundNumber;
        
        return (
          <RoundTab
            key={step.roundNumber}
            step={step}
            isSelected={isSelected}
            isNavigable={isNavigable}
            showConnector={index < roundSteps.length - 1}
            onClick={() => handleRoundClick(step.roundNumber)}
          />
        );
      })}
    </nav>
  );
}

interface RoundTabProps {
  step: RoundStep;
  isSelected: boolean;
  isNavigable: boolean;
  showConnector: boolean;
  onClick: () => void;
}

/**
 * Individual tab for a single round in the navigator.
 * Uses compact styling on mobile (Requirement 6.1).
 */
function RoundTab({ 
  step, 
  isSelected, 
  isNavigable, 
  showConnector,
  onClick 
}: RoundTabProps) {
  const styles = getTabStyles(step.state, isSelected, isNavigable);
  
  return (
    <div className="flex items-center flex-1">
      <button
        role="tab"
        aria-selected={isSelected}
        aria-disabled={!isNavigable}
        tabIndex={isSelected ? 0 : -1}
        disabled={!isNavigable}
        onClick={onClick}
        className={`
          flex-1 flex items-center justify-center gap-1.5 sm:gap-2 
          py-2.5 sm:py-3 px-2 sm:px-4
          text-body font-medium transition-colors relative
          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset
          min-h-[44px]
          ${styles.button}
        `}
      >
        {/* State indicator dot */}
        <span 
          className={`w-2 h-2 rounded-full flex-shrink-0 ${styles.dot}`}
          aria-hidden="true"
        />
        
        {/* Round label - abbreviated on mobile */}
        <span className={`${styles.label} hidden sm:inline`}>
          {step.label}
        </span>
        {/* Mobile abbreviated label */}
        <span className={`${styles.label} sm:hidden text-sm`}>
          {getMobileLabel(step.label)}
        </span>
        
        {/* Selected indicator bar */}
        {isSelected && (
          <span 
            className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
            aria-hidden="true"
          />
        )}
      </button>
      
      {/* Connector line between tabs - hidden on mobile for cleaner look */}
      {showConnector && (
        <div 
          className={`hidden sm:block w-8 h-0.5 flex-shrink-0 ${styles.connector}`}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/**
 * Gets abbreviated label for mobile display.
 */
function getMobileLabel(label: string): string {
  const mobileLabels: Record<string, string> = {
    'Opening': 'Open',
    'Rebuttal': 'Rebut',
    'Closing': 'Close',
  };
  return mobileLabels[label] || label;
}

/**
 * Gets the CSS classes for a tab based on its state and selection.
 */
function getTabStyles(
  state: RoundStep['state'],
  isSelected: boolean,
  isNavigable: boolean
): { button: string; dot: string; label: string; connector: string } {
  // Base styles for disabled/unavailable tabs
  if (!isNavigable) {
    return {
      button: 'cursor-not-allowed opacity-50',
      dot: 'bg-gray-300',
      label: 'text-text-tertiary',
      connector: 'bg-gray-200',
    };
  }

  // Selected tab styles
  if (isSelected) {
    return {
      button: 'cursor-pointer hover:bg-gray-50',
      dot: state === 'completed' ? 'bg-green-500' : 
           state === 'active' ? 'bg-blue-500' : 
           state === 'viewing-history' ? 'bg-amber-500' : 'bg-gray-400',
      label: 'text-blue-600',
      connector: state === 'completed' ? 'bg-green-300' : 'bg-gray-200',
    };
  }

  // Unselected but navigable tab styles based on state
  switch (state) {
    case 'completed':
      return {
        button: 'cursor-pointer hover:bg-gray-50',
        dot: 'bg-green-500',
        label: 'text-green-600',
        connector: 'bg-green-300',
      };
    case 'active':
      return {
        button: 'cursor-pointer hover:bg-gray-50',
        dot: 'bg-blue-500 ring-2 ring-blue-200',
        label: 'text-text-primary',
        connector: 'bg-gray-200',
      };
    case 'viewing-history':
      return {
        button: 'cursor-pointer hover:bg-gray-50',
        dot: 'bg-amber-500',
        label: 'text-amber-600',
        connector: 'bg-amber-300',
      };
    case 'pending':
    default:
      return {
        button: 'cursor-pointer hover:bg-gray-50',
        dot: 'bg-gray-300',
        label: 'text-text-tertiary',
        connector: 'bg-gray-200',
      };
  }
}

export default RoundNavigator;
