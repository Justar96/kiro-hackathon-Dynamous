import { useState, useCallback } from 'react';

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
          className="p-2 -ml-2 text-text-secondary hover:text-text-primary"
          aria-label="Open navigation"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="font-heading text-lg">Debate</span>
        <button
          onClick={toggleBottomSheet}
          className="p-2 -mr-2 text-text-secondary hover:text-text-primary"
          aria-label="Open market data"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
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
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-modal w-rail bg-paper shadow-modal transform transition-transform duration-300 ease-in-out ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-hairline flex items-center justify-between">
          <span className="font-heading text-lg">Contents</span>
          <button
            onClick={closeDrawer}
            className="p-1 text-text-secondary hover:text-text-primary"
            aria-label="Close navigation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto h-full pb-20">
          {leftRail}
        </div>
      </aside>

      {/* Desktop Layout */}
      <div className="hidden lg:flex justify-center min-h-screen">
        {/* Left Rail - TOC Navigation */}
        <aside className="w-rail flex-shrink-0 sticky top-0 h-screen overflow-y-auto py-8 pr-6">
          {leftRail}
        </aside>

        {/* Center Paper - Main Content */}
        <main className="w-full max-w-paper flex-shrink-0 py-8">
          <div className="paper-surface min-h-full px-12 py-10">
            {centerPaper}
          </div>
        </main>

        {/* Right Margin - Market Data & Stance */}
        <aside className="w-margin flex-shrink-0 sticky top-0 h-screen overflow-y-auto py-8 pl-6">
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
          <span className="font-heading text-lg">Market Data</span>
          <button
            onClick={closeBottomSheet}
            className="p-1 text-text-secondary hover:text-text-primary"
            aria-label="Close market data"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
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
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
