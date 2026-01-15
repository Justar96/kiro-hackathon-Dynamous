/**
 * DebateProgressIndicator displays a visual progress bar showing rounds 1-2-3.
 * Highlights current round and turn, shows "Your turn" indicator when applicable.
 * 
 * Requirements: 5.1, 5.2 - Clear visual progress indicator showing current round and turn
 */

import { useMemo } from 'react';
import type { Debate, Round, RoundNumber, Side, User } from '@thesis/shared';

export interface DebateProgressIndicatorProps {
  /** The debate data */
  debate: Debate;
  /** Round data for the debate */
  rounds: Round[];
  /** Current user ID for determining if it's their turn */
  currentUserId?: string;
  /** Support debater info */
  supportDebater?: User | null;
  /** Oppose debater info */
  opposeDebater?: User | null;
  /** Callback when a round is clicked */
  onRoundClick?: (roundNumber: RoundNumber) => void;
}

export interface RoundStepInfo {
  roundNumber: RoundNumber;
  label: string;
  status: 'completed' | 'active' | 'pending';
  hasArguments: boolean;
}

const ROUND_LABELS: Record<RoundNumber, string> = {
  1: 'Opening',
  2: 'Rebuttal',
  3: 'Closing',
};

/**
 * Derives the status of each round step based on debate state.
 */
export function deriveRoundSteps(
  debate: Debate,
  rounds: Round[]
): RoundStepInfo[] {
  return ([1, 2, 3] as RoundNumber[]).map((roundNumber) => {
    const round = rounds[roundNumber - 1];
    const isCompleted = round?.completedAt !== null;
    const isActive = debate.currentRound === roundNumber && debate.status === 'active';
    
    let status: 'completed' | 'active' | 'pending';
    if (isCompleted) {
      status = 'completed';
    } else if (isActive) {
      status = 'active';
    } else {
      status = 'pending';
    }
    
    return {
      roundNumber,
      label: ROUND_LABELS[roundNumber],
      status,
      hasArguments: round?.supportArgumentId !== null || round?.opposeArgumentId !== null,
    };
  });
}

/**
 * Determines if the current user can submit an argument.
 */
export function isUserTurn(
  debate: Debate,
  currentUserId?: string
): { isTurn: boolean; side: Side | null } {
  if (!currentUserId || debate.status !== 'active') {
    return { isTurn: false, side: null };
  }
  
  const userSide: Side | null = 
    currentUserId === debate.supportDebaterId ? 'support' :
    currentUserId === debate.opposeDebaterId ? 'oppose' : null;
  
  if (!userSide) {
    return { isTurn: false, side: null };
  }
  
  return {
    isTurn: debate.currentTurn === userSide,
    side: userSide,
  };
}

/**
 * Gets the turn label for display.
 */
export function getTurnDisplayLabel(turn: Side): string {
  return turn === 'support' ? 'Support' : 'Oppose';
}

export function DebateProgressIndicator({
  debate,
  rounds,
  currentUserId,
  supportDebater,
  opposeDebater,
  onRoundClick,
}: DebateProgressIndicatorProps) {
  const roundSteps = useMemo(() => deriveRoundSteps(debate, rounds), [debate, rounds]);
  const { isTurn } = useMemo(
    () => isUserTurn(debate, currentUserId),
    [debate, currentUserId]
  );
  
  const isDebateActive = debate.status === 'active';
  const isConcluded = debate.status === 'concluded';
  const isWaitingOpponent = !debate.opposeDebaterId;
  
  // Get current turn debater name
  const currentTurnDebater = debate.currentTurn === 'support' 
    ? supportDebater?.username 
    : opposeDebater?.username;

  return (
    <div 
      className="debate-progress-indicator"
      data-testid="debate-progress-indicator"
      role="navigation"
      aria-label="Debate round progress"
    >
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 mb-3">
        {roundSteps.map((step, index) => (
          <div key={step.roundNumber} className="flex items-center">
            {/* Round Step */}
            <RoundStep
              step={step}
              isClickable={step.status === 'completed' || step.status === 'active'}
              onClick={() => onRoundClick?.(step.roundNumber)}
            />
            
            {/* Connector Line */}
            {index < roundSteps.length - 1 && (
              <div 
                className={`w-8 h-0.5 mx-1 transition-colors ${
                  step.status === 'completed' ? 'bg-green-400' : 'bg-gray-200'
                }`}
                aria-hidden="true"
              />
            )}
          </div>
        ))}
      </div>
      
      {/* Status Text */}
      <div className="text-center">
        {isWaitingOpponent ? (
          <WaitingStatus />
        ) : isConcluded ? (
          <ConcludedStatus />
        ) : isDebateActive ? (
          <ActiveStatus
            currentRound={debate.currentRound}
            currentTurn={debate.currentTurn}
            currentTurnDebater={currentTurnDebater}
            isTurn={isTurn}
          />
        ) : null}
      </div>
    </div>
  );
}

