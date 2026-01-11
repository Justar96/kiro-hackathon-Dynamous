// Core UI Components
export { ResolutionCard } from './ResolutionCard';
export { MarketChart } from './MarketChart';
export { StanceInput, DeltaLabel } from './StanceInput';

// Index/List Components
export { DebateIndexRow } from './DebateIndexRow';
export { DebateIndexList } from './DebateIndexList';

// Layout Components
export { ThreeColumnLayout } from './ThreeColumnLayout';
export { LeftNavRail, useActiveSectionObserver, generateDebateRoundsLabel, createUnifiedTocSections } from './LeftNavRail';
export type { NavSection } from './LeftNavRail';
export { RightMarginRail } from './RightMarginRail';

// Dossier Components
export { DossierHeader } from './DossierHeader';
export { ArgumentBlock, ImpactBadge, MindChangedButton } from './ArgumentBlock';
export type { Citation } from './ArgumentBlock';
export { 
  EvidenceFootnote, 
  SourceCard, 
  SourceCardContainer,
  useSourceCardState,
} from './EvidenceFootnote';
export type { EvidenceSource } from './EvidenceFootnote';
export { RoundSection } from './RoundSection';
export { RoundProgressIndicator } from './RoundProgressIndicator';
export { RoundNavigator } from './RoundNavigator';
export { RoundHistory } from './RoundHistory';
export { ActiveRoundView } from './ActiveRoundView';
export type { ActiveRoundViewProps } from './ActiveRoundView';
export { ArgumentSubmissionForm } from './ArgumentSubmissionForm';
export type { ArgumentSubmissionFormProps } from './ArgumentSubmissionForm';
export { UnifiedRoundSection } from './UnifiedRoundSection';
export type { UnifiedRoundSectionProps } from './UnifiedRoundSection';
export type { RoundProgressIndicatorProps, RoundNavigatorProps, RoundHistoryProps } from './UnifiedRoundSection.types';
export { SpectatorComments } from './SpectatorComments';

// Auth Components
export { AuthProvider, validateUsername } from './AuthProvider';
export { AuthModalProvider, useAuthModal, useRequireAuth } from './AuthModal';
export { UserAvatar } from './UserAvatar';
export type { UserAvatarProps } from './UserAvatar';
export { ProfileDropdown } from './ProfileDropdown';
export type { ProfileDropdownProps, ProfileDropdownUser } from './ProfileDropdown';
export { OnboardingToast, useOnboardingToast, useAutoOnboarding } from './OnboardingToast';

// Modal Components
export { ModalOverlay } from './ModalOverlay';
export type { ModalOverlayProps } from './ModalOverlay';
export { BottomSheet } from './BottomSheet';
export type { BottomSheetProps } from './BottomSheet';
export { Modal, useIsMobile } from './Modal';
export type { ModalProps } from './Modal';

// Loading & Error Components
export { ToastProvider, useToast, ToastContainer, ToastItem } from './Toast';
export type { ToastType, ToastAction, ToastOptions, Toast, ToastContextValue } from './Toast';
export { ErrorBoundary, ErrorFallback, InlineError } from './ErrorBoundary';
export type { ErrorBoundaryProps, ErrorFallbackProps } from './ErrorBoundary';
export { ErrorMessage } from './ErrorMessage';
export type { ErrorMessageProps, ErrorMessageVariant } from './ErrorMessage';
export { 
  Skeleton, 
  SkeletonText, 
  SkeletonHeading, 
  SkeletonAvatar,
  SkeletonCard,
  SkeletonDebateRow,
  SkeletonArgumentBlock,
  SkeletonMarketData,
  SkeletonStatCard,
  SkeletonLoader,
  SkeletonParagraph,
  SkeletonButton,
} from './Skeleton';
export type { SkeletonProps, SkeletonLoaderProps, SkeletonVariant } from './Skeleton';

// Form Components
export { FormField } from './FormField';
export type { FormFieldProps } from './FormField';

// Connection Status
export { ConnectionStatus } from './ConnectionStatus';
export type { ConnectionStatusProps } from './ConnectionStatus';
