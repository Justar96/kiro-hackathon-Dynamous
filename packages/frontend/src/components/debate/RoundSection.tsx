/**
 * RoundSection is the main container component that orchestrates round display and navigation.
 * It composes RoundProgressIndicator, RoundNavigator, RoundHistory, and ActiveRoundView.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 3.5, 5.4, 5.5, 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { useCallback, useMemo, useEffect, useRef, useReducer, useState } from 'react';
import type { Debate, Round, Argument, User, RoundNumber } from '@debate-platform/shared';
import type { Citation } from './ArgumentBlock';
import type { SteelmanData, PendingReview } from './ActiveRoundView';
import { RoundProgressIndicator } from './RoundProgressIndicator';
import { RoundNavigator } from './RoundNavigator';
import { RoundHistory } from './RoundHistory';
import { ActiveRoundView } from './ActiveRoundView';
import { HorizontalDivider } from '../ui/HorizontalDivider';
import { getEnhancedRoundConfig } from './RoundSection.utils';

export interface RoundSectionProps {
  debate: Debate;
  rounds: Round[];
  supportDebater?: User | null;
  opposeDebater?: User | null;
  currentUserId?: string;
  arguments?: { [roundNumber: number]: { support?: Argument | null; oppose?: Argument | null } };
  citations?: { [argumentId: string]: Citation[] };
  /** Controls whether to show card styling or seamless integration */
  variant?: 'card' | 'seamless';
  /** Enable sticky progress bar on scroll (Requirement 3.5) */
  sticky?: boolean;
  /** Winner side when debate is concluded (Requirement 6.5) */
  winnerSide?: 'support' | 'oppose' | 'tie' | null;
  onCitationHover?: (citation: Citation | null, position: { top: number }) => void;
  onMindChanged?: (argumentId: string) => void;
  onArgumentSubmit?: (content: string) => void;
  isSubmitting?: boolean;
  onRoundComplete?: (completedRound: RoundNumber, nextRound: RoundNumber | null) => void;
  // Steelman Gate props
  steelmanData?: SteelmanData;
  pendingReviews?: PendingReview[];
  onSteelmanSubmit?: (targetArgumentId: string, content: string) => void;
  onSteelmanReview?: (steelmanId: string, approved: boolean, reason?: string) => void;
  onSteelmanDelete?: (steelmanId: string) => void;
  isSteelmanSubmitting?: boolean;
}

// ============================================
// State Reducer (cleaner than multiple useEffects)
// ============================================

type RoundState = {
  viewedRound: RoundNumber;
  historyExpanded: boolean;
  mindChangedArgs: Set<string>;
};

type RoundAction =
  | { type: 'VIEW_ROUND'; round: RoundNumber }
  | { type: 'TOGGLE_HISTORY' }
  | { type: 'ROUND_COMPLETED'; completedRound: RoundNumber }
  | { type: 'MIND_CHANGED'; argumentId: string }
  | { type: 'SYNC_ACTIVE_ROUND'; activeRound: RoundNumber; prevActiveRound: RoundNumber };

function roundReducer(state: RoundState, action: RoundAction): RoundState {
  switch (action.type) {
    case 'VIEW_ROUND':
      return { ...state, viewedRound: action.round, historyExpanded: false };
    
    case 'TOGGLE_HISTORY':
      return { ...state, historyExpanded: !state.historyExpanded };
    
    case 'ROUND_COMPLETED':
      // Auto-advance only if viewing the completing round and not final
      if (state.viewedRound === action.completedRound && action.completedRound < 3) {
        return { ...state, viewedRound: (action.completedRound + 1) as RoundNumber };
      }
      return state;
    
    case 'MIND_CHANGED':
      return { ...state, mindChangedArgs: new Set(state.mindChangedArgs).add(action.argumentId) };
    
    case 'SYNC_ACTIVE_ROUND':
      // Follow to new round only if user was viewing the previous active round
      if (state.viewedRound === action.prevActiveRound) {
        return { ...state, viewedRound: action.activeRound };
      }
      return state;
    
    default:
      return state;
  }
}

function getInitialState(debate: Debate): RoundState {
  return {
    viewedRound: debate.status === 'concluded' ? 3 : debate.currentRound,
    historyExpanded: false,
    mindChangedArgs: new Set(),
  };
}

/**
 * RoundSection consolidates three separate round sections into a single dynamic component.
 * Uses useReducer for cleaner state transitions.
 */