interface RoundStepProps {
  step: RoundStepInfo;
  isClickable: boolean;
  onClick: () => void;
}

function RoundStep({ step, isClickable, onClick }: RoundStepProps) {
  const baseClasses = 'flex flex-col items-center motion-safe:transition-all motion-safe:duration-200 motion-reduce:transition-none';
  const clickableClasses = isClickable 
    ? 'cursor-pointer motion-safe:hover:scale-105' 
    : 'cursor-default';
  
  return (
    <button
      type="button"
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      className={`${baseClasses} ${clickableClasses} min-w-[44px] min-h-[44px] p-1`}
      data-testid={`round-step-${step.roundNumber}`}
      data-status={step.status}
      aria-label={`Round ${step.roundNumber}: ${step.label} - ${step.status}`}
      aria-current={step.status === 'active' ? 'step' : undefined}
    >
      {/* Circle Indicator */}
      <div 
        className={`
          w-10 h-10 rounded-full flex items-center justify-center
          text-sm font-semibold motion-safe:transition-all motion-safe:duration-200 motion-reduce:transition-none
          ${getStepCircleClasses(step.status)}
        `}
      >
        {step.status === 'completed' ? (
          <CheckIcon />
        ) : (
          step.roundNumber
        )}
      </div>
      
      {/* Label */}
      <span 
        className={`
          mt-1 text-xs font-medium
          ${step.status === 'active' ? 'text-accent' : 
            step.status === 'completed' ? 'text-green-600' : 'text-text-tertiary'}
        `}
      >
        {step.label}
      </span>
    </button>
  );
}

function getStepCircleClasses(status: RoundStepInfo['status']): string {
  switch (status) {
    case 'completed':
      return 'bg-green-500 text-white';
    case 'active':
      return 'bg-accent text-white ring-4 ring-accent/20 motion-safe:animate-pulse';
    case 'pending':
    default:
      return 'bg-gray-100 text-text-tertiary border-2 border-gray-200';
  }
}

function CheckIcon() {
  return (
    <svg 
      className="w-5 h-5" 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M5 13l4 4L19 7" 
      />
    </svg>
  );
}

interface ActiveStatusProps {
  currentRound: RoundNumber;
  currentTurn: Side;
  currentTurnDebater?: string;
  isTurn: boolean;
}

function ActiveStatus({ 
  currentRound, 
  currentTurn, 
  currentTurnDebater,
  isTurn,
}: ActiveStatusProps) {
  const turnLabel = getTurnDisplayLabel(currentTurn);
  const turnColor = currentTurn === 'support' ? 'text-support' : 'text-oppose';
  
  return (
    <div className="space-y-1" data-testid="active-status">
      <p className="text-sm text-text-secondary">
        Round {currentRound} of 3 · <span className={`font-medium ${turnColor}`}>{turnLabel}'s turn</span>
        {currentTurnDebater && (
          <span className="text-text-tertiary"> ({currentTurnDebater})</span>
        )}
      </p>
      
      {isTurn && (
        <div 
          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] bg-accent/10 text-accent rounded-full text-sm font-semibold motion-safe:animate-pulse"
          data-testid="your-turn-indicator"
          role="alert"
          aria-live="polite"
        >
          <span className="w-2 h-2 bg-accent rounded-full" aria-hidden="true" />
          Your turn to submit!
        </div>
      )}
    </div>
  );
}

function WaitingStatus() {
  return (
    <div 
      className="flex items-center justify-center gap-2 text-sm text-text-secondary min-h-[44px]"
      data-testid="waiting-status"
      role="status"
      aria-live="polite"
    >
      <span className="w-2 h-2 bg-amber-400 rounded-full motion-safe:animate-pulse" aria-hidden="true" />
      Waiting for opponent to join...
    </div>
  );
}

function ConcludedStatus() {
  return (
    <div 
      className="text-sm text-text-secondary min-h-[44px] flex items-center justify-center"
      data-testid="concluded-status"
      role="status"
    >
      <span className="font-medium text-green-600">Debate concluded</span>
      <span className="text-text-tertiary"> · All rounds complete</span>
    </div>
  );
}

export default DebateProgressIndicator;
