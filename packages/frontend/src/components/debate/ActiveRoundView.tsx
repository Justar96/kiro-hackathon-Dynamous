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
    ? { 
        label: 'For', 
        color: 'text-support', 
        borderColor: 'border-support/20',
        headerBg: 'bg-support/5',
      }
    : { 
        label: 'Against', 
        color: 'text-oppose', 
        borderColor: 'border-oppose/20',
        headerBg: 'bg-oppose/5',
      };
  
  return (
    <div className={`rounded-lg border border-dashed ${sideConfig.borderColor} bg-white overflow-hidden`}>
      {/* Card Header */}
      <div className={`px-5 py-3 border-b border-dashed ${sideConfig.headerBg} ${sideConfig.borderColor}`}>
        <span className={`text-xs font-semibold uppercase tracking-wider ${sideConfig.color}`}>
          {sideConfig.label}
        </span>
      </div>
      
      {/* Card Body - Placeholder content */}
      <div className="px-5 py-10 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 mb-3">
          {isWaiting ? (
            <svg className="w-5 h-5 text-text-tertiary animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          )}
        </div>
        <p className="text-sm text-text-tertiary">
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
      {/* Section header - minimal */}
      <header className="mb-5">
        <h2 
          id={`${sectionId}-heading`}
          className="text-lg font-semibold text-text-primary"
        >
          {roundConfig.title}
        </h2>
        <p className="text-sm text-text-secondary mt-0.5">
          {roundConfig.description}
        </p>
      </header>
      
      {/* Arguments container */}
      <div className="space-y-5">
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
