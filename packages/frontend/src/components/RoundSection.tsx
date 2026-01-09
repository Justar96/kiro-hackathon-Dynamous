import type { Round, Argument, User } from '@debate-platform/shared';
import { ArgumentBlock, type Citation } from './ArgumentBlock';

interface RoundSectionProps {
  round: Round;
  roundNumber: 1 | 2 | 3;
  supportArgument?: Argument | null;
  opposeArgument?: Argument | null;
  supportAuthor?: User | null;
  opposeAuthor?: User | null;
  supportCitations?: Citation[];
  opposeCitations?: Citation[];
  onAttributeImpact?: (argumentId: string) => void;
  onCitationHover?: (citation: Citation | null, position: { top: number }) => void;
  /** Callback when user clicks "This changed my mind" on an argument */
  onMindChanged?: (argumentId: string) => void;
}

/**
 * RoundSection displays a section in the dossier for one debate round.
 * Shows section header (Round 1: Openings), FOR and AGAINST ArgumentBlocks.
 * Includes scroll anchor for TOC navigation.
 * 
 * The Round 2 section (id="round-2") is used as the trigger for unlocking
 * the After stance slider via IntersectionObserver.
 * 
 * Requirements: 10.1, 10.3, 10.6
 */
export function RoundSection({
  round,
  roundNumber,
  supportArgument,
  opposeArgument,
  supportAuthor,
  opposeAuthor,
  supportCitations = [],
  opposeCitations = [],
  onAttributeImpact,
  onCitationHover,
  onMindChanged,
}: RoundSectionProps) {
  const roundConfig = getRoundConfig(round.roundType);
  const sectionId = `round-${roundNumber}`;
  const isComplete = round.completedAt !== null;
  const hasArguments = supportArgument || opposeArgument;
  
  return (
    <section 
      id={sectionId}
      data-round={roundNumber}
      className="mb-12 scroll-mt-8"
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
        {/* Support (FOR) argument */}
        {supportArgument ? (
          <ArgumentBlock
            argument={supportArgument}
            side="support"
            author={supportAuthor}
            citations={supportCitations}
            onAttributeImpact={onAttributeImpact ? () => onAttributeImpact(supportArgument.id) : undefined}
            onCitationHover={onCitationHover}
            onMindChanged={onMindChanged ? () => onMindChanged(supportArgument.id) : undefined}
          />
        ) : (
          <ArgumentPlaceholder side="support" isWaiting={!isComplete} />
        )}
        
        {/* Oppose (AGAINST) argument */}
        {opposeArgument ? (
          <ArgumentBlock
            argument={opposeArgument}
            side="oppose"
            author={opposeAuthor}
            citations={opposeCitations}
            onAttributeImpact={onAttributeImpact ? () => onAttributeImpact(opposeArgument.id) : undefined}
            onCitationHover={onCitationHover}
            onMindChanged={onMindChanged ? () => onMindChanged(opposeArgument.id) : undefined}
          />
        ) : (
          <ArgumentPlaceholder side="oppose" isWaiting={!isComplete && !!hasArguments} />
        )}
      </div>
    </section>
  );
}

interface ArgumentPlaceholderProps {
  side: 'support' | 'oppose';
  isWaiting?: boolean;
}

/**
 * Placeholder shown when an argument hasn't been submitted yet.
 */
function ArgumentPlaceholder({ side, isWaiting }: ArgumentPlaceholderProps) {
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

function getRoundConfig(roundType: Round['roundType']): { title: string; description: string } {
  switch (roundType) {
    case 'opening':
      return {
        title: 'Openings',
        description: 'Each side presents their initial position and key arguments.',
      };
    case 'rebuttal':
      return {
        title: 'Rebuttals',
        description: 'Each side responds to the opposing arguments.',
      };
    case 'closing':
      return {
        title: 'Closings',
        description: 'Each side summarizes their case and makes final appeals.',
      };
    default:
      return {
        title: 'Arguments',
        description: '',
      };
  }
}

export default RoundSection;
