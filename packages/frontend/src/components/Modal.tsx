import { useState, useEffect, type ReactNode } from 'react';
import { ModalOverlay, type ModalOverlayProps } from './ModalOverlay';
import { BottomSheet, type BottomSheetProps } from './BottomSheet';

// Breakpoint for mobile detection (matches Tailwind's sm breakpoint)
const MOBILE_BREAKPOINT = 640;

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
 * Hook to detect if viewport is mobile-sized
 */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Set initial value
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
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

// Export the hook for external use
export { useIsMobile };

export default Modal;
