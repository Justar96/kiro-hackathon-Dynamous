import { useEffect, useRef, useCallback, useState, type ReactNode, type TouchEvent } from 'react';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  snapPoints?: number[]; // Heights as percentages (e.g., [50, 90])
  initialSnap?: number; // Index of initial snap point
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
}

const DEFAULT_SNAP_POINTS = [50, 90]; // 50% and 90% of viewport height
const SWIPE_THRESHOLD = 50; // Minimum swipe distance to trigger close
const VELOCITY_THRESHOLD = 0.5; // Minimum velocity to trigger close

/**
 * BottomSheet - Mobile-specific modal variant that slides up from bottom
 * 
 * Features:
 * - Slide-up animation
 * - Swipe-to-dismiss gesture
 * - Snap points support
 */
export function BottomSheet({
  isOpen,
  onClose,
  children,
  snapPoints = DEFAULT_SNAP_POINTS,
  initialSnap = 0,
  ariaLabelledBy,
  ariaDescribedBy,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    startY: 0,
    currentY: 0,
    startTime: 0,
    isDragging: false,
  });
  
  const [currentSnapIndex, setCurrentSnapIndex] = useState(initialSnap);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Get current snap point height
  const currentHeight = snapPoints[currentSnapIndex] || snapPoints[0];

  // Handle touch start
  const handleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    dragRef.current = {
      startY: touch.clientY,
      currentY: touch.clientY,
      startTime: Date.now(),
      isDragging: true,
    };
    setIsDragging(true);
  }, []);

  // Handle touch move
  const handleTouchMove = useCallback((e: TouchEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDragging) return;
    
    const touch = e.touches[0];
    const deltaY = touch.clientY - dragRef.current.startY;
    dragRef.current.currentY = touch.clientY;
    
    // Only allow dragging down (positive deltaY)
    if (deltaY > 0) {
      setTranslateY(deltaY);
    }
  }, []);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    if (!dragRef.current.isDragging) return;
    
    const deltaY = dragRef.current.currentY - dragRef.current.startY;
    const deltaTime = Date.now() - dragRef.current.startTime;
    const velocity = deltaY / deltaTime;
    
    dragRef.current.isDragging = false;
    setIsDragging(false);
    
    // Check if should close based on swipe distance or velocity
    if (deltaY > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      onClose();
    } else {
      // Snap back to current position
      setTranslateY(0);
    }
  }, [onClose]);

  // Handle drag handle click to cycle snap points
  const handleSnapPointChange = useCallback(() => {
    const nextIndex = (currentSnapIndex + 1) % snapPoints.length;
    setCurrentSnapIndex(nextIndex);
  }, [currentSnapIndex, snapPoints.length]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTranslateY(0);
      setCurrentSnapIndex(initialSnap);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialSnap]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal" role="presentation">
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-overlay bg-black/50 animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        className={`
          absolute bottom-0 left-0 right-0
          bg-paper rounded-t-xl shadow-modal
          ${isDragging ? '' : 'transition-transform duration-300 ease-out'}
          animate-in slide-in-from-bottom duration-300
        `}
        style={{
          height: `${currentHeight}vh`,
          transform: `translateY(${translateY}px)`,
          maxHeight: '95vh',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle - 44px minimum touch target for accessibility (Requirement 8.4) */}
        <div 
          className="flex justify-center py-3 cursor-grab active:cursor-grabbing min-h-[44px]"
          onClick={handleSnapPointChange}
          role="button"
          aria-label="Drag to resize or tap to change size"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleSnapPointChange();
            }
          }}
        >
          <div className="w-10 h-1 bg-text-tertiary/40 rounded-full" />
        </div>
        
        {/* Content */}
        <div className="overflow-y-auto px-4 pb-4" style={{ maxHeight: `calc(${currentHeight}vh - 48px)` }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default BottomSheet;
