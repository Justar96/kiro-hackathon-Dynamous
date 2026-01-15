/**
 * Types and interfaces for the RoundSection component and its children.
 */

import type { Debate, Round, Argument, User, RoundNumber, RoundType, Side } from '@thesis/shared';
import type { Citation } from './ArgumentBlock';

/** Visual states for each round step */
export type RoundStepState = 'completed' | 'active' | 'pending' | 'viewing-history';

export interface RoundStep {
  roundNumber: RoundNumber;
  label: string;
  state: RoundStepState;
  hasArguments: boolean;
}

export interface RoundSummary {
  roundNumber: RoundNumber;
  roundType: RoundType;
  supportExcerpt: string;
  opposeExcerpt: string;
  completedAt: Date;
}

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
  onCitationHover?: (citation: Citation | null, position: { top: number }) => void;
  onMindChanged?: (argumentId: string) => void;
  onArgumentSubmit?: (content: string) => void;
}

export interface RoundSectionState {
  viewedRound: RoundNumber;
  historyExpanded: boolean;
}

export interface RoundProgressIndicatorProps {
  currentRound: RoundNumber;
  currentTurn: Side;
  debateStatus: 'pending' | 'active' | 'concluded';
  viewedRound: RoundNumber;
  rounds: Round[];
  onRoundSelect?: (round: RoundNumber) => void;
}

export interface RoundHistoryProps {
  completedRounds: Round[];
  supportDebater?: User | null;
  opposeDebater?: User | null;
  arguments?: { [roundNumber: number]: { support?: Argument | null; oppose?: Argument | null } };
  expanded: boolean;
  onToggle: () => void;
  onRoundClick: (roundNumber: RoundNumber) => void;
}

export interface ActiveRoundViewProps {
  round: Round;
  roundNumber: RoundNumber;
  supportArgument?: Argument | null;
  opposeArgument?: Argument | null;
  supportAuthor?: User | null;
  opposeAuthor?: User | null;
  supportCitations?: Citation[];
  opposeCitations?: Citation[];
  isActiveRound: boolean;
  currentTurn?: Side;
  canSubmitArgument: boolean;
  userSide?: Side;
  isSubmitting?: boolean;
  attributedArguments?: Set<string>;
  onCitationHover?: (citation: Citation | null, position: { top: number }) => void;
  onMindChanged?: (argumentId: string) => void;
  onArgumentSubmit?: (content: string) => void;
}

export interface ArgumentSubmissionFormProps {
  roundType: RoundType;
  side: Side;
  onSubmit: (content: string) => void;
  isSubmitting: boolean;
}
