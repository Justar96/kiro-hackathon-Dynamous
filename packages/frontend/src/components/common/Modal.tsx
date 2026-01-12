import { type ReactNode } from 'react';
import { ModalOverlay, type ModalOverlayProps } from './ModalOverlay';
import { BottomSheet, type BottomSheetProps } from './BottomSheet';
import { useIsMobile } from './hooks';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  // ModalOverlay props
  size?: ModalOverlayProps['size'];
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  trapFocus?: boolean;
  // BottomSheet props
  snapPoints?: BottomSheetProps['snapPoints'];
  initialSnap?: BottomSheetProps['initialSnap'];
  // Accessibility
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
}

/**
 * Modal - Responsive modal wrapper component
 * 
 * Automatically renders:
 * - BottomSheet on mobile viewports (<640px)
 * - ModalOverlay on tablet/desktop viewports (≥640px)
 * 
 * Requirements: 8.1, 8.2
 */
export function Modal({
  isOpen,
  onClose,
  children,
  // ModalOverlay props
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  trapFocus = true,
  // BottomSheet props
  snapPoints,
  initialSnap,
  // Accessibility
  ariaLabelledBy,
  ariaDescribedBy,
}: ModalProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        snapPoints={snapPoints}
        initialSnap={initialSnap}
        ariaLabelledBy={ariaLabelledBy}
        ariaDescribedBy={ariaDescribedBy}
      >
        {children}
      </BottomSheet>
    );
  }

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      size={size}
      closeOnOverlayClick={closeOnOverlayClick}
      closeOnEscape={closeOnEscape}
      trapFocus={trapFocus}
      ariaLabelledBy={ariaLabelledBy}
      ariaDescribedBy={ariaDescribedBy}
    >
      {children}
    </ModalOverlay>
  );
}

export default Modal;
