/**
 * CompactProgressBar displays debate progress in a single compact line.
 * Replaces both RoundProgressIndicator and RoundNavigator with clickable round dots.
 * 
 * Requirements: 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 4.1, 4.2, 4.3, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.3, 6.5
 */

import { useCallback, useRef, useState, useEffect, type TouchEvent, type KeyboardEvent } from 'react';
import type { Round, RoundNumber, Side } from '@thesis/shared';

// ============================================
// Types
// ============================================

export type RoundDotState = 'pending' | 'active' | 'completed' | 'viewing';

export interface CompactProgressBarProps {
  /** Current active round in the debate */
  currentRound: RoundNumber;
  /** Which side's turn it is */
  currentTurn: Side;
  /** Overall debate status */
  debateStatus: 'seeking_opponent' | 'active' | 'concluded';
  /** Which round the user is viewing */
  viewedRound: RoundNumber;
  /** Round data for determining accessibility */
  rounds: Round[];
  /** Whether the current user can submit (for turn highlighting) */
  isUserTurn?: boolean;
  /** Whether the user can submit an argument (correct side, their turn, no existing argument) */
  canSubmitArgument?: boolean;
  /** Argument counts per round for activity indicators */
  argumentCounts?: { [roundNumber: number]: number };
  /** Winner side when debate is concluded */
  winnerSide?: 'support' | 'oppose' | 'tie' | null;
  /** Callback when user selects a round */
  onRoundSelect: (round: RoundNumber) => void;
  /** Callback when user clicks the submission CTA */
  onSubmitClick?: () => void;
}

export interface RoundDotProps {
  roundNumber: RoundNumber;
  state: RoundDotState;
  isNavigable: boolean;
  isSelected: boolean;
  onClick: () => void;
}

// Swipe threshold in pixels
const SWIPE_THRESHOLD = 50;

// ============================================
// State Derivation Functions
// ============================================

/**
 * Derives the visual state for a round dot.
 */
export function deriveRoundDotState(
  roundNumber: RoundNumber,
  round: Round | undefined,
  currentRound: RoundNumber,
  viewedRound: RoundNumber,
  debateStatus: string
): RoundDotState {
  // Viewing a historical round (not the current one)
  if (viewedRound === roundNumber && roundNumber !== currentRound && round?.completedAt !== null) {
    return 'viewing';
  }
  // Completed round
  if (round?.completedAt !== null) {
    return 'completed';
  }
  // Active round
  if (roundNumber === currentRound && debateStatus === 'active') {
    return 'active';
  }
  // Pending (future) round
  return 'pending';
}

/**
 * Determines if a round is navigable (clickable).
 */
export function isRoundNavigable(
  roundNumber: RoundNumber,
  rounds: Round[],
  currentRound: RoundNumber
): boolean {
  // Can always navigate to current round
  if (roundNumber === currentRound) return true;
  
  const round = rounds[roundNumber - 1];
  if (!round) return false;
  
  // Can navigate to completed rounds
  if (round.completedAt !== null) return true;
  
  // Can navigate to rounds with at least one argument
  return round.supportArgumentId !== null || round.opposeArgumentId !== null;
}

/**
 * Generates progress text based on debate state.
 */
export function getCompactProgressText(
  currentRound: RoundNumber,
  currentTurn: Side,
  debateStatus: string,
  isMobile: boolean,
  winnerSide?: 'support' | 'oppose' | 'tie' | null
): string {
  if (debateStatus === 'concluded') {
    if (winnerSide === 'support') {
      return isMobile ? 'Support Won' : 'Support Won the Debate';
    }
    if (winnerSide === 'oppose') {
      return isMobile ? 'Oppose Won' : 'Oppose Won the Debate';
    }
    if (winnerSide === 'tie') {
      return isMobile ? 'Tie' : 'Debate Ended in a Tie';
    }
    return isMobile ? 'Concluded' : 'Debate Concluded';
  }
  if (debateStatus === 'seeking_opponent') {
    return isMobile ? 'Seeking...' : 'Seeking Opponent';
  }
  
  const turnLabel = currentTurn === 'support' ? 'Support' : 'Oppose';
  
  if (isMobile) {
    return `R${currentRound} · ${turnLabel}`;
  }
  return `Round ${currentRound} · ${turnLabel}'s turn`;
}

