import { useState, useCallback } from 'react';
import { MenuIcon, XIcon, ChevronUpIcon } from '../icons';

interface ThreeColumnLayoutProps {
  leftRail: React.ReactNode;
  centerPaper: React.ReactNode;
  rightMargin: React.ReactNode;
  /** Optional: Current market percentages for mobile preview bar */
  marketPreview?: {
    forPercent: number;
    againstPercent: number;
  };
}

export function ThreeColumnLayout({ 
  leftRail, 
  centerPaper, 
  rightMargin,
  marketPreview 
}: ThreeColumnLayoutProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  const toggleDrawer = useCallback(() => setIsDrawerOpen(prev => !prev), []);
  const toggleBottomSheet = useCallback(() => setIsBottomSheetOpen(prev => !prev), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);
  const closeBottomSheet = useCallback(() => setIsBottomSheetOpen(false), []);

  return (
    <div className="min-h-screen bg-page-bg">
      {/* Mobile Header - Minimal, glassmorphic */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-sticky bg-paper/95 backdrop-blur-sm border-b border-divider shadow-paper">
        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={toggleDrawer}
            className="p-2.5 -ml-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-rule/50 active:bg-rule transition-colors"
            aria-label="Open navigation"
          >
            <MenuIcon size="lg" decorative />
          </button>
          
          {/* Mini market indicator in header */}
          {marketPreview && (
            <button
              onClick={toggleBottomSheet}
              className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-rule/30 hover:bg-rule/50 transition-colors"
              aria-label="View market details"
            >
              <span className="text-xs font-medium text-for">{marketPreview.forPercent}%</span>
              <div className="w-12 h-1 bg-rule rounded-full overflow-hidden flex">
                <div 
                  className="h-full bg-for transition-all duration-300" 
                  style={{ width: `${marketPreview.forPercent}%` }}
                />
                <div 
                  className="h-full bg-against transition-all duration-300" 
                  style={{ width: `${marketPreview.againstPercent}%` }}
                />
              </div>
              <span className="text-xs font-medium text-against">{marketPreview.againstPercent}%</span>
            </button>
          )}
          
          {!marketPreview && (
            <button
              onClick={toggleBottomSheet}
              className="p-2.5 -mr-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-rule/50 active:bg-rule transition-colors"
              aria-label="Open market data"
            >
              <ChevronUpIcon size="lg" decorative />
            </button>
          )}
        </div>
      </header>

      {/* Mobile Drawer Overlay - Smoother fade */}
      <div
        className={`lg:hidden fixed inset-0 z-overlay bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${
          isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeDrawer}
        aria-hidden={!isDrawerOpen}
      />

      {/* Mobile Drawer (Left Rail) - Cleaner, no header */}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-modal w-72 bg-paper shadow-modal transform transition-transform duration-300 ease-out ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Close button - floating */}
        <button
          onClick={closeDrawer}
          className="absolute top-3 right-3 p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-rule/50 transition-colors z-10"
          aria-label="Close navigation"
        >
          <XIcon size="md" decorative />
        </button>
        
        {/* Navigation content - full height scroll */}
        <div className="overflow-y-auto h-full pt-4 pb-8">
          {leftRail}
        </div>
      </aside>

      {/* Desktop Layout */}
      <div className="hidden lg:flex justify-center min-h-screen pt-6">
        {/* Left Rail - TOC Navigation */}
        <aside className="w-rail flex-shrink-0 sticky top-6 h-[calc(100vh-1.5rem)] overflow-y-auto pr-6 pt-6">
          {leftRail}
        </aside>

        {/* Center Paper - Main Content */}
        <main className="w-full max-w-paper flex-shrink-0 pb-6">
          <div className="paper-surface min-h-full px-10 py-6">
            {centerPaper}
          </div>
        </main>

        {/* Right Margin - Market Data & Stance */}
        <aside className="w-margin flex-shrink-0 sticky top-6 h-[calc(100vh-1.5rem)] overflow-y-auto pl-6 pt-6">
          {rightMargin}
        </aside>
      </div>

      {/* Mobile Content */}
      <div className="lg:hidden pt-12 pb-20">
        <main className="px-3 py-4">
          <div className="paper-surface px-4 py-5 rounded-lg">
            {centerPaper}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Sheet Overlay - Smoother fade */}
      <div
        className={`lg:hidden fixed inset-0 z-overlay bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${
          isBottomSheetOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeBottomSheet}
        aria-hidden={!isBottomSheetOpen}
      />

      {/* Mobile Bottom Sheet (Right Margin) - Modern sheet with drag handle */}
      <div
        className={`lg:hidden fixed left-0 right-0 bottom-0 z-modal bg-paper rounded-t-2xl shadow-modal transform transition-transform duration-300 ease-out ${
          isBottomSheetOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '75vh' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-rule rounded-full" />
        </div>
        
        {/* Sheet header */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide">Market & Stance</h2>
          <button
            onClick={closeBottomSheet}
            className="p-2 -mr-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-rule/50 transition-colors"
            aria-label="Close"
          >
            <XIcon size="md" decorative />
          </button>
        </div>
        
        {/* Sheet content */}
        <div className="overflow-y-auto px-4 pb-6" style={{ maxHeight: 'calc(75vh - 72px)' }}>
          {rightMargin}
        </div>
      </div>

      {/* Mobile Sticky Bottom Bar - Shows market preview when sheet is closed */}
      <div 
        className={`lg:hidden fixed left-0 right-0 bottom-0 z-sticky transition-transform duration-300 ${
          isBottomSheetOpen ? 'translate-y-full' : 'translate-y-0'
        }`}
      >
        <div className="bg-paper/95 backdrop-blur-sm border-t border-divider shadow-paper">
          <button
            onClick={toggleBottomSheet}
            className="w-full px-4 py-3 flex items-center justify-between active:bg-rule/30 transition-colors"
          >
            {marketPreview ? (
              <>
                {/* Market bar preview */}
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-sm font-semibold text-for">{marketPreview.forPercent}%</span>
                  <div className="flex-1 h-2 bg-rule rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-for transition-all duration-500" 
                      style={{ width: `${marketPreview.forPercent}%` }}
                    />
                    <div 
                      className="h-full bg-against transition-all duration-500" 
                      style={{ width: `${marketPreview.againstPercent}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-against">{marketPreview.againstPercent}%</span>
                </div>
                <ChevronUpIcon size="md" className="text-text-tertiary ml-3" decorative />
              </>
            ) : (
              <>
                <span className="text-sm text-text-secondary">View Market & Stance</span>
                <ChevronUpIcon size="md" className="text-text-tertiary" decorative />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
