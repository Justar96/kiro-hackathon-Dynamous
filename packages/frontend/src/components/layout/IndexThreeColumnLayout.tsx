import { useState, useCallback } from 'react';
import { MenuIcon, XIcon, ChartIcon } from '../icons';

interface IndexThreeColumnLayoutProps {
  leftRail: React.ReactNode;
  centerContent: React.ReactNode;
  rightRail: React.ReactNode;
}

/**
 * Three-column layout for the index page.
 * Unlike ThreeColumnLayout, the center column has no paper background.
 * Left and right rails are responsive - hidden on mobile with drawer/bottom sheet access.
 * Note: Uses the global navbar from __root.tsx, no duplicate navbar here.
 */
export function IndexThreeColumnLayout({ leftRail, centerContent, rightRail }: IndexThreeColumnLayoutProps) {
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);

  const toggleLeftDrawer = useCallback(() => setIsLeftDrawerOpen(prev => !prev), []);
  const toggleRightDrawer = useCallback(() => setIsRightDrawerOpen(prev => !prev), []);
  const closeLeftDrawer = useCallback(() => setIsLeftDrawerOpen(false), []);
  const closeRightDrawer = useCallback(() => setIsRightDrawerOpen(false), []);

  return (
    <div className="min-h-screen bg-page-bg">
      {/* Mobile bottom bar - clean, minimal */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-sticky bg-paper/95 backdrop-blur-sm border-t border-hairline">
        <div className="flex items-center justify-between px-2 py-1.5">
          <button
            onClick={toggleLeftDrawer}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-rule/50 active:bg-rule transition-colors text-sm font-medium"
            aria-label="Open filters"
          >
            <MenuIcon size="md" decorative />
            <span>Filters</span>
          </button>
          <button
            onClick={toggleRightDrawer}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-rule/50 active:bg-rule transition-colors text-sm font-medium"
            aria-label="Open stats"
          >
            <span>Stats</span>
            <ChartIcon size="md" decorative />
          </button>
        </div>
      </div>

      {/* Mobile Left Drawer Overlay */}
      <div
        className={`lg:hidden fixed inset-0 z-overlay bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${
          isLeftDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeLeftDrawer}
        aria-hidden={!isLeftDrawerOpen}
      />

      {/* Mobile Left Drawer - No header, floating close button */}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-modal w-72 bg-paper shadow-modal transform transition-transform duration-300 ease-out ${
          isLeftDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={closeLeftDrawer}
          className="absolute top-3 right-3 p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-rule/50 transition-colors z-10"
          aria-label="Close filters"
        >
          <XIcon size="md" decorative />
        </button>
        <div className="overflow-y-auto h-full pt-4 pb-20 px-4">
          {leftRail}
        </div>
      </aside>

      {/* Mobile Right Drawer Overlay */}
      <div
        className={`lg:hidden fixed inset-0 z-overlay bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${
          isRightDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeRightDrawer}
        aria-hidden={!isRightDrawerOpen}
      />

      {/* Mobile Right Drawer - No header, floating close button */}
      <aside
        className={`lg:hidden fixed top-0 right-0 bottom-0 z-modal w-72 bg-paper shadow-modal transform transition-transform duration-300 ease-out ${
          isRightDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <button
          onClick={closeRightDrawer}
          className="absolute top-3 left-3 p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-rule/50 transition-colors z-10"
          aria-label="Close stats"
        >
          <XIcon size="md" decorative />
        </button>
        <div className="overflow-y-auto h-full pt-4 pb-20 px-4">
          {rightRail}
        </div>
      </aside>

      {/* Desktop Layout - 3 columns */}
      <div className="hidden lg:block">
        <div className="max-w-[1320px] mx-auto px-6 py-8">
          <div className="flex gap-6 items-start">
            {/* Left Rail - wider for better content display */}
            <aside className="w-72 flex-shrink-0 sticky top-20">
              {leftRail}
            </aside>

            {/* Center Content - No paper background */}
            <main className="flex-1 min-w-0">
              {centerContent}
            </main>

            {/* Right Rail - slightly narrower */}
            <aside className="w-64 flex-shrink-0 sticky top-20">
              {rightRail}
            </aside>
          </div>
        </div>
      </div>

      {/* Tablet Layout - 2 columns (center + right) */}
      <div className="hidden md:block lg:hidden">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex gap-6 items-start">
            {/* Center Content */}
            <main className="flex-1 min-w-0">
              {centerContent}
            </main>

            {/* Right Rail */}
            <aside className="w-64 flex-shrink-0 sticky top-20">
              {rightRail}
            </aside>
          </div>
        </div>
      </div>

      {/* Mobile Layout - Single column with bottom padding for nav bar */}
      <div className="md:hidden pb-16">
        <main className="px-4 py-4">
          {centerContent}
        </main>
      </div>
    </div>
  );
}

export default IndexThreeColumnLayout;
