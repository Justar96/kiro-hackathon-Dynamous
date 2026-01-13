/**
 * ActiveRoundView displays the currently viewed round's full content.
 * Shows ArgumentBlock components for both sides, and
 * ArgumentSubmissionForm when appropriate.
 * 
 * Note: Round header is rendered by parent RoundSection component.
 * 
 * Requirements: 1.1, 7.1, 7.4
 * Paper Polish Requirements: 5.1 (minimize visual chrome), 7.1, 7.2
 */

import type { Round, Argument, User } from '@debate-platform/shared';
import { ArgumentBlock, type Citation } from './ArgumentBlock';
import { ArgumentSubmissionForm } from './ArgumentSubmissionForm';

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
 * Styled to match the paper aesthetic with minimal visual chrome.
 * 
 * Paper Polish Requirements: 5.1 (minimize visual chrome)
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
      }
    : { 
        label: 'Against', 
        color: 'text-oppose', 
      };
  
  return (
    <article className="bg-white border border-dashed border-divider rounded-subtle overflow-hidden">
      {/* Byline Header - Matches ArgumentBlock structure (Req 5.2, 5.4) */}
      <div className="px-5 pt-4 pb-2 flex items-baseline gap-2">
        {/* Side label with small-caps styling */}
        <span className={`small-caps text-xs font-medium ${sideConfig.color}`}>
          {sideConfig.label}
        </span>
        <span className="text-divider">—</span>
        <span className="text-body-small text-text-tertiary italic">
          Awaiting submission
        </span>
      </div>
      
      {/* Card Body - Placeholder content with paper aesthetic */}
      <div className="px-5 pb-5 pt-2">
        <div className="flex items-center gap-3 text-text-tertiary">
          {isWaiting ? (
            <>
              <svg className="w-4 h-4 animate-pulse flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-body-small leading-relaxed">
                Waiting for argument to be submitted...
              </p>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-body-small leading-relaxed">
                No argument has been submitted for this position.
              </p>
            </>
          )}
        </div>
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
  onCitationHover,
  onMindChanged,
  onArgumentSubmit,
}: ActiveRoundViewProps) {
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
      {/* Arguments container - header is now in parent RoundSection */}
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