// ============================================
// RoundDot Component
// ============================================

/**
 * Individual clickable dot representing a round's state.
 * Requirements: 2.4, 2.5, 4.2, 4.3, 5.3
 */
export function RoundDot({ 
  roundNumber, 
  state, 
  isNavigable, 
  isSelected,
  onClick 
}: RoundDotProps) {
  // Visual dot styling (12px visual size)
  const dotClasses = 'w-3 h-3 rounded-full transition-all duration-200';
  
  // State-based styling
  const stateClasses = getStateClasses(state, isNavigable, isSelected);
  
  // Hover/focus classes for navigable dots
  const interactiveClasses = isNavigable 
    ? 'cursor-pointer group-hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1' 
    : 'cursor-not-allowed opacity-50';

  return (
    // Outer button provides 44px touch target (Requirement 5.3)
    <button
      type="button"
      onClick={isNavigable ? onClick : undefined}
      disabled={!isNavigable}
      aria-label={`Round ${roundNumber}${state === 'completed' ? ' (completed)' : state === 'active' ? ' (active)' : state === 'viewing' ? ' (viewing)' : ''}`}
      aria-current={isSelected ? 'step' : undefined}
      className="group flex items-center justify-center flex-shrink-0 touch-manipulation"
      style={{ minWidth: '44px', minHeight: '44px' }}
      data-testid={`round-dot-${roundNumber}`}
      data-state={state}
      data-navigable={isNavigable}
    >
      {/* Inner visual dot */}
      <span className={`${dotClasses} ${stateClasses} ${interactiveClasses}`} />
    </button>
  );
}

/**
 * Gets CSS classes based on dot state.
 */
function getStateClasses(state: RoundDotState, isNavigable: boolean, isSelected: boolean): string {
  if (!isNavigable) {
    return 'bg-gray-200';
  }
  
  switch (state) {
    case 'completed':
      return isSelected 
        ? 'bg-green-500 ring-2 ring-green-200' 
        : 'bg-green-400';
    case 'active':
      // Pulse animation for active round
      return isSelected
        ? 'bg-accent ring-2 ring-accent/30 animate-pulse'
        : 'bg-accent ring-2 ring-accent/20 animate-pulse';
    case 'viewing':
      return 'bg-amber-500 ring-2 ring-amber-200';
    case 'pending':
    default:
      return 'bg-gray-300';
  }
}

// ============================================
// CompactProgressBar Component
// ============================================

/**
 * Compact single-line progress bar with clickable round dots.
 * Requirements: 2.1, 2.2, 2.3, 2.7, 6.3, 6.4, 6.5
 */