export function RoundSection({
  debate,
  rounds,
  supportDebater,
  opposeDebater,
  currentUserId,
  arguments: roundArguments,
  citations,
  variant = 'card',
  sticky = false,
  winnerSide,
  onCitationHover,
  onMindChanged,
  onArgumentSubmit,
  isSubmitting = false,
  onRoundComplete,
  steelmanData,
  pendingReviews,
  onSteelmanSubmit,
  onSteelmanReview,
  onSteelmanDelete,
  isSteelmanSubmitting = false,
}: RoundSectionProps) {
  const [state, dispatch] = useReducer(roundReducer, debate, getInitialState);
  const { viewedRound, historyExpanded, mindChangedArgs } = state;

  // Track previous values for detecting changes
  const prevRoundsRef = useRef<Round[]>(rounds);
  const prevDebateRef = useRef<Debate>(debate);

  // Sticky progress bar state (Requirement 3.5)
  const [isSticky, setIsSticky] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // Intersection Observer for sticky detection (Requirement 3.5)
  useEffect(() => {
    if (!sticky || !progressBarRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When the progress bar starts to leave the viewport, make it sticky
        setIsSticky(!entry.isIntersecting);
      },
      {
        // Trigger when the element is about to leave the top of the viewport
        rootMargin: '-1px 0px 0px 0px',
        threshold: 0,
      }
    );

    observer.observe(progressBarRef.current);

    return () => observer.disconnect();
  }, [sticky]);

  // Detect round completion
  useEffect(() => {
    const prevRounds = prevRoundsRef.current;
    
    for (let i = 0; i < rounds.length; i++) {
      const justCompleted = prevRounds[i]?.completedAt === null && rounds[i]?.completedAt !== null;
      if (justCompleted) {
        const completedRound = (i + 1) as RoundNumber;
        const nextRound = completedRound < 3 ? ((completedRound + 1) as RoundNumber) : null;
        onRoundComplete?.(completedRound, nextRound);
        dispatch({ type: 'ROUND_COMPLETED', completedRound });
      }
    }
    
    prevRoundsRef.current = rounds;
  }, [rounds, onRoundComplete]);

  // Sync with debate's active round changes (from SSE)
  useEffect(() => {
    const prevDebate = prevDebateRef.current;
    
    if (prevDebate.currentRound !== debate.currentRound && debate.status === 'active') {
      dispatch({ 
        type: 'SYNC_ACTIVE_ROUND', 
        activeRound: debate.currentRound, 
        prevActiveRound: prevDebate.currentRound 
      });
    }
    
    prevDebateRef.current = debate;
  }, [debate.currentRound, debate.status]);

  const currentRoundData = rounds[viewedRound - 1];
  const completedRounds = useMemo(() => rounds.filter(r => r.completedAt !== null), [rounds]);

  const userSide = useMemo(() => {
    if (!currentUserId) return undefined;
    if (supportDebater?.id === currentUserId) return 'support' as const;
    if (opposeDebater?.id === currentUserId) return 'oppose' as const;
    return undefined;
  }, [currentUserId, supportDebater, opposeDebater]);

  const canSubmitArgument = useMemo(() => {
    return userSide && 
           debate.status === 'active' && 
           viewedRound === debate.currentRound && 
           debate.currentTurn === userSide;
  }, [userSide, debate.status, debate.currentRound, debate.currentTurn, viewedRound]);

  const viewedRoundArgs = roundArguments?.[viewedRound] || {};
  const supportCitations = viewedRoundArgs.support?.id ? citations?.[viewedRoundArgs.support.id] || [] : [];
  const opposeCitations = viewedRoundArgs.oppose?.id ? citations?.[viewedRoundArgs.oppose.id] || [] : [];

  const handleRoundSelect = useCallback((round: RoundNumber) => {
    dispatch({ type: 'VIEW_ROUND', round });
    
    // Smooth scroll to the round header after state update (Requirement 4.4)
    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      const headerElement = document.getElementById(`round-${round}-header`);
      if (headerElement) {
        headerElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }, []);

  const handleHistoryToggle = useCallback(() => {
    dispatch({ type: 'TOGGLE_HISTORY' });
  }, []);

  const handleMindChanged = useCallback((argumentId: string) => {
    dispatch({ type: 'MIND_CHANGED', argumentId });
    onMindChanged?.(argumentId);
  }, [onMindChanged]);

  const isActiveRound = viewedRound === debate.currentRound && debate.status === 'active';

  // Determine if it's the user's turn (for turn highlighting)
  const isUserTurn = useMemo(() => {
    return userSide !== undefined && 
           debate.status === 'active' && 
           debate.currentTurn === userSide;
  }, [userSide, debate.status, debate.currentTurn]);

  // Calculate argument counts per round for activity indicator (Requirement 6.4)
  const argumentCounts = useMemo(() => {
    const counts: { [roundNumber: number]: number } = {};
    if (roundArguments) {
      for (const [roundNum, args] of Object.entries(roundArguments)) {
        let count = 0;
        if (args.support) count++;
        if (args.oppose) count++;
        counts[Number(roundNum)] = count;
      }
    }
    return counts;
  }, [roundArguments]);

  // Handler to scroll to submission form when CTA is clicked (Requirement 6.3)
  const handleSubmitClick = useCallback(() => {
    // Scroll to the argument submission form
    const submissionForm = document.querySelector('[data-testid="argument-submission-form"]');
    if (submissionForm) {
      submissionForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Focus the textarea if available
      const textarea = submissionForm.querySelector('textarea');
      if (textarea) {
        setTimeout(() => textarea.focus(), 300);
      }
    }
  }, []);

  if (!currentRoundData) {
    return <div className="p-4 text-text-tertiary text-center">Round data not available</div>;
  }

  // Get enhanced round configuration for paper-polish styling
  const roundConfig = getEnhancedRoundConfig(currentRoundData.roundType, viewedRound);
  const isRoundComplete = currentRoundData.completedAt !== null;

  // Variant-based styling (Requirements: 3.1, 3.2, 3.4)
  const containerClasses = variant === 'seamless'
    ? 'bg-transparent overflow-hidden'
    : 'rounded-lg border border-gray-100 bg-white shadow-sm overflow-hidden';

  const progressBarClasses = variant === 'seamless'
    ? 'bg-gray-50/30'
    : 'bg-gray-50/50';

  // Sticky progress bar classes (Requirement 3.5)
  // When sticky, add solid background to prevent content showing through
  const stickyClasses = sticky
    ? `sticky top-0 z-10 transition-shadow duration-200 ${isSticky ? 'shadow-md bg-white/95 backdrop-blur-sm' : ''}`
    : '';

  return (
    <section 
      ref={sectionRef}
      id="debate-rounds"
      className={containerClasses}
      aria-label="Debate Rounds"
    >
      {/* Sentinel element for intersection observer (Requirement 3.5) */}
      {sticky && <div ref={progressBarRef} className="h-0 w-full" aria-hidden="true" />}

      {/* Integrated Progress Bar + Header (Requirements: 1.1, 1.2, 3.3, 3.4, 3.5, 4.4) */}
      <div 
        className={`${progressBarClasses} ${variant === 'seamless' ? '' : 'border-b border-gray-100'} ${stickyClasses}`}
        id={`round-${viewedRound}-progress`}
        data-sticky={sticky && isSticky}
      >
        <div className="p-4">
          <RoundProgressIndicator
            currentRound={debate.currentRound}
            currentTurn={debate.currentTurn}
            viewedRound={viewedRound}
            rounds={rounds}
            debateStatus={debate.status}
          />
          <RoundNavigator
            currentRound={debate.currentRound}
            viewedRound={viewedRound}
            rounds={rounds}
            onRoundSelect={handleRoundSelect}
          />
        </div>
      </div>

      {/* Round Header - Positioned directly below progress bar (Requirements: 3.3, 3.4, 4.4, 7.1, 7.2, 7.3, 7.4, 7.5) */}
      <header 
        id={`round-${viewedRound}-header`}
        className={`scroll-mt-16 ${variant === 'seamless' ? 'px-0 pt-3 pb-0' : 'px-5 pt-4 pb-0'}`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-heading text-heading-2 text-text-primary leading-tight">
            {roundConfig.fullTitle}
          </h2>
          {/* Subtle completion indicator (Requirement 7.4) */}
          {isRoundComplete && (
            <span className="small-caps text-xs text-text-tertiary flex items-center gap-1.5 flex-shrink-0">
              <svg 
                className="w-3.5 h-3.5 text-green-500" 
                fill="currentColor" 
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path 
                  fillRule="evenodd" 
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                  clipRule="evenodd" 
                />
              </svg>
              Complete
            </span>
          )}
        </div>
        {/* Muted description text (Requirement 7.2) */}
        <p className="text-body-small text-text-secondary mt-1 leading-relaxed">
          {roundConfig.description}
        </p>
        {/* Subtle divider below header - only in card mode (Requirement 3.4) */}
        {variant === 'card' && <HorizontalDivider spacing="md" />}
      </header>

      {/* Card Body - Round Content (Requirement 4.4 - smooth scroll targets) */}
      <div 
        id={`round-${viewedRound}-content`}
        className={`scroll-mt-8 ${variant === 'seamless' ? 'px-0 pb-0 pt-4' : 'px-5 pb-5'}`}
      >
        {viewedRound === debate.currentRound && completedRounds.length > 0 && (
          <div className="mb-4">
            <RoundHistory
              completedRounds={completedRounds}
              supportDebater={supportDebater}
              opposeDebater={opposeDebater}
              arguments={roundArguments}
              expanded={historyExpanded}
              onToggle={handleHistoryToggle}
              onRoundClick={handleRoundSelect}
            />
          </div>
        )}

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
          canSubmitArgument={!!canSubmitArgument}
          userSide={userSide}
          isSubmitting={isSubmitting}
          attributedArguments={mindChangedArgs}
          steelmanData={steelmanData}
          pendingReviews={pendingReviews}
          onCitationHover={onCitationHover}
          onMindChanged={handleMindChanged}
          onArgumentSubmit={onArgumentSubmit}
          onSteelmanSubmit={onSteelmanSubmit}
          onSteelmanReview={onSteelmanReview}
          onSteelmanDelete={onSteelmanDelete}
          isSteelmanSubmitting={isSteelmanSubmitting}
        />
      </div>
    </section>
  );
}

export default RoundSection;
