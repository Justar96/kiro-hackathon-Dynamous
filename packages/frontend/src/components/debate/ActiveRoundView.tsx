/**
 * ActiveRoundView displays the currently viewed round's full content.
 * Shows ArgumentBlock components for both sides, and ArgumentSubmissionForm when appropriate.
 * Includes Steelman Gate for rounds 2 and 3.
 */

import type { Round, Argument, User } from '@debate-platform/shared';
import { ArgumentBlock, type Citation } from './ArgumentBlock';
import { ArgumentSubmissionForm } from './ArgumentSubmissionForm';
import { SteelmanForm, SteelmanReview } from './SteelmanGate';
import { ClockIcon } from '../icons';

export interface SteelmanData {
  status: 'none' | 'pending' | 'approved' | 'rejected';
  steelman?: {
    id: string;
    content: string;
    status: 'pending' | 'approved' | 'rejected';
    rejectionReason: string | null;
  } | null;
}

export interface PendingReview {
  id: string;
  content: string;
  roundNumber: number;
  targetArgumentId: string;
}

export interface ActiveRoundViewProps {
  round: Round;
  roundNumber: 1 | 2 | 3;
  supportArgument?: Argument | null;
  opposeArgument?: Argument | null;
  supportAuthor?: User | null;
  opposeAuthor?: User | null;
  supportCitations?: Citation[];
  opposeCitations?: Citation[];
  isActiveRound: boolean;
  currentTurn?: 'support' | 'oppose';
  canSubmitArgument: boolean;
  /** Which side the current user is on (if they are a debater) */
  userSide?: 'support' | 'oppose';
  isSubmitting?: boolean;
  /** Set of argument IDs that have been attributed as "changed my mind" */
  attributedArguments?: Set<string>;
  /** Argument ID to highlight (for real-time SSE updates) */
  highlightArgumentId?: string | null;
  /** Steelman gate data for current user */
  steelmanData?: SteelmanData;
  /** Pending steelman reviews for opponent */
  pendingReviews?: PendingReview[];
  /** Previous round arguments for steelman gate */
  prevRoundArguments?: { support?: Argument | null; oppose?: Argument | null };
  onCitationHover?: (citation: Citation | null, position: { top: number }) => void;
  onMindChanged?: (argumentId: string) => void;
  onArgumentSubmit?: (content: string) => void;
  onSteelmanSubmit?: (targetArgumentId: string, content: string) => void;
  onSteelmanReview?: (steelmanId: string, approved: boolean, reason?: string) => void;
  onSteelmanDelete?: (steelmanId: string) => void;
  isSteelmanSubmitting?: boolean;
}

/**
 * EmptyRoundState - Side-by-side columns design for when both arguments are empty.
 */
