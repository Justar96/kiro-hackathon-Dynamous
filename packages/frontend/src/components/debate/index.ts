// ============================================
// Debate Components - Barrel Export
// ============================================

// Core Debate Components
export { ResolutionCard } from './ResolutionCard';
export { DossierHeader } from './DossierHeader';

// Argument Components
export { ArgumentBlock, ImpactBadge, MindChangedButton } from './ArgumentBlock';
export type { Citation } from './ArgumentBlock';

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
// Note: RoundProgressIndicator and RoundNavigator are deprecated - use CompactProgressBar instead
export { RoundHistory } from './RoundHistory';
export { ActiveRoundView } from './ActiveRoundView';
export type { ActiveRoundViewProps } from './ActiveRoundView';
export { ArgumentSubmissionForm } from './ArgumentSubmissionForm';
export type { ArgumentSubmissionFormProps } from './ArgumentSubmissionForm';
export { CompactProgressBar, RoundDot, deriveRoundDotState, isRoundNavigable, getCompactProgressText } from './CompactProgressBar';
export type { CompactProgressBarProps, RoundDotProps, RoundDotState } from './CompactProgressBar';

// Types
export type { 
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
  getRoundConfig,
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
