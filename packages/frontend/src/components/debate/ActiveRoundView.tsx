/**
 * ActiveRoundView displays the currently viewed round's full content.
 * Shows round header, ArgumentBlock components for both sides, and
 * ArgumentSubmissionForm when appropriate.
 * 
 * Requirements: 1.1, 7.1, 7.4
 */

import type { Round, Argument, User } from '@debate-platform/shared';
import { ArgumentBlock, type Citation } from './ArgumentBlock';
import { ArgumentSubmissionForm } from './ArgumentSubmissionForm';
import { getRoundConfig } from './RoundSection.utils';

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
  /** 
   * Set of argument IDs that have been attributed as "changed my mind".
   * Used to show the attributed state on the button.
   * Requirements: 5.5
   */
  attributedArguments?: Set<string>;
  onCitationHover?: (citation: Citation | null, position: { top: number }) => void;
  onMindChanged?: (argumentId: string) => void;
  onArgumentSubmit?: (content: string) => void;
}

/**
 * Placeholder shown when an argument hasn't been submitted yet.
 */
function ArgumentPlaceholder({ 
  side, 
  isWaiting 
}: { 
  side: 'support' | 'oppose'; 
  isWaiting?: boolean;
}) {
  const sideConfig = side === 'support' 
    ? { label: 'For', color: 'text-support' }
    : { label: 'Against', color: 'text-oppose' };
  
  return (
    <div className="mb-8 last:mb-0">
      {/* Side label */}
      <div className="mb-2">
        <span className={`text-label uppercase tracking-wider ${sideConfig.color}`}>
          {sideConfig.label}
        </span>
      </div>
      
      {/* Placeholder content */}
      <div className="py-8 px-6 bg-gray-50 rounded-subtle border border-dashed border-gray-200">
        <p className="text-body-small text-text-tertiary text-center">
          {isWaiting ? 'Waiting for argument...' : 'No argument submitted'}
        </p>
      </div>
    </div>
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
  onCitationHover,
  onMindChanged,
  onArgumentSubmit,
}: ActiveRoundViewProps) {
  const roundConfig = getRoundConfig(round.roundType);
  const sectionId = `active-round-${roundNumber}`;
  const isComplete = round.completedAt !== null;
  const hasArguments = supportArgument || opposeArgument;
  
  // Determine if we should show the submission form
  // Form is visible when: user is a debater, it's their turn, viewing active round, and they haven't submitted yet
  const showSupportForm = canSubmitArgument && 
    isActiveRound && 
    userSide === 'support' && 
    currentTurn === 'support' && 
    !supportArgument;
    
  const showOpposeForm = canSubmitArgument && 
    isActiveRound && 
    userSide === 'oppose' && 
    currentTurn === 'oppose' && 
    !opposeArgument;
  
  return (
    <section 
      id={sectionId}
      data-round={roundNumber}
      className="scroll-mt-8"
      aria-labelledby={`${sectionId}-heading`}
    >
      {/* Section header */}
      <header className="mb-6 pb-3 border-b border-gray-100">
        <h2 
          id={`${sectionId}-heading`}
          className="font-heading text-heading-2 text-text-primary"
        >
          Round {roundNumber}: {roundConfig.title}
        </h2>
        <p className="text-body-small text-text-secondary mt-1">
          {roundConfig.description}
        </p>
      </header>
      
      {/* Arguments container */}
      <div className="space-y-8">
        {/* Support (FOR) argument or form */}
        {supportArgument ? (
          <ArgumentBlock
            argument={supportArgument}
            side="support"
            author={supportAuthor}
            citations={supportCitations}
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
            isWaiting={!isComplete && !!hasArguments} 
          />
        )}
      </div>
    </section>
  );
}

export default ActiveRoundView;