function EmptyRoundState({ 
  currentTurn,
  isActiveRound 
}: { 
  currentTurn?: 'support' | 'oppose';
  isActiveRound: boolean;
}) {
  const turnLabel = currentTurn === 'support' ? 'For' : 'Against';
  
  return (
    <div className="bg-paper border border-divider rounded-lg overflow-hidden shadow-paper">
      {/* Side-by-side columns */}
      <div className="grid grid-cols-2 divide-x divide-divider">
        {/* For (Support) Column */}
        <div className="p-6 text-center">
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 ${
            currentTurn === 'support' && isActiveRound 
              ? 'bg-support/10 ring-2 ring-support/30' 
              : 'bg-page-bg'
          }`}>
            <span className={`text-xl font-semibold ${
              currentTurn === 'support' && isActiveRound ? 'text-support' : 'text-text-tertiary'
            }`}>
              F
            </span>
          </div>
          <h3 className={`text-base font-medium mb-1 ${
            currentTurn === 'support' && isActiveRound ? 'text-support' : 'text-text-secondary'
          }`}>
            For
          </h3>
          <p className="text-sm text-text-tertiary">
            {currentTurn === 'support' && isActiveRound ? 'Awaiting argument' : 'No argument yet'}
          </p>
        </div>

        {/* Against (Oppose) Column */}
        <div className="p-6 text-center">
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 ${
            currentTurn === 'oppose' && isActiveRound 
              ? 'bg-oppose/10 ring-2 ring-oppose/30' 
              : 'bg-page-bg'
          }`}>
            <span className={`text-xl font-semibold ${
              currentTurn === 'oppose' && isActiveRound ? 'text-oppose' : 'text-text-tertiary'
            }`}>
              A
            </span>
          </div>
          <h3 className={`text-base font-medium mb-1 ${
            currentTurn === 'oppose' && isActiveRound ? 'text-oppose' : 'text-text-secondary'
          }`}>
            Against
          </h3>
          <p className="text-sm text-text-tertiary">
            {currentTurn === 'oppose' && isActiveRound ? 'Awaiting argument' : 'No argument yet'}
          </p>
        </div>
      </div>

      {/* Unified status footer */}
      {isActiveRound && currentTurn && (
        <div className="px-6 py-3 bg-page-bg/50 border-t border-divider">
          <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
            <ClockIcon size="sm" className="text-text-tertiary" decorative />
            <span>
              Waiting for <span className={currentTurn === 'support' ? 'text-support font-medium' : 'text-oppose font-medium'}>{turnLabel}</span> to submit their argument
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Single-side placeholder when one argument exists but the other doesn't.
 */
function ArgumentPlaceholder({ 
  side, 
  isWaiting 
}: { 
  side: 'support' | 'oppose'; 
  isWaiting?: boolean;
}) {
  const sideConfig = side === 'support' 
    ? { label: 'For', color: 'text-support', bgColor: 'bg-support/5', borderColor: 'border-support/20' }
    : { label: 'Against', color: 'text-oppose', bgColor: 'bg-oppose/5', borderColor: 'border-oppose/20' };
  
  return (
    <article className={`border-2 border-dashed ${sideConfig.borderColor} rounded-lg p-5 ${sideConfig.bgColor}`}>
      <div className="flex items-center gap-3">
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          side === 'support' ? 'bg-support/10' : 'bg-oppose/10'
        }`}>
          <span className={`text-sm font-semibold ${sideConfig.color}`}>
            {side === 'support' ? 'F' : 'A'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${sideConfig.color}`}>{sideConfig.label}</p>
          <p className="text-sm text-text-tertiary">
            {isWaiting ? 'Waiting for submission...' : 'No argument submitted'}
          </p>
        </div>
        {isWaiting && (
          <ClockIcon size="sm" className="text-text-tertiary animate-pulse flex-shrink-0" decorative />
        )}
      </div>
    </article>
  );
}

export function ActiveRoundView({
  round,
  roundNumber,
  supportArgument,
  opposeArgument,
  supportAuthor,
  opposeAuthor,
  supportCitations = [],
  opposeCitations = [],
  isActiveRound,
  currentTurn,
  canSubmitArgument,
  userSide,
  isSubmitting = false,
  attributedArguments,
  highlightArgumentId,
  steelmanData,
  pendingReviews = [],
  prevRoundArguments,
  onCitationHover,
  onMindChanged,
  onArgumentSubmit,
  onSteelmanSubmit,
  onSteelmanReview,
  onSteelmanDelete,
  isSteelmanSubmitting = false,
}: ActiveRoundViewProps) {
  const sectionId = `active-round-${roundNumber}`;
  const isComplete = round.completedAt !== null;
  
  // Steelman gate: For rounds 2 and 3, check if user needs to submit/has approved steelman
  const requiresSteelman = roundNumber > 1 && userSide && isActiveRound;
  const steelmanApproved = steelmanData?.status === 'approved';
  const canProceedWithArgument = !requiresSteelman || steelmanApproved;
  
  // Get opponent's argument to steelman from PREVIOUS round (not current round)
  // For rounds 2-3, we need to steelman the opponent's argument from the previous round
  const opponentPrevArgument = prevRoundArguments 
    ? (userSide === 'support' ? prevRoundArguments.oppose : prevRoundArguments.support)
    : null;
  
  // Determine if we should show the submission form
  // Form is visible when: user is a debater, it's their turn, viewing active round, 
  // they haven't submitted yet, AND steelman gate is passed (for rounds 2-3)
  const showSupportForm = canSubmitArgument && 
    isActiveRound && 
    userSide === 'support' && 
    currentTurn === 'support' && 
    !supportArgument &&
    canProceedWithArgument;
    
  const showOpposeForm = canSubmitArgument && 
    isActiveRound && 
    userSide === 'oppose' && 
    currentTurn === 'oppose' && 
    !opposeArgument &&
    canProceedWithArgument;

  // Show steelman form if user needs to submit one
  const showSteelmanForm = requiresSteelman && 
    currentTurn === userSide && 
    !canProceedWithArgument &&
    opponentPrevArgument;
  
  return (
    <section 
      id={sectionId}
      data-round={roundNumber}
      className="scroll-mt-8"
      aria-labelledby={`round-${roundNumber}-header`}
    >
      {/* Pending steelman reviews (for opponent to review) */}
      {pendingReviews.length > 0 && opponentPrevArgument && (
        <div className="mb-5 space-y-3">
          {pendingReviews.map((review) => (
            <SteelmanReview
              key={review.id}
              steelman={review}
              targetArgument={opponentPrevArgument}
              onApprove={() => onSteelmanReview?.(review.id, true)}
              onReject={(reason) => onSteelmanReview?.(review.id, false, reason)}
              isSubmitting={isSteelmanSubmitting}
            />
          ))}
        </div>
      )}

      {/* Steelman form (for user to submit) */}
      {showSteelmanForm && opponentPrevArgument && (
        <div className="mb-5">
          <SteelmanForm
            targetArgument={opponentPrevArgument}
            roundNumber={roundNumber as 2 | 3}
            onSubmit={(content) => onSteelmanSubmit?.(opponentPrevArgument.id, content)}
            isSubmitting={isSteelmanSubmitting}
            existingSteelman={steelmanData?.steelman}
            onDelete={steelmanData?.steelman?.id ? () => onSteelmanDelete?.(steelmanData.steelman!.id) : undefined}
          />
        </div>
      )}
      
      {/* Arguments container */}
      {!supportArgument && !opposeArgument && !showSupportForm && !showOpposeForm ? (
        /* Both sides empty and no forms to show - use unified empty state */
        <EmptyRoundState 
          currentTurn={currentTurn}
          isActiveRound={isActiveRound}
        />
      ) : (
        <div className="space-y-5">
          {/* Support (FOR) argument or form */}
          {supportArgument ? (
            <ArgumentBlock
              argument={supportArgument}
              side="support"
              author={supportAuthor}
              citations={supportCitations}
              highlight={highlightArgumentId === supportArgument.id}
              onCitationHover={onCitationHover}
              onMindChanged={onMindChanged ? () => onMindChanged(supportArgument.id) : undefined}
              attributed={attributedArguments?.has(supportArgument.id) ?? false}
            />
          ) : showSupportForm && onArgumentSubmit ? (
            <ArgumentSubmissionForm
              roundType={round.roundType}
              side="support"
              onSubmit={onArgumentSubmit}
              isSubmitting={isSubmitting}
            />
          ) : (
            <ArgumentPlaceholder 
              side="support" 
              isWaiting={!isComplete && isActiveRound} 
            />
          )}
          
          {/* Oppose (AGAINST) argument or form */}
          {opposeArgument ? (
            <ArgumentBlock
              argument={opposeArgument}
              side="oppose"
              author={opposeAuthor}
              citations={opposeCitations}
              highlight={highlightArgumentId === opposeArgument.id}
              onCitationHover={onCitationHover}
              onMindChanged={onMindChanged ? () => onMindChanged(opposeArgument.id) : undefined}
              attributed={attributedArguments?.has(opposeArgument.id) ?? false}
            />
          ) : showOpposeForm && onArgumentSubmit ? (
            <ArgumentSubmissionForm
              roundType={round.roundType}
              side="oppose"
              onSubmit={onArgumentSubmit}
              isSubmitting={isSubmitting}
            />
          ) : (
            <ArgumentPlaceholder 
              side="oppose" 
              isWaiting={!isComplete && supportArgument !== null} 
            />
          )}
        </div>
      )}
    </section>
  );
}

export default ActiveRoundView;
