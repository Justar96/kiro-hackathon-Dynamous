/**
 * Types and interfaces for the RoundSection component and its children.
 * 
 * Requirements: 1.1, 2.4
 */

import type { Debate, Round, Argument, User } from '@debate-platform/shared';
import type { Citation } from './ArgumentBlock';

/**
 * Visual states for each round step in the progress indicator and navigator.
 * - completed: Round has finished (completedAt !== null)
 * - active: Current round in an active debate
 * - pending: Future round with no content yet
 * - viewing-history: User is viewing a completed round that isn't the active one
 */
export type RoundStepState = 'completed' | 'active' | 'pending' | 'viewing-history';

/**
 * Represents a single round step in the navigator/progress indicator.
 */
export interface RoundStep {
  roundNumber: 1 | 2 | 3;
  label: string; // "Opening", "Rebuttal", "Closing"
  state: RoundStepState;
  hasArguments: boolean;
}

/**
 * Summary of a completed round for the history view.
 */
export interface RoundSummary {
  roundNumber: 1 | 2 | 3;
  roundType: 'opening' | 'rebuttal' | 'closing';
  supportExcerpt: string; // First 100 chars of support argument
  opposeExcerpt: string;  // First 100 chars of oppose argument
  completedAt: Date;
}

/**
 * Props for the main RoundSection container component.
 */
export interface RoundSectionProps {
  debate: Debate;
  rounds: Round[];
  supportDebater?: User | null;
  opposeDebater?: User | null;
  currentUserId?: string;
  /** Arguments indexed by round number and side */
  arguments?: {
    [roundNumber: number]: {
      support?: Argument | null;
      oppose?: Argument | null;
    };
  };
  /** Citations for arguments */
  citations?: {
    [argumentId: string]: Citation[];
  };
  onCitationHover?: (citation: Citation | null, position: { top: number }) => void;
  onMindChanged?: (argumentId: string) => void;
  onArgumentSubmit?: (content: string) => void;
}

/**
 * Internal state for RoundSection.
 */
export interface RoundSectionState {
  viewedRound: 1 | 2 | 3;
  historyExpanded: boolean;
}

/**
 * Props for RoundProgressIndicator component.
 */
export interface RoundProgressIndicatorProps {
  currentRound: 1 | 2 | 3;
  currentTurn: 'support' | 'oppose';
  debateStatus: 'active' | 'concluded';
  viewedRound: 1 | 2 | 3;
  rounds: Round[];
}

/**
 * Props for RoundNavigator component.
 */
export interface RoundNavigatorProps {
  rounds: Round[];
  currentRound: 1 | 2 | 3;
  viewedRound: 1 | 2 | 3;
  onRoundSelect: (round: 1 | 2 | 3) => void;
}

/**
 * Props for RoundHistory component.
 */
export interface RoundHistoryProps {
  completedRounds: Round[];
  supportDebater?: User | null;
  opposeDebater?: User | null;
  /** Arguments for completed rounds */
  arguments?: {
    [roundNumber: number]: {
      support?: Argument | null;
      oppose?: Argument | null;
    };
  };
  expanded: boolean;
  onToggle: () => void;
  onRoundClick: (roundNumber: 1 | 2 | 3) => void;
}

/**
 * Props for ActiveRoundView component.
 */
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
 * Props for ArgumentSubmissionForm component.
 */
export interface ArgumentSubmissionFormProps {
  roundType: 'opening' | 'rebuttal' | 'closing';
  side: 'support' | 'oppose';
  onSubmit: (content: string) => void;
  isSubmitting: boolean;
}

// Legacy aliases for backward compatibility
export type UnifiedRoundSectionProps = RoundSectionProps;
export type UnifiedRoundSectionState = RoundSectionState;
