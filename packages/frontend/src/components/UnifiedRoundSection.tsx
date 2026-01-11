/**
 * UnifiedRoundSection is the main container component that orchestrates round display and navigation.
 * It composes RoundProgressIndicator, RoundNavigator, RoundHistory, and ActiveRoundView.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.6, 5.4, 5.5, 7.5
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { Debate, Round, Argument, User } from '@debate-platform/shared';
import type { Citation } from './ArgumentBlock';
import { RoundProgressIndicator } from './RoundProgressIndicator';
import { RoundNavigator } from './RoundNavigator';
import { RoundHistory } from './RoundHistory';
import { ActiveRoundView } from './ActiveRoundView';

export interface UnifiedRoundSectionProps {
  debate: Debate;
  rounds: Round[];
  supportDebater?: User | null;
  opposeDebater?: User | null;
  currentUserId?: string;
  /** Arguments indexed by round number and side */
  arguments?: {
    [roundNumber: number]: {
      support?: Argument | null;
      oppose?: Argument | null;
    };
  };
  /** Citations for arguments */
  citations?: {
    [argumentId: string]: Citation[];
  };
  onCitationHover?: (citation: Citation | null, position: { top: number }) => void;
  onMindChanged?: (argumentId: string) => void;
  onArgumentSubmit?: (content: string) => void;
  /** Whether argument submission is in progress */
  isSubmitting?: boolean;
  /** 
   * Callback when a round completes and auto-transition occurs.
   * Useful for parent components to know when to show notifications.
   * Requirements: 7.5
   */
  onRoundComplete?: (completedRound: 1 | 2 | 3, nextRound: 1 | 2 | 3 | null) => void;
}

/**
 * UnifiedRoundSection consolidates three separate round sections into a single dynamic component.
 * It displays only one round at a time, with navigation and history for completed rounds.
 * 
 * State Preservation (Requirements 3.6, 5.4, 5.5):
 * - viewedRound is preserved when SSE events arrive (unless user is viewing the completing round)
 * - "This changed my mind" attribution state is preserved across round transitions
 * - Round completion triggers auto-transition only when viewing the completing round
 */
