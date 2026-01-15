// ============================================
// Components - Main Barrel Export
// ============================================

// Auth Components
export {
  AuthProvider,
  validateUsername,
  AuthModalProvider,
  useAuthModal,
  useRequireAuth,
  AuthModalContext,
  ProfileDropdown,
  UserAvatar,
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

// Common Components
export {
  useIsMobile,
  Modal,
  ModalOverlay,
  BottomSheet,
  ToastProvider,
  useToast,
  ToastContainer,
  ToastItem,
  ErrorBoundary,
  ErrorFallback,
  InlineError,
  ErrorMessage,
  Skeleton,
  SkeletonText,
  SkeletonHeading,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonLoader,
  SkeletonParagraph,
  SkeletonButton,
  FormField,
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

// Market Components
export {
  MarketCard,
  OrderBook,
  TradingPanel,
  PortfolioView,
  CreateMarketForm,
  MarketChart,
} from './market';
export type { MarketFormData } from './market';

// Layout Components
export {
  ThreeColumnLayout,
  IndexThreeColumnLayout,
  LeftNavRail,
  RightMarginRail,
  MOBILE_BREAKPOINT,
} from './layout';

// UI Components
export { HorizontalDivider, SPACING_VALUES } from './ui';
export type { HorizontalDividerProps, DividerSpacing } from './ui';

// Icons
export {
  createIcon,
  useReducedMotion,
  BrandLogo,
  MenuIcon,
  XIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  CheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  WarningIcon,
  SpinnerIcon,
  InfoIcon,
  ClockIcon,
  ShieldCheckIcon,
  UserIcon,
  ChatIcon,
  SignOutIcon,
  ChartIcon,
  LightBulbIcon,
  TrendingUpIcon,
  ChatBubbleIcon,
} from './icons';
export type { IconSize, AnimationTrigger, IconProps, BrandLogoProps } from './icons';
