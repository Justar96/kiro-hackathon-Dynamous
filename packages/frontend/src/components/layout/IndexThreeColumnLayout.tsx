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
      {/* Mobile drawer toggle buttons - fixed bottom bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-sticky bg-paper border-t border-black/[0.08] px-4 py-2 flex items-center justify-between">
        <button
          onClick={toggleLeftDrawer}
          className="flex items-center gap-2 px-3 py-2 text-text-secondary hover:text-text-primary text-sm"
          aria-label="Open menu"
        >
          <MenuIcon size="md" decorative />
          <span>Menu</span>
        </button>
        <button
          onClick={toggleRightDrawer}
          className="flex items-center gap-2 px-3 py-2 text-text-secondary hover:text-text-primary text-sm"
          aria-label="Open stats"
        >
          <span>Stats</span>
          <ChartIcon size="md" decorative />
        </button>
      </div>

      {/* Mobile Left Drawer Overlay */}
      {isLeftDrawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-overlay bg-black/30"
          onClick={closeLeftDrawer}
        />
      )}

      {/* Mobile Left Drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-modal w-72 bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${
          isLeftDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <span className="font-heading text-lg font-semibold">Menu</span>
          <button
            onClick={closeLeftDrawer}
            className="p-1 text-gray-400 hover:text-gray-600"
            aria-label="Close menu"
          >
            <XIcon size="md" decorative />
          </button>
        </div>
        <div className="overflow-y-auto h-full pb-20 p-4">
          {leftRail}
        </div>
      </aside>

      {/* Mobile Right Drawer Overlay */}
      {isRightDrawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-overlay bg-black/30"
          onClick={closeRightDrawer}
        />
      )}

      {/* Mobile Right Drawer */}
      <aside
        className={`lg:hidden fixed top-0 right-0 bottom-0 z-modal w-72 bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${
          isRightDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <span className="font-heading text-lg font-semibold">Stats</span>
          <button
            onClick={closeRightDrawer}
            className="p-1 text-gray-400 hover:text-gray-600"
            aria-label="Close stats"
          >
            <XIcon size="md" decorative />
          </button>
        </div>
        <div className="overflow-y-auto h-full pb-20 p-4">
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
