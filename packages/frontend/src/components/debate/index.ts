// ============================================
// Debate Components - Barrel Export
// ============================================

// Core Debate Components
export { ResolutionCard } from './ResolutionCard';
export { DossierHeader } from './DossierHeader';

// Argument Components
export { ArgumentBlock, ImpactBadge, MindChangedButton } from './ArgumentBlock';
export type { Citation } from './ArgumentBlock';

// Reaction Display (Requirement 6.3 - Privacy-compliant aggregate counts)
export { ReactionDisplay } from './ReactionDisplay';
export type { default as ReactionDisplayProps } from './ReactionDisplay';

// Evidence/Citation Components
export { 
  EvidenceFootnote, 
  SourceCard, 
  SourceCardContainer,
  useSourceCardState,
} from './EvidenceFootnote';
export type { EvidenceSource } from './EvidenceFootnote';

// Round Components
export { RoundSection } from './RoundSection';
export type { RoundSectionProps } from './RoundSection';
export { RoundProgressIndicator } from './RoundProgressIndicator';
export { RoundHistory } from './RoundHistory';
export { ActiveRoundView } from './ActiveRoundView';
export type { ActiveRoundViewProps, SteelmanData, PendingReview } from './ActiveRoundView';
export { ArgumentSubmissionForm } from './ArgumentSubmissionForm';
export type { ArgumentSubmissionFormProps } from './ArgumentSubmissionForm';
export { CompactProgressBar, RoundDot, deriveRoundDotState, isRoundNavigable, getCompactProgressText } from './CompactProgressBar';
export type { CompactProgressBarProps, RoundDotProps, RoundDotState } from './CompactProgressBar';

// Types
export type { 
  RoundProgressIndicatorProps, 
  RoundHistoryProps,
  RoundStepState,
  RoundStep,
  RoundSummary,
  RoundSectionState,
} from './RoundSection.types';

// Utilities
export {
  getRoundLabel,
  deriveRoundStates,
  canNavigateToRound,
  generateExcerpt,
  getRoundDisplayConfig,
  getTurnLabel,
  getProgressText,
} from './RoundSection.utils';

// Market Components
export { MarketChart } from './MarketChart';
export { StanceInput, DeltaLabel } from './StanceInput';
export { SimpleStanceInput } from './SimpleStanceInput';

// Audience Stats (for spectators)
export { AudienceStats } from './AudienceStats';

// Comments
export { SpectatorComments } from './SpectatorComments';

// New Debate Modal
export { NewDebateModalProvider, useNewDebateModal } from './NewDebateModal';

// Steelman Gate
export { SteelmanForm, SteelmanReview, SteelmanGateBadge } from './SteelmanGate';

// Media Components (Requirements 2.1, 2.2, 2.3, 2.4)
export { MediaUploader } from './MediaUploader';
export type { MediaUploaderProps } from './MediaUploader';
export { MediaPreview } from './MediaPreview';
export type { MediaPreviewProps, PendingMedia } from './MediaPreview';

// Debate Lifecycle UX Components (Requirements 5.1, 5.2, 5.4, 5.5, 5.6)
export { DebateProgressIndicator, deriveRoundSteps, isUserTurn, getTurnDisplayLabel } from './DebateProgressIndicator';
export type { DebateProgressIndicatorProps, RoundStepInfo } from './DebateProgressIndicator';
export { 
  DebateResultsSummary, 
  deriveWinnerSide, 
  calculateNetPersuasionDelta, 
  extractResultsData,
  isResultsComplete,
} from './DebateResultsSummary';
export type { DebateResultsSummaryProps, DebateResultsData } from './DebateResultsSummary';
export { 
  ContextualHelpTooltip, 
  getPhaseHelpContent, 
  shouldShowHelp,
} from './ContextualHelpTooltip';
export type { ContextualHelpTooltipProps, PhaseHelpContent } from './ContextualHelpTooltip';
export {
  WaitingStateDisplay,
  calculateWaitEstimate,
  getMatchingStatusMessage,
} from './WaitingStateDisplay';
export type { WaitingStateDisplayProps, WaitTimeEstimate } from './WaitingStateDisplay';

// Spectator Engagement Components (Requirements 6.2, 6.3)
export { ArgumentAttributionPrompt } from './ArgumentAttributionPrompt';
export type { ArgumentAttributionPromptProps } from './ArgumentAttributionPrompt';