export function UnifiedRoundSection({
  debate,
  rounds,
  supportDebater,
  opposeDebater,
  currentUserId,
  arguments: roundArguments,
  citations,
  onCitationHover,
  onMindChanged,
  onArgumentSubmit,
  isSubmitting = false,
  onRoundComplete,
}: UnifiedRoundSectionProps) {
  // State for which round the user is currently viewing
  // Defaults to the current active round, or closing round if concluded
  const [viewedRound, setViewedRound] = useState<1 | 2 | 3>(() => {
    if (debate.status === 'concluded') {
      return 3; // Show closing round by default for concluded debates
    }
    return debate.currentRound;
  });

  // State for history expansion
  const [historyExpanded, setHistoryExpanded] = useState(false);

  /**
   * Track "This changed my mind" attribution state per argument.
   * This state persists across round transitions and SSE updates.
   * Requirements: 5.5
   */
  const [mindChangedArguments, setMindChangedArguments] = useState<Set<string>>(new Set());

  /**
   * Track previous round completion states to detect when a round completes.
   * Used for auto-transition logic.
   * Requirements: 7.5
   */
  const prevRoundsRef = useRef<Round[]>(rounds);
  const prevDebateRef = useRef<Debate>(debate);

  /**
   * Detect round completion and handle auto-transition.
   * Requirements: 7.3, 7.5
   * 
   * When both arguments for a round are submitted (round.completedAt becomes non-null):
   * - The newly submitted argument is immediately displayed (handled by props update)
   * - If viewing the completing round, viewedRound advances to the next round (if not final)
   * - If final round completes, viewedRound remains on Closing
   */
  useEffect(() => {
    const prevRounds = prevRoundsRef.current;
    
    // Check each round for completion
    for (let i = 0; i < rounds.length; i++) {
      const currentRound = rounds[i];
      const prevRound = prevRounds[i];
      
      // Detect if this round just completed (was null, now has value)
      const justCompleted = prevRound?.completedAt === null && currentRound?.completedAt !== null;
      
      if (justCompleted) {
        const completedRoundNumber = (i + 1) as 1 | 2 | 3;
        const nextRoundNumber = completedRoundNumber < 3 ? ((completedRoundNumber + 1) as 1 | 2 | 3) : null;
        
        // Notify parent of round completion
        onRoundComplete?.(completedRoundNumber, nextRoundNumber);
        
        // Auto-transition only if user is viewing the completing round
        // This preserves user's viewing context when they're looking at history (Requirement 3.6)
        if (viewedRound === completedRoundNumber && nextRoundNumber !== null) {
          setViewedRound(nextRoundNumber);
        }
      }
    }
    
    // Update refs for next comparison
    prevRoundsRef.current = rounds;
    prevDebateRef.current = debate;
  }, [rounds, debate, viewedRound, onRoundComplete]);

  /**
   * Handle debate state changes (e.g., from SSE events).
   * Preserves viewedRound when user is viewing history.
   * Requirements: 3.6, 5.4
   */
  useEffect(() => {
    const prevDebate = prevDebateRef.current;
    
    // If debate just concluded, don't force navigation - preserve user's view
    if (prevDebate.status === 'active' && debate.status === 'concluded') {
      // User can stay on whatever round they were viewing
      return;
    }
    
    // If debate's currentRound changed (new round started via SSE)
    // Only auto-navigate if user was viewing the previous active round
    if (prevDebate.currentRound !== debate.currentRound && debate.status === 'active') {
      setViewedRound((prev) => {
        // If user was viewing the previous active round, follow to new round
        if (prev === prevDebate.currentRound) {
          return debate.currentRound;
        }
        // Otherwise preserve their viewing context (they're viewing history)
        return prev;
      });
    }
  }, [debate.currentRound, debate.status]);

  // Get the currently viewed round data
  const currentRoundData = useMemo(() => {
    return rounds[viewedRound - 1];
  }, [rounds, viewedRound]);

  // Get completed rounds for history
  const completedRounds = useMemo(() => {
    return rounds.filter((round) => round.completedAt !== null);
  }, [rounds]);

  // Determine if user is a debater and which side
  const userSide = useMemo((): 'support' | 'oppose' | undefined => {
    if (!currentUserId) return undefined;
    if (supportDebater?.id === currentUserId) return 'support';
    if (opposeDebater?.id === currentUserId) return 'oppose';
    return undefined;
  }, [currentUserId, supportDebater, opposeDebater]);

  // Determine if user can submit an argument
  const canSubmitArgument = useMemo(() => {
    // Must be a debater
    if (!userSide) return false;
    // Debate must be active
    if (debate.status !== 'active') return false;
    // Must be viewing the active round
    if (viewedRound !== debate.currentRound) return false;
    // Must be their turn
    if (debate.currentTurn !== userSide) return false;
    return true;
  }, [userSide, debate.status, debate.currentRound, debate.currentTurn, viewedRound]);

  // Get arguments for the viewed round
  const viewedRoundArgs = useMemo(() => {
    return roundArguments?.[viewedRound] || {};
  }, [roundArguments, viewedRound]);

  // Get citations for the viewed round's arguments
  const supportCitations = useMemo(() => {
    const argId = viewedRoundArgs.support?.id;
    return argId ? citations?.[argId] || [] : [];
  }, [viewedRoundArgs.support, citations]);

  const opposeCitations = useMemo(() => {
    const argId = viewedRoundArgs.oppose?.id;
    return argId ? citations?.[argId] || [] : [];
  }, [viewedRoundArgs.oppose, citations]);

  // Handle round navigation
  const handleRoundSelect = useCallback((round: 1 | 2 | 3) => {
    setViewedRound(round);
  }, []);

  // Handle history toggle
  const handleHistoryToggle = useCallback(() => {
    setHistoryExpanded((prev) => !prev);
  }, []);

  // Handle history round click
  const handleHistoryRoundClick = useCallback((roundNumber: 1 | 2 | 3) => {
    setViewedRound(roundNumber);
    setHistoryExpanded(false); // Collapse history after navigation
  }, []);

  /**
   * Handle "This changed my mind" button click.
   * Preserves attribution state across round transitions and SSE updates.
   * Requirements: 5.5
   */
  const handleMindChanged = useCallback((argumentId: string) => {
    // Track that this argument changed the user's mind
    setMindChangedArguments((prev) => {
      const next = new Set(prev);
      next.add(argumentId);
      return next;
    });
    
    // Also call the parent's onMindChanged callback if provided
    onMindChanged?.(argumentId);
  }, [onMindChanged]);

  // Determine if viewing the active round
  const isActiveRound = viewedRound === debate.currentRound && debate.status === 'active';

  // Guard against missing round data
  if (!currentRoundData) {
    return (
      <div className="p-4 text-text-tertiary text-center">
        Round data not available
      </div>
    );
  }

  return (
    <section 
      id="debate-rounds"
      className="space-y-4"
      aria-label="Debate Rounds"
    >
      {/* Progress Indicator */}
      <RoundProgressIndicator
        currentRound={debate.currentRound}
        currentTurn={debate.currentTurn}
        debateStatus={debate.status}
        viewedRound={viewedRound}
        rounds={rounds}
      />

      {/* Round Navigator */}
      <RoundNavigator
        rounds={rounds}
        currentRound={debate.currentRound}
        viewedRound={viewedRound}
        onRoundSelect={handleRoundSelect}
      />

      {/* Round History (only shown when viewing active round and there's history) */}
      {viewedRound === debate.currentRound && completedRounds.length > 0 && (
        <RoundHistory
          completedRounds={completedRounds}
          supportDebater={supportDebater}
          opposeDebater={opposeDebater}
          arguments={roundArguments}
          expanded={historyExpanded}
          onToggle={handleHistoryToggle}
          onRoundClick={handleHistoryRoundClick}
        />
      )}

      {/* Active Round View */}
      <ActiveRoundView
        round={currentRoundData}
        roundNumber={viewedRound}
        supportArgument={viewedRoundArgs.support}
        opposeArgument={viewedRoundArgs.oppose}
        supportAuthor={supportDebater}
        opposeAuthor={opposeDebater}
        supportCitations={supportCitations}
        opposeCitations={opposeCitations}
        isActiveRound={isActiveRound}
        currentTurn={debate.currentTurn}
        canSubmitArgument={canSubmitArgument}
        userSide={userSide}
        isSubmitting={isSubmitting}
        attributedArguments={mindChangedArguments}
        onCitationHover={onCitationHover}
        onMindChanged={handleMindChanged}
        onArgumentSubmit={onArgumentSubmit}
      />
    </section>
  );
}

export default UnifiedRoundSection;
