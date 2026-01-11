import { useEffect, useRef, useCallback, type ReactNode } from 'react';

/**
 * Get the width of the scrollbar to prevent layout shift
 */
function getScrollbarWidth(): number {
  // If there's no scrollbar (content doesn't overflow), return 0
  if (document.documentElement.scrollHeight <= document.documentElement.clientHeight) {
    return 0;
  }
  return window.innerWidth - document.documentElement.clientWidth;
}

/**
 * Lock body scroll while preserving layout (no shift)
 * Returns a cleanup function to restore original state
 */
function lockBodyScroll(): () => void {
  const scrollbarWidth = getScrollbarWidth();
  const originalPaddingRight = document.body.style.paddingRight;
  const originalOverflow = document.body.style.overflow;

  // Add padding to compensate for scrollbar removal
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
  document.body.style.overflow = 'hidden';

  return () => {
    document.body.style.paddingRight = originalPaddingRight;
    document.body.style.overflow = originalOverflow;
  };
}

export interface ModalOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  trapFocus?: boolean;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

/**
 * ModalOverlay - Base modal component with accessibility features
 * 
 * Features:
 * - Backdrop dimming
 * - Click-outside-to-close
 * - Escape key handler
 * - Focus trap for accessibility
 * - Size variants (sm, md, lg)
 */
export function ModalOverlay({
  isOpen,
  onClose,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  trapFocus = true,
  ariaLabelledBy,
  ariaDescribedBy,
}: ModalOverlayProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Get all focusable elements within the modal
  const getFocusableElements = useCallback(() => {
    if (!modalRef.current) return [];
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');
    return Array.from(modalRef.current.querySelectorAll<HTMLElement>(focusableSelectors));
  }, []);

  // Document-level keyboard handler for focus trap and escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Escape key
      if (closeOnEscape && event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      // Handle Tab key for focus trap
      if (trapFocus && event.key === 'Tab') {
        const focusableElements = getFocusableElements();
        if (focusableElements.length === 0) {
          event.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          // Shift + Tab: if on first element, go to last
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: if on last element, go to first
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    // Use capture phase to intercept before native focus handling
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, closeOnEscape, trapFocus, onClose, getFocusableElements]);

  // Lock body scroll and manage focus when modal opens/closes
  useEffect(() => {
    if (!isOpen) return;

    // Store the currently focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Lock body scroll with scrollbar compensation to prevent layout shift
    const unlockScroll = lockBodyScroll();

    // Focus the first focusable element in the modal
    requestAnimationFrame(() => {
      const focusableElements = getFocusableElements();
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      } else {
        // If no focusable elements, focus the modal itself
        modalRef.current?.focus();
      }
    });

    return () => {
      // Unlock body scroll
      unlockScroll();

      // Restore focus to the previously focused element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, getFocusableElements]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - separate fixed layer */}
      <div
        className="fixed inset-0 z-overlay bg-black/50 animate-in fade-in duration-200"
        aria-hidden="true"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />

      {/* Modal container */}
      <div
        className="fixed inset-0 z-modal flex items-center justify-center p-4 pointer-events-none"
        role="presentation"
      >
        {/* Modal content */}
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          tabIndex={-1}
          className={`
            relative w-full ${sizeClasses[size]}
            bg-paper rounded-small shadow-modal
            animate-in zoom-in-95 fade-in duration-200
            focus:outline-none pointer-events-auto
          `}
        >
          {children}
        </div>
      </div>
    </>
  );
}

export default ModalOverlay;
