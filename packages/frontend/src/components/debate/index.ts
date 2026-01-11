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
export { RoundSection, UnifiedRoundSection } from './RoundSection';
export type { RoundSectionProps } from './RoundSection';
export { RoundProgressIndicator } from './RoundProgressIndicator';
export { RoundNavigator } from './RoundNavigator';
export { RoundHistory } from './RoundHistory';
export { ActiveRoundView } from './ActiveRoundView';
export type { ActiveRoundViewProps } from './ActiveRoundView';
export { ArgumentSubmissionForm } from './ArgumentSubmissionForm';
export type { ArgumentSubmissionFormProps } from './ArgumentSubmissionForm';

// Types
export type { 
  RoundProgressIndicatorProps, 
  RoundNavigatorProps, 
  RoundHistoryProps,
  RoundStepState,
  RoundStep,
  RoundSummary,
  RoundSectionState,
  // Legacy aliases for backward compatibility
  UnifiedRoundSectionProps,
  UnifiedRoundSectionState,
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

// Comments
export { SpectatorComments } from './SpectatorComments';
