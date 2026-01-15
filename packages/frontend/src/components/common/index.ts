// ============================================
// Common Components Barrel Export
// ============================================

// Hooks
export { useIsMobile } from './hooks';

// Modal Components
export { Modal } from './Modal';
export type { ModalProps } from './Modal';
export { ModalOverlay } from './ModalOverlay';
export type { ModalOverlayProps } from './ModalOverlay';
export { BottomSheet } from './BottomSheet';
export type { BottomSheetProps } from './BottomSheet';

// Toast & Notifications
export { ToastProvider, useToast, useToastOptional, ToastContainer, ToastItem } from './Toast';
export type { ToastType, ToastAction, ToastOptions, Toast, ToastContextValue } from './Toast';

// Error Handling
export { ErrorBoundary, ErrorFallback, InlineError } from './ErrorBoundary';
export type { ErrorBoundaryProps, ErrorFallbackProps } from './ErrorBoundary';
export { ErrorMessage } from './ErrorMessage';
export type { ErrorMessageProps, ErrorMessageVariant } from './ErrorMessage';

// Loading States
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
