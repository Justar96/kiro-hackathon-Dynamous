// ============================================
// Components - Main Barrel Export
// ============================================
// This file re-exports from subdirectory barrels to maintain
// backward compatibility with existing imports.

// ============================================
// Auth Components
// ============================================
export {
  // AuthProvider
  AuthProvider,
  validateUsername,
  // AuthModal
  AuthModalProvider,
  useAuthModal,
  useRequireAuth,
  AuthModalContext,
  // ProfileDropdown
  ProfileDropdown,
  // UserAvatar
  UserAvatar,
  // OnboardingToast
  OnboardingToast,
  useOnboardingToast,
  useAutoOnboarding,
} from './auth';
export type {
  ProfileDropdownProps,
  ProfileDropdownUser,
  PlatformUser,
  UserAvatarProps,
} from './auth';

// ============================================
// Common Components
// ============================================
export {
  // Hooks
  useIsMobile,
  // Modal Components
  Modal,
  ModalOverlay,
  BottomSheet,
  // Toast & Notifications
  ToastProvider,
  useToast,
  ToastContainer,
  ToastItem,
  // Error Handling
  ErrorBoundary,
  ErrorFallback,
  InlineError,
  ErrorMessage,
  // Loading States
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
  // Form Components
  FormField,
  // Connection Status
  ConnectionStatus,
} from './common';
export type {
  ModalProps,
  ModalOverlayProps,
  BottomSheetProps,
  ToastType,
  ToastAction,
  ToastOptions,
  Toast,
  ToastContextValue,
  ErrorBoundaryProps,
  ErrorFallbackProps,
  ErrorMessageProps,
  ErrorMessageVariant,
  SkeletonProps,
  SkeletonLoaderProps,
  SkeletonVariant,
  FormFieldProps,
  ConnectionStatusProps,
} from './common';

// ============================================
// Debate Components
// ============================================
export {
  // Core Debate Components
  ResolutionCard,
  DossierHeader,
  // Argument Components
  ArgumentBlock,
  ImpactBadge,
  MindChangedButton,
  // Evidence/Citation Components
  EvidenceFootnote,
  SourceCard,
  SourceCardContainer,
  useSourceCardState,
  // Round Components
  RoundSection,
  RoundProgressIndicator,
  RoundNavigator,
  RoundHistory,
  ActiveRoundView,
  ArgumentSubmissionForm,
  // Market Components
  MarketChart,
  StanceInput,
  DeltaLabel,
  // Audience Stats (for spectators)
  AudienceStats,
  // Comments
  SpectatorComments,
  // Steelman Gate
  SteelmanForm,
  SteelmanReview,
  SteelmanGateBadge,
  // New Debate Modal
  NewDebateModalProvider,
  useNewDebateModal,
  // Utilities
  getRoundLabel,
  deriveRoundStates,
  canNavigateToRound,
  generateExcerpt,
  getRoundConfig,
  getTurnLabel,
  getProgressText,
} from './debate';
export type {
  Citation,
  EvidenceSource,
  RoundSectionProps,
  ActiveRoundViewProps,
  SteelmanData,
  PendingReview,
  ArgumentSubmissionFormProps,
  RoundProgressIndicatorProps,
  RoundNavigatorProps,
  RoundHistoryProps,
  RoundStepState,
  RoundStep,
  RoundSummary,
  RoundSectionState,
} from './debate';

// ============================================
// Leaderboard Components
// ============================================
export { MindChangeLeaderboard, LeaderboardSection, TopArgumentsSection, TopUsersSection, TopArgumentCard, TopUserCard } from './leaderboard';
export type { TopArgument, TopUser } from './leaderboard';

// ============================================
// Index List Components
// ============================================
export { 
  DebateIndexList, 
  DebateIndexRow, 
  DebateTabs, 
  getPersistedTab, 
  TrendingDebatesCard,
  QuickStanceWidget,
  SeekingOpponentsSection,
  OnboardingBanner,
  resetOnboardingBanner,
  SandboxProgress,
} from './index-list';
export type { DebateTabType } from './index-list';

// ============================================
// Layout Components
// ============================================
export {
  ThreeColumnLayout,
  IndexThreeColumnLayout,
  LeftNavRail,
  useActiveSectionObserver,
  generateDebateRoundsLabel,
  createUnifiedTocSections,
  RightMarginRail,
} from './layout';
export type { NavSection } from './layout';
