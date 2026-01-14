import { useState, useCallback } from 'react';
import { MenuIcon, XIcon, ChartIcon, ChevronUpIcon } from '../icons';

interface ThreeColumnLayoutProps {
  leftRail: React.ReactNode;
  centerPaper: React.ReactNode;
  rightMargin: React.ReactNode;
}

export function ThreeColumnLayout({ leftRail, centerPaper, rightMargin }: ThreeColumnLayoutProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  const toggleDrawer = useCallback(() => setIsDrawerOpen(prev => !prev), []);
  const toggleBottomSheet = useCallback(() => setIsBottomSheetOpen(prev => !prev), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);
  const closeBottomSheet = useCallback(() => setIsBottomSheetOpen(false), []);

  return (
    <div className="min-h-screen bg-page-bg">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-sticky bg-paper border-b border-hairline px-4 py-3 flex items-center justify-between">
        <button
          onClick={toggleDrawer}
          className="p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Open navigation"
        >
          <MenuIcon size="lg" decorative />
        </button>
        <span className="font-heading text-lg font-semibold">Debate</span>
        <button
          onClick={toggleBottomSheet}
          className="p-2 -mr-2 text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Open market data"
        >
          <ChartIcon size="lg" decorative />
        </button>
      </header>

      {/* Mobile Drawer Overlay */}
      {isDrawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-overlay bg-black/30"
          onClick={closeDrawer}
        />
      )}

      {/* Mobile Drawer (Left Rail) */}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-modal w-72 bg-paper shadow-modal transform transition-transform duration-300 ease-in-out ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-hairline flex items-center justify-between">
          <span className="font-heading text-lg font-semibold">Contents</span>
          <button
            onClick={closeDrawer}
            className="p-1 text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Close navigation"
          >
            <XIcon size="md" decorative />
          </button>
        </div>
        <div className="overflow-y-auto h-full pb-20">
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
      <div className="lg:hidden pt-14 pb-20">
        <main className="px-4 py-6">
          <div className="paper-surface px-4 py-6">
            {centerPaper}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Sheet Overlay */}
      {isBottomSheetOpen && (
        <div
          className="lg:hidden fixed inset-0 z-overlay bg-black/30"
          onClick={closeBottomSheet}
        />
      )}

      {/* Mobile Bottom Sheet (Right Margin) */}
      <div
        className={`lg:hidden fixed left-0 right-0 bottom-0 z-modal bg-paper rounded-t-xl shadow-modal transform transition-transform duration-300 ease-in-out ${
          isBottomSheetOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '70vh' }}
      >
        <div className="p-4 border-b border-hairline flex items-center justify-between">
          <span className="font-heading text-lg font-semibold">Market Data</span>
          <button
            onClick={closeBottomSheet}
            className="p-1 text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Close market data"
          >
            <XIcon size="md" decorative />
          </button>
        </div>
        <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(70vh - 60px)' }}>
          {rightMargin}
        </div>
      </div>

      {/* Mobile Sticky Bottom Bar (collapsed state) */}
      {!isBottomSheetOpen && (
        <div className="lg:hidden fixed left-0 right-0 bottom-0 z-sticky bg-paper border-t border-hairline px-4 py-3">
          <button
            onClick={toggleBottomSheet}
            className="w-full flex items-center justify-between text-text-secondary"
          >
            <span className="text-sm">View Market Data</span>
            <ChevronUpIcon size="md" decorative />
          </button>
        </div>
      )}
    </div>
  );
}