export function CompactProgressBar({
  currentRound,
  currentTurn,
  debateStatus,
  viewedRound,
  rounds,
  isUserTurn = false,
  canSubmitArgument = false,
  argumentCounts,
  winnerSide,
  onRoundSelect,
  onSubmitClick,
}: CompactProgressBarProps) {
  // Mobile detection with resize observer
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 640
  );
  
  // Update mobile state on resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Touch/swipe state for mobile navigation
  const touchRef = useRef({ startX: 0, startY: 0 });
  const [isSwiping, setIsSwiping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if viewing history
  const isViewingHistory = viewedRound !== currentRound && 
    rounds[viewedRound - 1]?.completedAt !== null;

  // Generate progress text
  const progressText = getCompactProgressText(currentRound, currentTurn, debateStatus, isMobile, winnerSide);

  // Calculate total argument count for activity indicator
  const totalArgumentCount = argumentCounts 
    ? Object.values(argumentCounts).reduce((sum, count) => sum + count, 0)
    : 0;

  // Handle round dot click
  const handleRoundClick = useCallback((roundNumber: RoundNumber) => {
    if (isRoundNavigable(roundNumber, rounds, currentRound)) {
      onRoundSelect(roundNumber);
    }
  }, [rounds, currentRound, onRoundSelect]);

  // Handle touch start for swipe detection (Requirement 5.4)
  const handleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    touchRef.current = { startX: touch.clientX, startY: touch.clientY };
    setIsSwiping(true);
  }, []);

  // Handle touch end for swipe navigation
  const handleTouchEnd = useCallback((e: TouchEvent<HTMLDivElement>) => {
    if (!isSwiping) return;
    setIsSwiping(false);

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchRef.current.startX;
    const deltaY = touch.clientY - touchRef.current.startY;

    // Only trigger if horizontal swipe is dominant
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
      if (deltaX < 0) {
        // Swipe left - go to next round
        const nextRound = Math.min(viewedRound + 1, 3) as RoundNumber;
        if (isRoundNavigable(nextRound, rounds, currentRound)) {
          onRoundSelect(nextRound);
        }
      } else {
        // Swipe right - go to previous round
        const prevRound = Math.max(viewedRound - 1, 1) as RoundNumber;
        if (isRoundNavigable(prevRound, rounds, currentRound)) {
          onRoundSelect(prevRound);
        }
      }
    }
  }, [isSwiping, viewedRound, rounds, currentRound, onRoundSelect]);

  // Handle keyboard navigation (Requirement 4.5)
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      // Find previous navigable round
      for (let r = viewedRound - 1; r >= 1; r--) {
        const roundNum = r as RoundNumber;
        if (isRoundNavigable(roundNum, rounds, currentRound)) {
          onRoundSelect(roundNum);
          break;
        }
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      // Find next navigable round
      for (let r = viewedRound + 1; r <= 3; r++) {
        const roundNum = r as RoundNumber;
        if (isRoundNavigable(roundNum, rounds, currentRound)) {
          onRoundSelect(roundNum);
          break;
        }
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      // Jump to first navigable round
      for (let r = 1; r <= 3; r++) {
        const roundNum = r as RoundNumber;
        if (isRoundNavigable(roundNum, rounds, currentRound)) {
          onRoundSelect(roundNum);
          break;
        }
      }
    } else if (e.key === 'End') {
      e.preventDefault();
      // Jump to last navigable round
      for (let r = 3; r >= 1; r--) {
        const roundNum = r as RoundNumber;
        if (isRoundNavigable(roundNum, rounds, currentRound)) {
          onRoundSelect(roundNum);
          break;
        }
      }
    }
  }, [viewedRound, rounds, currentRound, onRoundSelect]);

  // Derive dot states for all rounds
  const roundDots = ([1, 2, 3] as RoundNumber[]).map(roundNumber => {
    const round = rounds[roundNumber - 1];
    const state = deriveRoundDotState(roundNumber, round, currentRound, viewedRound, debateStatus);
    const navigable = isRoundNavigable(roundNumber, rounds, currentRound);
    const selected = viewedRound === roundNumber;
    
    return { roundNumber, state, navigable, selected };
  });

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-between px-4 py-2 bg-gray-50/50 max-h-10"
      role="navigation"
      aria-label="Debate round progress"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      data-testid="compact-progress-bar"
    >
      {/* Progress text with turn highlighting */}
      <div className="flex items-center gap-2 min-w-0">
        <span 
          className={`text-sm font-medium transition-colors duration-200 ${
            isUserTurn && debateStatus === 'active' 
              ? 'text-accent font-bold' 
              : 'text-text-primary'
          }`}
          data-testid="progress-text"
          data-user-turn={isUserTurn && debateStatus === 'active'}
        >
          {progressText}
        </span>
        
        {/* History viewing indicator (Requirement 2.6, 5.5) */}
        {isViewingHistory && (
          <span 
            className={`flex-shrink-0 ${
              isMobile 
                ? 'w-2.5 h-2.5 rounded-full bg-amber-400' 
                : 'text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200'
            }`}
            data-testid="history-indicator"
            aria-label="Viewing history"
          >
            {!isMobile && 'Viewing history'}
          </span>
        )}
        
        {/* User turn highlight (Requirement 6.1) */}
        {isUserTurn && debateStatus === 'active' && !isViewingHistory && (
          <span 
            className={`flex-shrink-0 ${
              isMobile
                ? 'text-xs bg-accent text-white px-1.5 py-0.5 rounded-full font-bold animate-pulse'
                : 'text-xs bg-accent/15 text-accent px-2 py-0.5 rounded-full border border-accent/30 font-semibold animate-pulse'
            }`}
            data-testid="turn-indicator"
            aria-label="Your turn to submit"
          >
            {isMobile ? '!' : 'Your turn'}
          </span>
        )}

        {/* Submission CTA (Requirement 6.3) */}
        {canSubmitArgument && debateStatus === 'active' && viewedRound === currentRound && !isViewingHistory && (
          <button
            type="button"
            onClick={onSubmitClick}
            className={`flex-shrink-0 transition-all duration-200 ${
              isMobile
                ? 'text-xs bg-accent text-white px-2 py-0.5 rounded-full font-semibold hover:bg-accent/90 active:scale-95'
                : 'text-xs bg-accent text-white px-3 py-1 rounded-full font-medium hover:bg-accent/90 active:scale-95 shadow-sm'
            }`}
            data-testid="submission-cta"
            aria-label="Submit your argument"
          >
            {isMobile ? 'Submit' : 'Submit Argument'}
          </button>
        )}

        {/* Activity indicator (Requirement 6.4) */}
        {totalArgumentCount > 0 && debateStatus === 'active' && !isViewingHistory && (
          <span 
            className={`flex-shrink-0 ${
              isMobile
                ? 'text-xs text-text-tertiary'
                : 'text-xs text-text-tertiary bg-gray-100 px-2 py-0.5 rounded-full'
            }`}
            data-testid="activity-indicator"
            aria-label={`${totalArgumentCount} argument${totalArgumentCount !== 1 ? 's' : ''} submitted`}
          >
            {isMobile ? `${totalArgumentCount}` : `${totalArgumentCount} arg${totalArgumentCount !== 1 ? 's' : ''}`}
          </span>
        )}

        {/* Concluded outcome display (Requirement 6.5) */}
        {debateStatus === 'concluded' && winnerSide && (
          <span 
            className={`flex-shrink-0 ${
              winnerSide === 'support'
                ? 'text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200 font-medium'
                : winnerSide === 'oppose'
                ? 'text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200 font-medium'
                : 'text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full border border-gray-200 font-medium'
            }`}
            data-testid="outcome-indicator"
            aria-label={`Debate outcome: ${winnerSide === 'tie' ? 'Tie' : `${winnerSide} won`}`}
          >
            {winnerSide === 'support' ? '✓ Support' : winnerSide === 'oppose' ? '✓ Oppose' : '= Tie'}
          </span>
        )}
      </div>

      {/* Round dots */}
      <div 
        className="flex items-center -mx-2"
        role="group"
        aria-label="Round navigation"
      >
        {roundDots.map(({ roundNumber, state, navigable, selected }) => (
          <RoundDot
            key={roundNumber}
            roundNumber={roundNumber}
            state={state}
            isNavigable={navigable}
            isSelected={selected}
            onClick={() => handleRoundClick(roundNumber)}
          />
        ))}
      </div>
    </div>
  );
}

export default CompactProgressBar;
