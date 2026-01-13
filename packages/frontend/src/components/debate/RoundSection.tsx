/**
 * RoundSection is the main container component that orchestrates round display and navigation.
 * It composes RoundProgressIndicator, RoundNavigator, RoundHistory, and ActiveRoundView.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.6, 5.4, 5.5, 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { useCallback, useMemo, useEffect, useRef, useReducer } from 'react';
import type { Debate, Round, Argument, User, RoundNumber } from '@debate-platform/shared';
import type { Citation } from './ArgumentBlock';
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
  onCitationHover?: (citation: Citation | null, position: { top: number }) => void;
  onMindChanged?: (argumentId: string) => void;
  onArgumentSubmit?: (content: string) => void;
  isSubmitting?: boolean;
  onRoundComplete?: (completedRound: RoundNumber, nextRound: RoundNumber | null) => void;
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
  onCitationHover,
  onMindChanged,
  onArgumentSubmit,
  isSubmitting = false,
  onRoundComplete,
}: RoundSectionProps) {
  const [state, dispatch] = useReducer(roundReducer, debate, getInitialState);
  const { viewedRound, historyExpanded, mindChangedArgs } = state;

  // Track previous values for detecting changes
  const prevRoundsRef = useRef<Round[]>(rounds);
  const prevDebateRef = useRef<Debate>(debate);

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

  return (
    <section 
      id="debate-rounds"
      className="rounded-lg border border-gray-100 bg-white shadow-sm overflow-hidden"
      aria-label="Debate Rounds"
    >
      {/* Card Header - Progress & Navigation */}
      <div className="border-b border-gray-100">
        <RoundProgressIndicator
          currentRound={debate.currentRound}
          currentTurn={debate.currentTurn}
          debateStatus={debate.status}
          viewedRound={viewedRound}
          rounds={rounds}
        />
        <RoundNavigator
          rounds={rounds}
          currentRound={debate.currentRound}
          viewedRound={viewedRound}
          onRoundSelect={handleRoundSelect}
        />
      </div>

      {/* Round Header - Paper-polish typography (Requirements: 7.1, 7.2, 7.3, 7.4, 7.5) */}
      <header className="px-5 pt-5 pb-0">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-heading text-heading-2 text-text-primary">
            {roundConfig.fullTitle}
          </h2>
          {/* Subtle completion indicator (Requirement 7.4) */}
          {isRoundComplete && (
            <span className="small-caps text-xs text-text-tertiary flex items-center gap-1.5">
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
        <p className="text-body-small text-text-secondary mt-1">
          {roundConfig.description}
        </p>
        {/* Subtle divider below header (Requirement 7.3) */}
        <HorizontalDivider spacing="md" />
      </header>

      {/* Card Body - Round Content */}
      <div className="px-5 pb-5">
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
          onCitationHover={onCitationHover}
          onMindChanged={handleMindChanged}
          onArgumentSubmit={onArgumentSubmit}
        />
      </div>
    </section>
  );
}

export default RoundSection;
