/**
 * RoundSection is the main container component that orchestrates round display and navigation.
 * It composes RoundProgressIndicator, RoundHistory, and ActiveRoundView.
 */

import { useCallback, useMemo, useEffect, useRef, useReducer, useState } from 'react';
import type { Debate, Round, Argument, User, RoundNumber } from '@debate-platform/shared';
import type { Citation } from './ArgumentBlock';
import type { SteelmanData, PendingReview } from './ActiveRoundView';
import { RoundProgressIndicator } from './RoundProgressIndicator';
import { RoundHistory } from './RoundHistory';
import { ActiveRoundView } from './ActiveRoundView';
import { HorizontalDivider } from '../ui/HorizontalDivider';
import { getEnhancedRoundConfig } from './RoundSection.utils';
import { CheckCircleIcon } from '../icons';

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
  /** Enable sticky progress bar on scroll */
  sticky?: boolean;
  /** Argument ID to highlight (for real-time SSE updates) */
  highlightArgumentId?: string | null;
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
  highlightArgumentId,
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

  // Sticky progress bar state
  const [isSticky, setIsSticky] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // Intersection Observer for sticky detection
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
  const prevRoundArgs = viewedRound > 1 ? roundArguments?.[viewedRound - 1] || {} : undefined;
  const supportCitations = viewedRoundArgs.support?.id ? citations?.[viewedRoundArgs.support.id] || [] : [];
  const opposeCitations = viewedRoundArgs.oppose?.id ? citations?.[viewedRoundArgs.oppose.id] || [] : [];

  const handleRoundSelect = useCallback((round: RoundNumber) => {
    dispatch({ type: 'VIEW_ROUND', round });
    
    // Smooth scroll to the round header after state update
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

  if (!currentRoundData) {
    return <div className="p-4 text-text-tertiary text-center">Round data not available</div>;
  }

  // Get enhanced round configuration for paper-polish styling
  const roundConfig = getEnhancedRoundConfig(currentRoundData.roundType, viewedRound);
  const isRoundComplete = currentRoundData.completedAt !== null;

  // Variant-based styling
  const containerClasses = variant === 'seamless'
    ? 'bg-paper border border-divider rounded-lg shadow-paper overflow-hidden'
    : 'rounded-lg border border-divider bg-paper shadow-paper overflow-hidden';

  const progressBarClasses = variant === 'seamless'
    ? 'bg-page-bg/95 backdrop-blur-sm'
    : 'bg-page-bg/80';

  // Sticky progress bar classes
  const stickyClasses = sticky
    ? `lg:sticky top-0 z-10 transition-all duration-200 ${isSticky ? 'shadow-elevated bg-paper/98 backdrop-blur-md border-b border-divider' : ''}`
    : '';

  return (
    <section 
      ref={sectionRef}
      id="debate-rounds"
      className={containerClasses}
      aria-label="Debate Rounds"
    >
      {/* Sentinel element for intersection observer */}
      {sticky && <div ref={progressBarRef} className="h-0 w-full" aria-hidden="true" />}

      {/* Integrated Progress Bar + Header */}
      <div
        className={`${progressBarClasses} ${variant === 'seamless' ? '' : 'border-b border-divider'} ${stickyClasses}`}
        id={`round-${viewedRound}-progress`}
        data-sticky={sticky && isSticky}
      >
        <div className="px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-heading font-semibold text-text-primary">Debate Rounds</h2>
          <RoundProgressIndicator
            currentRound={debate.currentRound}
            currentTurn={debate.currentTurn}
            viewedRound={viewedRound}
            rounds={rounds}
            debateStatus={debate.status}
            onRoundSelect={handleRoundSelect}
          />
        </div>
      </div>

      {/* Round Header */}
      <header 
        id={`round-${viewedRound}-header`}
        className={`scroll-mt-16 ${variant === 'seamless' ? 'px-6 pt-5 pb-0' : 'px-5 pt-4 pb-0'}`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-heading text-heading-2 text-text-primary leading-tight">
            {roundConfig.fullTitle}
          </h2>
          {/* Completion indicator */}
          {isRoundComplete && (
            <span className="small-caps text-xs text-text-tertiary flex items-center gap-1.5 flex-shrink-0">
              <CheckCircleIcon 
                size="sm" 
                className="text-green-500" 
                decorative
              />
              Complete
            </span>
          )}
        </div>
        {/* Description */}
        <p className="text-body-small text-text-secondary mt-1.5 leading-relaxed">
          {roundConfig.description}
        </p>
        {/* Divider - only in card mode */}
        {variant === 'card' && <HorizontalDivider spacing="md" />}
      </header>

      {/* Round Content */}
      <div 
        id={`round-${viewedRound}-content`}
        className={`scroll-mt-8 ${variant === 'seamless' ? 'px-6 pb-6 pt-5' : 'px-5 pb-5'}`}
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
          highlightArgumentId={highlightArgumentId}
          steelmanData={steelmanData}
          pendingReviews={pendingReviews}
          prevRoundArguments={prevRoundArgs}
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
